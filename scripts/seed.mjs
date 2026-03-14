#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

const parseArgs = (argv) => {
  const args = {
    envFile: null,
    superadminEmail: null,
    superadminPassword: null,
    superadminName: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--env-file") {
      args.envFile = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (current === "--superadmin-email") {
      args.superadminEmail = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (current === "--superadmin-password") {
      args.superadminPassword = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (current === "--superadmin-name") {
      args.superadminName = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return args;
};

const parseEnvContent = (content) => {
  const output = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");

    if (eqIndex <= 0) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    output[key] = value;
  }

  return output;
};

const loadEnvFile = (filePath) => {
  const absolutePath = resolve(process.cwd(), filePath);

  if (!existsSync(absolutePath)) {
    return;
  }

  const parsed = parseEnvContent(readFileSync(absolutePath, "utf8"));

  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

const loadEnv = (envFileArg) => {
  if (envFileArg) {
    loadEnvFile(envFileArg);
    return;
  }

  loadEnvFile(".env.local");
  loadEnvFile(".env");
};

const required = (value, name) => {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
};

const ensureNoError = (error, context) => {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
};

const findUserByEmail = async (supabase, email) => {
  let page = 1;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200
    });

    ensureNoError(error, "List users failed");

    const matched = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

    if (matched) {
      return matched;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }

  return null;
};

const ensureSuperadminUser = async (supabase, { email, password, fullName }) => {
  const existingUser = await findUserByEmail(supabase, email);

  if (existingUser) {
    return { user: existingUser, created: false };
  }

  if (!password) {
    throw new Error(
      `No auth user found for ${email}. Set SEED_SUPERADMIN_PASSWORD to auto-create, or create the user manually and re-run seed.`
    );
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName
    }
  });
  ensureNoError(error, "Create superadmin auth user failed");

  if (!data.user) {
    throw new Error("Create superadmin auth user failed: missing user in response");
  }

  return { user: data.user, created: true };
};

