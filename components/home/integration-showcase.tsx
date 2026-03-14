"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";

const integrationCards = {
  payments: {
    title: "Payment rail integration",
    subtitle: "Stripe transfer orchestration with reconciliation-ready event records.",
    bullets: [
      "Provider references persisted per tenant",
      "Status lifecycle synced to payment_transfers",
      "Supports webhook-driven settlement updates"
    ],
    href: "/transactions"
  },
  api: {
    title: "API-first architecture",
    subtitle: "Structured REST groups for auth, accounts, transactions, loans, and compliance.",
    bullets: [
      "Versioned under /api/v1",
      "Zod validation at request boundaries",
      "Designed for partner platform extension"
    ],
    href: "/api/v1/admin/metrics"
  },
  governance: {
    title: "Control and governance",
    subtitle: "RBAC, audit logging, and tenant isolation integrated into daily operations.",
    bullets: [
      "Permission workflows in admin console",
      "Auth/session events captured in audit logs",
      "Tenant-aware data access by policy"
    ],
    href: "/admin"
  }
};

const panel = (input: (typeof integrationCards)[keyof typeof integrationCards]) => {
  return (
    <Card className="border-slate-200/90 bg-white">
      <CardBody className="space-y-3 px-4 py-4">
        <h3 className="text-lg font-semibold text-slate-900">{input.title}</h3>
        <p className="text-sm text-slate-600">{input.subtitle}</p>
        <ul className="space-y-2 text-sm text-slate-700">
          {input.bullets.map((bullet) => (
            <li className="rounded-lg bg-slate-50 px-3 py-2" key={bullet}>
              {bullet}
            </li>
          ))}
        </ul>
        <Link
          className="inline-flex rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          href={input.href}
        >
          Explore
        </Link>
      </CardBody>
    </Card>
  );
};

export const IntegrationShowcase = () => {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Platform capabilities</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Integrations and extension points</h2>
        </div>
        <Badge tone="success">MVP ready</Badge>
      </div>

      <Tabs
        className="rounded-2xl border border-slate-200 bg-white/95 p-3 sm:p-4"
        defaultKey="payments"
        items={[
          {
            key: "payments",
            label: "Payments",
            content: panel(integrationCards.payments)
          },
          {
            key: "api",
            label: "API Layer",
            content: panel(integrationCards.api)
          },
          {
            key: "governance",
            label: "Governance",
            content: panel(integrationCards.governance)
          }
        ]}
      />
    </section>
  );
};
