"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Testimonial = {
  quote: string;
  name: string;
  title: string;
  company: string;
};

const testimonials: Testimonial[] = [
  {
    quote:
      "We launched institutional onboarding in one week and still kept the audit trail clean enough for compliance review.",
    name: "Anita Menon",
    title: "COO",
    company: "Harbor Microbank"
  },
  {
    quote:
      "Role-based controls and session governance helped our ops team move faster without increasing access risk.",
    name: "Daniel Cruz",
    title: "Head of Operations",
    company: "Arc Ledger Finance"
  },
  {
    quote:
      "The ledger-first transaction model made reconciliation straightforward even during rapid product iteration.",
    name: "Priya Shah",
    title: "Risk Lead",
    company: "Nexa Payments"
  }
];

const securityPillars = ["RLS-enforced tenant scoping", "Immutable audit chain", "RBAC + permission governance"];

export const TrustCarousel = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % testimonials.length);
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <Card className="overflow-hidden border-slate-200/90 bg-white/95">
        <CardBody className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Trust and credibility</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">Built for regulated operations</h2>
            </div>
            <Badge tone="info">Security-first</Badge>
          </div>

          <div className="relative min-h-40 rounded-2xl border border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-emerald-50/70 p-4">
            {testimonials.map((item, index) => {
              const active = index === activeIndex;

              return (
                <article
                  className={cn(
                    "absolute inset-0 space-y-3 p-4 transition-all duration-500",
                    active
                      ? "translate-y-0 opacity-100"
                      : "pointer-events-none translate-y-2 opacity-0"
                  )}
                  key={`${item.name}-${item.company}`}
                >
                  <p className="text-base leading-relaxed text-slate-700">“{item.quote}”</p>
                  <div className="pt-2">
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.title} · {item.company}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {testimonials.map((item, index) => (
              <button
                aria-label={`Show testimonial by ${item.name}`}
                className={cn(
                  "h-2.5 rounded-full transition-all",
                  index === activeIndex ? "w-8 bg-slate-900" : "w-2.5 bg-slate-300 hover:bg-slate-400"
                )}
                key={`indicator-${item.name}`}
                onClick={() => setActiveIndex(index)}
                type="button"
              />
            ))}
          </div>
        </CardBody>
      </Card>

      <Card className="border-slate-200/90 bg-[#0b1724] text-slate-100 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.9)]">
        <CardBody className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/90">Security posture</p>
          <h3 className="text-xl font-semibold text-white">Institution-grade controls from day one</h3>
          <div className="space-y-2">
            {securityPillars.map((pillar) => (
              <div className="rounded-xl bg-white/10 px-3 py-2 text-sm" key={pillar}>
                {pillar}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-300">
            Auth events, permission changes, and session operations are tracked for forensic traceability.
          </p>
        </CardBody>
      </Card>
    </section>
  );
};
