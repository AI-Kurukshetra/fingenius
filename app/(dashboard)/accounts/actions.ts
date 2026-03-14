"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { generateUniqueAccountNumber } from "@/lib/accounts/account-number";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createAccountFormSchema = z.object({
  customerId: z.string().uuid(),
  productCode: z.enum(["SAVINGS", "CURRENT", "LOAN"]),
  currency: z.string().length(3),
  initialDepositMinor: z.coerce.number().int().min(0)
});

const backToAccountsWithError = (message: string): never => {
  redirect(`/accounts?error=${encodeURIComponent(message)}`);
};

const backToAccountsWithMessage = (message: string): never => {
  redirect(`/accounts?message=${encodeURIComponent(message)}`);
};

export const createAccountAction = async (formData: FormData): Promise<void> => {
  const parsed = createAccountFormSchema.safeParse({
    customerId: String(formData.get("customerId") ?? "").trim(),
    productCode: String(formData.get("productCode") ?? ""),
    currency: String(formData.get("currency") ?? "").trim().toUpperCase(),
    initialDepositMinor: formData.get("initialDepositMinor")
  });

  const values = parsed.success
    ? parsed.data
    : backToAccountsWithError(parsed.error.issues[0]?.message ?? "Invalid account request");

  const context = await getAuthContext();
  const authContext = context ?? backToAccountsWithError("Unauthenticated");

  if (!hasPermissionInContext(authContext, "account:write")) {
    backToAccountsWithError("You do not have permission to create accounts.");
  }

  const supabase = await createServerSupabaseClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("tenant_id", authContext.tenantId)
    .eq("id", values.customerId)
    .maybeSingle();

  if (!customer?.id) {
    backToAccountsWithError("Customer not found for this tenant.");
  }

  const accountNumber = await generateUniqueAccountNumber(supabase, authContext.tenantId);

  const { error } = await supabase.from("accounts").insert({
    tenant_id: authContext.tenantId,
    customer_id: values.customerId,
    account_number: accountNumber,
    product_code: values.productCode,
    currency: values.currency,
    status: "active"
  });

  if (error) {
    backToAccountsWithError(error.message);
  }

  await safeLogAuditEvent({
    tenantId: authContext.tenantId,
    actorId: authContext.userId,
    action: "account.created",
    resourceType: "account",
    resourceId: accountNumber,
    metadata: {
      customerId: values.customerId,
      productCode: values.productCode,
      currency: values.currency,
      initialDepositMinor: values.initialDepositMinor
    }
  });

  revalidatePath("/accounts");
  backToAccountsWithMessage(`Account ${accountNumber} created.`);
};
