"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FeatureGroup = "all" | "onboarding" | "operations" | "risk" | "admin";

type FeatureItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  group: Exclude<FeatureGroup, "all">;
  requiresAuth: boolean;
  tag: string;
};

type FeatureExplorerProps = {
  isAuthenticated: boolean;
  roles: string[];
};

const featureItems: FeatureItem[] = [
  {
    id: "onboarding",
    title: "Customer onboarding",
    description: "Capture customer identity, KYC readiness, and initial risk tier assignment.",
    href: "/customers",
    group: "onboarding",
    requiresAuth: true,
    tag: "KYC"
  },
  {
    id: "accounts",
    title: "Account management",
    description: "Open and monitor savings/current accounts with tenant-scoped controls.",
    href: "/accounts",
    group: "operations",
    requiresAuth: true,
    tag: "Accounts"
  },
  {
    id: "transactions",
    title: "Transaction processing",
    description: "Post and review ledger transactions with immutable entry guarantees.",
    href: "/transactions",
    group: "operations",
    requiresAuth: true,
    tag: "Ledger"
  },
  {
    id: "loans",
    title: "Loan origination",
    description: "Handle intake and basic underwriting decisions for working-capital requests.",
    href: "/loans",
    group: "operations",
    requiresAuth: true,
    tag: "Credit"
  },
  {
    id: "compliance",
    title: "Compliance monitoring",
    description: "Triage AML and KYC events with auditable review history.",
    href: "/compliance",
    group: "risk",
    requiresAuth: true,
    tag: "AML"
  },
  {
    id: "admin",
    title: "Admin controls",
    description: "Manage RBAC roles, permission assignments, and privileged access governance.",
    href: "/admin",
    group: "admin",
    requiresAuth: true,
    tag: "RBAC"
  },
  {
    id: "audit",
    title: "Audit log explorer",
    description: "Inspect authentication and permission-change events in a centralized trail.",
    href: "/admin",
    group: "admin",
    requiresAuth: true,
    tag: "Audit"
  }
];

const groupFilters: Array<{ key: FeatureGroup; label: string }> = [
  { key: "all", label: "All" },
  { key: "onboarding", label: "Onboarding" },
  { key: "operations", label: "Operations" },
  { key: "risk", label: "Risk & Compliance" },
  { key: "admin", label: "Admin" }
];

const roleTone = (roles: string[]): "info" | "warning" | "neutral" => {
  if (roles.includes("admin") || roles.includes("compliance_officer")) {
    return "info";
  }

  if (roles.includes("ops") || roles.includes("teller")) {
    return "warning";
  }

  return "neutral";
};

export const FeatureExplorer = ({ isAuthenticated, roles }: FeatureExplorerProps) => {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<FeatureGroup>("all");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return featureItems.filter((item) => {
      const matchesGroup = group === "all" || item.group === group;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        item.tag.toLowerCase().includes(normalizedQuery);

      return matchesGroup && matchesQuery;
    });
  }, [group, query]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Platform modules</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Explore core banking capabilities</h2>
          <p className="mt-1 text-sm text-slate-600">
            Filter modules by domain and jump directly into operational workflows.
          </p>
        </div>
        <Badge tone={roleTone(roles)}>
          {isAuthenticated ? `Signed in${roles.length ? ` · ${roles.join(" • ")}` : ""}` : "Guest mode"}
        </Badge>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.4)] sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {groupFilters.map((filter) => {
              const active = group === filter.key;

              return (
                <button
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide transition",
                    active
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                  key={filter.key}
                  onClick={() => setGroup(filter.key)}
                  type="button"
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          <input
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-700 outline-none ring-offset-2 transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200 sm:max-w-xs"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search modules, domains, tags..."
            type="search"
            value={query}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-slate-700">No modules matched your filters.</p>
            <p className="mt-1 text-xs text-slate-500">Try another keyword or switch the module category.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const href =
                !isAuthenticated && item.requiresAuth
                  ? `/login?message=${encodeURIComponent(`Sign in to access ${item.title.toLowerCase()}.`)}`
                  : item.href;

              return (
                <Link className="group" href={href} key={item.id}>
                  <Card className="h-full border-slate-200/90 bg-white transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-[0_22px_45px_-35px_rgba(6,182,212,0.7)]">
                    <CardBody className="space-y-3 px-4 py-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <Badge tone="neutral" className="group-hover:bg-cyan-100 group-hover:text-cyan-800">
                          {item.tag}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">{item.description}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Open workflow</p>
                    </CardBody>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
