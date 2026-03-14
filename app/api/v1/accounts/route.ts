import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { generateUniqueAccountNumber } from "@/lib/accounts/account-number";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAccountSchema, updateAccountStatusSchema } from "@/lib/validations/account";

export async function GET(request: Request) {
  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  const canRead =
    hasPermissionInContext(context, "account:read") || hasPermissionInContext(context, "account:write");

  if (!canRead) {
    return fail("Forbidden", 403);
  }

  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();
  const productCode = searchParams.get("productCode")?.trim();

  let query = supabase
    .from("accounts")
    .select("id, account_number, customer_id, product_code, currency, status, created_at")
    .eq("tenant_id", context.tenantId)
    .order("created_at", { ascending: false })
    .limit(250);

  if (status) {
    query = query.eq("status", status);
  }

  if (productCode) {
    query = query.eq("product_code", productCode);
  }

  const { data, error } = await query;

  if (error) {
    return fail(error.message, 500);
  }

  return ok({ items: data ?? [], count: data?.length ?? 0 });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = createAccountSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid account request", 422);
  }

  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  if (!hasPermissionInContext(context, "account:write")) {
    return fail("Forbidden", 403);
  }

  if (parsed.data.tenantId !== context.tenantId) {
    return fail("Tenant scope violation", 403);
  }

  const supabase = await createServerSupabaseClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, onboarding_status")
    .eq("tenant_id", context.tenantId)
    .eq("id", parsed.data.customerId)
    .maybeSingle();

  if (!customer?.id) {
    return fail("Customer not found", 404);
  }

  const status = (customer as { onboarding_status?: string }).onboarding_status;
  const allowedForAccountOpening =
    status === "ready_for_account_opening" || status === "profile_complete";
  if (!allowedForAccountOpening) {
    return fail(
      "Customer onboarding must be complete (ready_for_account_opening) before opening an account.",
      422
    );
  }

  const accountNumber = await generateUniqueAccountNumber(supabase, context.tenantId);

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      tenant_id: context.tenantId,
      customer_id: parsed.data.customerId,
      account_number: accountNumber,
      product_code: parsed.data.productCode,
      currency: parsed.data.currency,
      status: "active"
    })
    .select("id, account_number, customer_id, product_code, currency, status")
    .single();

  if (error) {
    return fail(error.message, 409);
  }

  await safeLogAuditEvent({
    tenantId: context.tenantId,
    actorId: context.userId,
    action: "account.created",
    resourceType: "account",
    resourceId: data.id,
    metadata: {
      accountNumber: data.account_number,
      customerId: parsed.data.customerId,
      productCode: parsed.data.productCode,
      initialDepositMinor: parsed.data.initialDepositMinor,
      source: "api"
    }
  });

  return ok(
    {
      status: "accepted",
      account: {
        id: data.id,
        accountNumber: data.account_number,
        customerId: data.customer_id,
        productCode: data.product_code,
        currency: data.currency,
        state: data.status
      }
    },
    201
  );
}

const canTransitionAccountStatus = (current: string, next: string): boolean => {
  if (current === "closed") {
    return false;
  }

  if (current === "pending") {
    return next === "active" || next === "frozen" || next === "closed";
  }

  if (current === "active") {
    return next === "frozen" || next === "closed";
  }

  if (current === "frozen") {
    return next === "active" || next === "closed";
  }

  return false;
};

export async function PATCH(request: Request) {
  const payload = await request.json();
  const parsed = updateAccountStatusSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid account status payload", 422);
  }

  const context = await getAuthContext(request);

  if (!context) {
    return fail("Unauthenticated", 401);
  }

  if (!hasPermissionInContext(context, "account:write")) {
    return fail("Forbidden", 403);
  }

  const supabase = await createServerSupabaseClient();
  const { data: account, error: fetchError } = await supabase
    .from("accounts")
    .select("id, status")
    .eq("tenant_id", context.tenantId)
    .eq("id", parsed.data.accountId)
    .maybeSingle();

  if (fetchError) {
    return fail(fetchError.message, 500);
  }

  if (!account) {
    return fail("Account not found", 404);
  }

  if (account.status === parsed.data.status) {
    return ok({
      accountId: account.id,
      status: account.status,
      changed: false
    });
  }

  if (!canTransitionAccountStatus(account.status, parsed.data.status)) {
    return fail(`Cannot move account from ${account.status} to ${parsed.data.status}`, 422);
  }

  const { data: updated, error: updateError } = await supabase
    .from("accounts")
    .update({ status: parsed.data.status })
    .eq("tenant_id", context.tenantId)
    .eq("id", parsed.data.accountId)
    .select("id, status")
    .single();

  if (updateError) {
    return fail(updateError.message, 409);
  }

  await safeLogAuditEvent({
    tenantId: context.tenantId,
    actorId: context.userId,
    action: "account.status_changed",
    resourceType: "account",
    resourceId: updated.id,
    metadata: {
      from: account.status,
      to: updated.status
    }
  });

  return ok({
    accountId: updated.id,
    status: updated.status,
    changed: true
  });
}
