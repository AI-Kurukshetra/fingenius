#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Supabase admin client (uses service role key for full access)
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "fingenius-banking",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Tool: list_customers
// ---------------------------------------------------------------------------
server.tool(
  "list_customers",
  "List customers with optional search by name/email. Returns customer details including KYC status, risk tier, and onboarding status.",
  {
    tenant_id: z.string().uuid().describe("Tenant ID to scope the query"),
    search: z
      .string()
      .optional()
      .describe("Search by customer name or email (partial match)"),
    status: z
      .string()
      .optional()
      .describe("Filter by onboarding status (e.g. draft, kyc_pending, approved)"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .default(25)
      .describe("Max results to return"),
  },
  async ({ tenant_id, search, status, limit }) => {
    let query = supabase
      .from("customers")
      .select(
        "id, tenant_id, full_name, email, phone, date_of_birth, risk_tier, kyc_status, onboarding_status, created_at"
      )
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }
    if (status) {
      query = query.eq("onboarding_status", status);
    }

    const { data, error } = await query;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_customer
// ---------------------------------------------------------------------------
server.tool(
  "get_customer",
  "Get full details of a single customer by ID, including KYC/AML status.",
  {
    tenant_id: z.string().uuid().describe("Tenant ID"),
    customer_id: z.string().uuid().describe("Customer ID"),
  },
  async ({ tenant_id, customer_id }) => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("id", customer_id)
      .maybeSingle();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    if (!data) return { content: [{ type: "text" as const, text: "Customer not found" }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: list_accounts
// ---------------------------------------------------------------------------
server.tool(
  "list_accounts",
  "List bank accounts with optional filters by status and product type.",
  {
    tenant_id: z.string().uuid().describe("Tenant ID"),
    status: z
      .enum(["pending", "active", "frozen", "closed"])
      .optional()
      .describe("Filter by account status"),
    product_code: z
      .enum(["savings", "current", "loan", "wallet"])
      .optional()
      .describe("Filter by product type"),
    customer_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filter by customer ID"),
    limit: z.number().min(1).max(100).default(25).describe("Max results"),
  },
  async ({ tenant_id, status, product_code, customer_id, limit }) => {
    let query = supabase
      .from("accounts")
      .select(
        "id, account_number, customer_id, product_code, status, currency, balance_minor, created_at"
      )
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (product_code) query = query.eq("product_code", product_code);
    if (customer_id) query = query.eq("customer_id", customer_id);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_account
// ---------------------------------------------------------------------------
server.tool(
  "get_account",
  "Get details of a single bank account by ID.",
  {
    tenant_id: z.string().uuid().describe("Tenant ID"),
    account_id: z.string().uuid().describe("Account ID"),
  },
  async ({ tenant_id, account_id }) => {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("id", account_id)
      .maybeSingle();

    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    if (!data) return { content: [{ type: "text" as const, text: "Account not found" }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: list_transactions
// ---------------------------------------------------------------------------
server.tool(
  "list_transactions",
  "List ledger transactions with optional status filter. Shows double-entry transaction records.",
  {
    tenant_id: z.string().uuid().describe("Tenant ID"),
    status: z
      .enum(["initiated", "approved", "posted", "reversed"])
      .optional()
      .describe("Filter by transaction status"),
    account_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filter transactions involving this account"),
    limit: z.number().min(1).max(100).default(25).describe("Max results"),
  },
  async ({ tenant_id, status, account_id, limit }) => {
    let query = supabase
      .from("ledger_transactions")
      .select(
        "id, reference, description, status, currency, created_by, created_at"
      )
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

    // If account_id filter, fetch entries for those transactions
    if (account_id && data && data.length > 0) {
      const txIds = data.map((t: Record<string, unknown>) => t.id as string);
      const { data: entries } = await supabase
        .from("ledger_entries")
        .select("transaction_id, account_id, direction, amount_minor, currency")
        .in("transaction_id", txIds)
        .eq("account_id", account_id);

      const matchingTxIds = new Set(
        (entries ?? []).map((e: Record<string, unknown>) => e.transaction_id)
      );
      const filtered = data.filter((t: Record<string, unknown>) => matchingTxIds.has(t.id));
      return { content: [{ type: "text" as const, text: JSON.stringify(filtered, null, 2) }] };
    }

    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_transaction_detail
// ---------------------------------------------------------------------------
server.tool(
  "get_transaction_detail",
  "Get full transaction details including all ledger entries (debit/credit postings).",
  {
    tenant_id: z.string().uuid().describe("Tenant ID"),
    transaction_id: z.string().uuid().describe("Transaction ID"),
  },
  async ({ tenant_id, transaction_id }) => {
    const [txResult, entriesResult] = await Promise.all([
      supabase
        .from("ledger_transactions")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("id", transaction_id)
        .maybeSingle(),
      supabase
        .from("ledger_entries")
        .select("*")
        .eq("transaction_id", transaction_id),
    ]);

    if (txResult.error)
      return { content: [{ type: "text" as const, text: `Error: ${txResult.error.message}` }] };
    if (!txResult.data)
      return { content: [{ type: "text" as const, text: "Transaction not found" }] };

    const result = {
      ...txResult.data,
      entries: entriesResult.data ?? [],
    };
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: list_loans
// ---------------------------------------------------------------------------
server.tool(
  "list_loans",
  "List loan applications with optional status filter.",
  {
    tenant_id: z.string().uuid().describe("Tenant ID"),
    status: z
      .enum(["draft", "submitted", "under_review", "approved", "rejected", "disbursed"])
      .optional()
      .describe("Filter by loan status"),
    customer_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filter by customer ID"),
    limit: z.number().min(1).max(100).default(25).describe("Max results"),
  },
  async ({ tenant_id, status, customer_id, limit }) => {
    let query = supabase
      .from("loan_applications")
      .select(
        "id, customer_id, product_code, principal_minor, currency, term_months, apr_bps, status, created_at"
      )
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (customer_id) query = query.eq("customer_id", customer_id);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: list_compliance_alerts
// ---------------------------------------------------------------------------
server.tool(
  "list_compliance_alerts",
  "List compliance events/alerts with optional filters by status, severity, and event type.",
  {
    tenant_id: z.string().uuid().describe("Tenant ID"),
    status: z
      .enum(["open", "under_review", "escalated", "resolved", "dismissed"])
      .optional()
      .describe("Filter by alert status"),
    severity: z
      .enum(["low", "medium", "high", "critical"])
      .optional()
      .describe("Filter by severity"),
    event_type: z
      .enum(["kyc", "aml", "sanctions", "fraud", "pep"])
      .optional()
      .describe("Filter by compliance event type"),
    limit: z.number().min(1).max(100).default(25).describe("Max results"),
  },
  async ({ tenant_id, status, severity, event_type, limit }) => {
    let query = supabase
      .from("compliance_events")
      .select(
        "id, customer_id, event_type, severity, status, description, metadata, created_at"
      )
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (severity) query = query.eq("severity", severity);
    if (event_type) query = query.eq("event_type", event_type);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: list_payments
// ---------------------------------------------------------------------------
server.tool(
  "list_payments",
  "List payment transfers with optional status filter.",
  {
    tenant_id: z.string().uuid().describe("Tenant ID"),
    status: z
      .enum(["pending", "processing", "completed", "failed", "reversed"])
      .optional()
      .describe("Filter by payment status"),
    account_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filter by source account ID"),
    limit: z.number().min(1).max(100).default(25).describe("Max results"),
  },
  async ({ tenant_id, status, account_id, limit }) => {
    let query = supabase
      .from("payment_transfers")
      .select(
        "id, account_id, amount_minor, currency, description, provider, provider_reference, status, last_error, created_at"
      )
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (account_id) query = query.eq("account_id", account_id);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_admin_metrics
// ---------------------------------------------------------------------------
server.tool(
  "get_admin_metrics",
  "Get operational dashboard metrics: total customers, accounts, transactions, loans, active alerts, and recent payment volume.",
  {
    tenant_id: z.string().uuid().describe("Tenant ID"),
  },
  async ({ tenant_id }) => {
    const [customers, accounts, transactions, loans, alerts, payments] =
      await Promise.all([
        supabase
          .from("customers")
          .select("id", { head: true, count: "exact" })
          .eq("tenant_id", tenant_id),
        supabase
          .from("accounts")
          .select("id", { head: true, count: "exact" })
          .eq("tenant_id", tenant_id),
        supabase
          .from("ledger_transactions")
          .select("id", { head: true, count: "exact" })
          .eq("tenant_id", tenant_id),
        supabase
          .from("loan_applications")
          .select("id", { head: true, count: "exact" })
          .eq("tenant_id", tenant_id),
        supabase
          .from("compliance_events")
          .select("id", { head: true, count: "exact" })
          .eq("tenant_id", tenant_id)
          .in("status", ["open", "under_review", "escalated"]),
        supabase
          .from("payment_transfers")
          .select("id", { head: true, count: "exact" })
          .eq("tenant_id", tenant_id),
      ]);

    const metrics = {
      total_customers: customers.count ?? 0,
      total_accounts: accounts.count ?? 0,
      total_transactions: transactions.count ?? 0,
      total_loans: loans.count ?? 0,
      active_compliance_alerts: alerts.count ?? 0,
      total_payments: payments.count ?? 0,
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(metrics, null, 2) }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: list_audit_logs
// ---------------------------------------------------------------------------
server.tool(
  "list_audit_logs",
  "List audit log entries for a tenant. Shows who did what and when — useful for compliance and debugging.",
  {
    tenant_id: z.string().uuid().describe("Tenant ID"),
    resource_type: z
      .string()
      .optional()
      .describe("Filter by resource type (e.g. customer, account, transaction)"),
    action: z
      .string()
      .optional()
      .describe("Filter by action (e.g. create, update, delete)"),
    actor_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filter by actor/user ID"),
    limit: z.number().min(1).max(100).default(25).describe("Max results"),
  },
  async ({ tenant_id, resource_type, action, actor_id, limit }) => {
    let query = supabase
      .from("audit_logs")
      .select(
        "id, actor_id, action, resource_type, resource_id, metadata, created_at"
      )
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (resource_type) query = query.eq("resource_type", resource_type);
    if (action) query = query.eq("action", action);
    if (actor_id) query = query.eq("actor_id", actor_id);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Fingenius MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
