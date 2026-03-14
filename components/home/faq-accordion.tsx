"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

const faqs: FaqItem[] = [
  {
    id: "tenant",
    question: "How does multi-tenant data isolation work?",
    answer:
      "Every core table is tenant-scoped and protected by row-level security policies. Users only access data for institutions where they have active membership or explicit role assignment."
  },
  {
    id: "ledger",
    question: "How do you protect ledger integrity?",
    answer:
      "Transactions are posted with balancing checks and immutable entry tables. Updates and deletes on ledger entries are blocked so the posted audit path remains tamper-resistant."
  },
  {
    id: "auth",
    question: "What authentication and access controls are included?",
    answer:
      "Supabase Auth handles signup/login and session lifecycle. Role-based permissions enforce module access for admin, ops, compliance, teller, and support workflows."
  },
  {
    id: "compliance",
    question: "Can compliance teams review alerts and evidence?",
    answer:
      "Yes. Compliance alerts and audit logs are accessible in dedicated flows, with event metadata retained for investigation and governance reporting."
  },
  {
    id: "integration",
    question: "How quickly can we integrate external payment rails?",
    answer:
      "The MVP includes one payment integration path and webhook scaffolding. You can add provider adapters while preserving the same transaction and audit contracts."
  }
];

export const FaqAccordion = () => {
  const [openId, setOpenId] = useState<string>(faqs[0]?.id ?? "");

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">FAQ</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">Common implementation questions</h2>
      </div>

      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white/95 p-3 sm:p-4">
        {faqs.map((item) => {
          const isOpen = item.id === openId;

          return (
            <article
              className={cn(
                "rounded-xl border px-4 py-3 transition",
                isOpen ? "border-cyan-200 bg-cyan-50/50" : "border-slate-200 bg-white"
              )}
              key={item.id}
            >
              <button
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setOpenId((current) => (current === item.id ? "" : item.id))}
                type="button"
              >
                <span className="text-sm font-semibold text-slate-900">{item.question}</span>
                <span className="text-lg text-slate-500">{isOpen ? "−" : "+"}</span>
              </button>
              <div
                className={cn(
                  "grid overflow-hidden text-sm text-slate-600 transition-all duration-300",
                  isOpen ? "mt-2 grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
              >
                <p className="min-h-0">{item.answer}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