const seed = async () => {
  const args = parseArgs(process.argv.slice(2));
  loadEnv(args.envFile);

  const url = required(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL"
  );
  const serviceRoleKey = required(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY"
  );

  const superadminEmail = required(
    (
      args.superadminEmail ??
      process.env.SEED_SUPERADMIN_EMAIL ??
      process.env.SEED_ADMIN_EMAIL ??
      ""
    ).trim(),
    "SEED_SUPERADMIN_EMAIL"
  ).toLowerCase();
  const superadminPassword = (args.superadminPassword ??
    process.env.SEED_SUPERADMIN_PASSWORD ??
    "").trim();
  const superadminName = (
    args.superadminName ??
    process.env.SEED_SUPERADMIN_FULL_NAME ??
    "Super Admin"
  ).trim();
  const resolvedSuperadminName = superadminName || "Super Admin";

  if (!args.superadminEmail && !process.env.SEED_SUPERADMIN_EMAIL && process.env.SEED_ADMIN_EMAIL) {
    console.warn("SEED_ADMIN_EMAIL is deprecated. Please use SEED_SUPERADMIN_EMAIL.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { user: superadminUser, created: superadminWasCreated } = await ensureSuperadminUser(
    supabase,
    {
      email: superadminEmail,
      password: superadminPassword,
      fullName: resolvedSuperadminName
    }
  );

  const superadminUserId = superadminUser.id;

  const { error: tenantUpsertError } = await supabase.from("tenants").upsert(
    {
      code: "demo-bank",
      legal_name: "Demo Bank Ltd",
      country_code: "IN",
      base_currency: "INR",
      is_active: true
    },
    { onConflict: "code" }
  );
  ensureNoError(tenantUpsertError, "Upsert tenant failed");

  const { data: tenantRow, error: tenantSelectError } = await supabase
    .from("tenants")
    .select("id")
    .eq("code", "demo-bank")
    .single();
  ensureNoError(tenantSelectError, "Fetch tenant failed");
  const tenantId = tenantRow.id;

  const { error: profileError } = await supabase.from("user_profiles").upsert(
    {
      id: superadminUserId,
      full_name:
        resolvedSuperadminName ??
        superadminUser.user_metadata?.full_name ??
        superadminEmail.split("@")[0] ??
        "Super Admin",
      email: superadminEmail
    },
    { onConflict: "id" }
  );
  ensureNoError(profileError, "Upsert user profile failed");

  const { error: membershipError } = await supabase.from("tenant_memberships").upsert(
    {
      tenant_id: tenantId,
      user_id: superadminUserId,
      role: "platform_admin",
      is_active: true
    },
    { onConflict: "tenant_id,user_id,role" }
  );
  ensureNoError(membershipError, "Upsert superadmin membership failed");

  const { error: roleAssignmentError } = await supabase.from("user_role_assignments").upsert(
    {
      tenant_id: tenantId,
      user_id: superadminUserId,
      role: "admin",
      created_by: superadminUserId
    },
    { onConflict: "tenant_id,user_id,role" }
  );
  ensureNoError(roleAssignmentError, "Upsert superadmin role assignment failed");

  const customersPayload = [
    {
      tenant_id: tenantId,
      external_customer_ref: "CUST-0001",
      full_name: "Asha Rao",
      email: "asha.rao@example.com",
      kyc_status: "verified",
      risk_tier: "low"
    },
    {
      tenant_id: tenantId,
      external_customer_ref: "CUST-0002",
      full_name: "Raj Patel",
      email: "raj.patel@example.com",
      kyc_status: "pending",
      risk_tier: "medium"
    }
  ];

  const { error: customersError } = await supabase
    .from("customers")
    .upsert(customersPayload, { onConflict: "tenant_id,external_customer_ref" });
  ensureNoError(customersError, "Upsert customers failed");

  const { data: customers, error: customersSelectError } = await supabase
    .from("customers")
    .select("id,external_customer_ref")
    .eq("tenant_id", tenantId)
    .in("external_customer_ref", ["CUST-0001", "CUST-0002"]);
  ensureNoError(customersSelectError, "Fetch customers failed");

  const customer1 = customers.find((item) => item.external_customer_ref === "CUST-0001");
  const customer2 = customers.find((item) => item.external_customer_ref === "CUST-0002");

  if (!customer1 || !customer2) {
    throw new Error("Expected seeded customers were not found");
  }

  const { error: accountsError } = await supabase.from("accounts").upsert(
    [
      {
        tenant_id: tenantId,
        customer_id: customer1.id,
        account_number: "0010000001",
        product_code: "SAVINGS",
        currency: "INR",
        status: "active"
      },
      {
        tenant_id: tenantId,
        customer_id: customer2.id,
        account_number: "0010000002",
        product_code: "CURRENT",
        currency: "INR",
        status: "active"
      }
    ],
    { onConflict: "tenant_id,account_number" }
  );
  ensureNoError(accountsError, "Upsert accounts failed");

  const { data: accounts, error: accountsSelectError } = await supabase
    .from("accounts")
    .select("id,account_number")
    .eq("tenant_id", tenantId)
    .in("account_number", ["0010000001", "0010000002"]);
  ensureNoError(accountsSelectError, "Fetch accounts failed");

  const account1 = accounts.find((item) => item.account_number === "0010000001");
  const account2 = accounts.find((item) => item.account_number === "0010000002");

  if (!account1 || !account2) {
    throw new Error("Expected seeded accounts were not found");
  }

  const { data: existingTx, error: existingTxError } = await supabase
    .from("ledger_transactions")
    .select("id,status")
    .eq("tenant_id", tenantId)
    .eq("reference", "TXN-SEED-0001")
    .maybeSingle();
  ensureNoError(existingTxError, "Lookup seed transaction failed");

  let transactionId = existingTx?.id ?? null;

  if (!transactionId) {
    const { data: insertedTx, error: insertTxError } = await supabase
      .from("ledger_transactions")
      .insert({
        tenant_id: tenantId,
        reference: "TXN-SEED-0001",
        description: "Seed transfer between demo accounts",
        status: "pending",
        idempotency_key: "seed-idempotency-0001",
        created_by: superadminUserId
      })
      .select("id")
      .single();
    ensureNoError(insertTxError, "Insert seed transaction failed");
    transactionId = insertedTx.id;
  }

  const { data: existingEntries, error: existingEntriesError } = await supabase
    .from("ledger_entries")
    .select("id")
    .eq("transaction_id", transactionId);
  ensureNoError(existingEntriesError, "Lookup seed ledger entries failed");

  if (existingEntries.length === 0) {
    const { error: entriesError } = await supabase.from("ledger_entries").insert([
      {
        tenant_id: tenantId,
        transaction_id: transactionId,
        account_id: account1.id,
        direction: "debit",
        amount_minor: 50000,
        currency: "INR"
      },
      {
        tenant_id: tenantId,
        transaction_id: transactionId,
        account_id: account2.id,
        direction: "credit",
        amount_minor: 50000,
        currency: "INR"
      }
    ]);
    ensureNoError(entriesError, "Insert seed ledger entries failed");
  }

  const { error: postTxError } = await supabase
    .from("ledger_transactions")
    .update({ status: "posted", posted_at: new Date().toISOString() })
    .eq("id", transactionId)
    .neq("status", "posted");
  ensureNoError(postTxError, "Post seed transaction failed");

  const { data: existingLoan, error: existingLoanError } = await supabase
    .from("loan_applications")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customer2.id)
    .eq("purpose", "Working capital")
    .maybeSingle();
  ensureNoError(existingLoanError, "Lookup seed loan application failed");

  if (!existingLoan) {
    const { error: loanInsertError } = await supabase.from("loan_applications").insert({
      tenant_id: tenantId,
      customer_id: customer2.id,
      principal_minor: 250000,
      term_months: 12,
      annual_rate_bps: 1400,
      purpose: "Working capital",
      status: "under_review"
    });
    ensureNoError(loanInsertError, "Insert seed loan application failed");
  }

  const { data: existingAlert, error: existingAlertError } = await supabase
    .from("compliance_alerts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customer2.id)
    .eq("summary", "Seed AML review case")
    .maybeSingle();
  ensureNoError(existingAlertError, "Lookup seed compliance alert failed");

  if (!existingAlert) {
    const { error: alertInsertError } = await supabase.from("compliance_alerts").insert({
      tenant_id: tenantId,
      customer_id: customer2.id,
      event_type: "aml_flag",
      severity: "medium",
      status: "open",
      summary: "Seed AML review case"
    });
    ensureNoError(alertInsertError, "Insert seed compliance alert failed");
  }

  const { error: transferError } = await supabase.from("payment_transfers").upsert(
    {
      tenant_id: tenantId,
      account_id: account1.id,
      provider: "stripe",
      provider_reference: "tr_seed_0001",
      amount_minor: 120000,
      currency: "INR",
      status: "pending"
    },
    { onConflict: "tenant_id,provider_reference" }
  );
  ensureNoError(transferError, "Upsert seed payment transfer failed");

  console.log("Seed complete");
  console.log(`tenant_id=${tenantId}`);
  console.log(`superadmin_user_id=${superadminUserId}`);
  console.log(`superadmin_email=${superadminEmail}`);
  console.log(`superadmin_created=${superadminWasCreated}`);
};

seed().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
});
