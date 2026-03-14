"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PanelKey = "operations" | "risk" | "admin";

type PreviewPanel = {
  key: PanelKey;
  label: string;
  title: string;
  subtitle: string;
  stats: Array<{
    label: string;
    value: string;
    tone: "success" | "warning" | "info";
  }>;
  stream: Array<{
    event: string;
    confidence: number;
  }>;
};

const panels: PreviewPanel[] = [
  {
    key: "operations",
    label: "Ops Pulse",
    title: "Operational throughput",
    subtitle: "Monitor onboarding, account activity, and settlement queues in real time.",
    stats: [
      { label: "Onboarding SLA", value: "98.4%", tone: "success" },
      { label: "Pending payouts", value: "04", tone: "warning" },
      { label: "API uptime", value: "99.99%", tone: "info" }
    ],
    stream: [
      { event: "Account KYC approved", confidence: 88 },
      { event: "High-value transfer posted", confidence: 76 },
      { event: "Loan application scored", confidence: 64 }
    ]
  },
  {
    key: "risk",
    label: "Risk Lens",
    title: "Compliance and controls",
    subtitle: "Trace alerts, AML workflow queues, and suspicious velocity patterns.",
    stats: [
      { label: "Open AML cases", value: "12", tone: "warning" },
      { label: "Audit chain", value: "Valid", tone: "success" },
      { label: "Policy drift", value: "0", tone: "info" }
    ],
    stream: [
      { event: "Velocity alert triaged", confidence: 90 },
      { event: "Sanctions match dismissed", confidence: 74 },
      { event: "Periodic KYC refresh", confidence: 58 }
    ]
  },
  {
    key: "admin",
    label: "Admin Grid",
    title: "Permissions and governance",
    subtitle: "Control roles, monitor sessions, and maintain institution-level governance.",
    stats: [
      { label: "Privileged sessions", value: "07", tone: "warning" },
      { label: "Permission edits", value: "03", tone: "info" },
      { label: "RLS status", value: "Healthy", tone: "success" }
    ],
    stream: [
      { event: "Role assignment changed", confidence: 84 },
      { event: "Session revoked", confidence: 69 },
      { event: "Policy sync complete", confidence: 57 }
    ]
  }
];

const toneMap: Record<"success" | "warning" | "info", "success" | "warning" | "info"> = {
  success: "success",
  warning: "warning",
  info: "info"
};

export const HeroDashboardPreview = () => {
  const [active, setActive] = useState<PanelKey>("operations");
  const panel = panels.find((item) => item.key === active) ?? panels[0];

  return (
    <Card className="overflow-hidden border-slate-200/90 bg-white/95 shadow-[0_28px_80px_-40px_rgba(8,47,73,0.6)]">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-cyan-50 via-white to-emerald-50/80">
        <div className="flex flex-wrap gap-2">
          {panels.map((item) => {
            const isActive = item.key === active;

            return (
              <button
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide transition",
                  isActive
                    ? "bg-slate-900 text-white shadow-[0_10px_18px_-12px_rgba(15,23,42,0.8)]"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                )}
                key={item.key}
                onClick={() => setActive(item.key)}
                type="button"
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3">
          <p className="text-sm font-semibold text-slate-900">{panel.title}</p>
          <p className="mt-1 text-xs text-slate-600">{panel.subtitle}</p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {panel.stats.map((stat) => (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2" key={stat.label}>
              <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">{stat.label}</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="text-lg font-semibold text-slate-900">{stat.value}</p>
                <Badge tone={toneMap[stat.tone]}>{stat.tone}</Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {panel.stream.map((item) => (
            <div
              className="group rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:border-cyan-200 hover:bg-cyan-50/50"
              key={item.event}
            >
              <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
                <span className="font-medium">{item.event}</span>
                <span className="text-xs text-slate-500">{item.confidence}% signal</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-500 group-hover:from-cyan-600 group-hover:to-teal-600"
                  style={{ width: `${item.confidence}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
};
