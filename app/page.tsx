import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { FaqAccordion } from "@/components/home/faq-accordion";
import { FeatureExplorer } from "@/components/home/feature-explorer";
import { HomeFooter } from "@/components/home/footer";
import { HeroDashboardPreview } from "@/components/home/hero-dashboard-preview";
import { IntegrationShowcase } from "@/components/home/integration-showcase";
import { KpiSkeleton } from "@/components/home/kpi-skeleton";
import { LiveKpiSection } from "@/components/home/live-kpi-section";
import { TrustCarousel } from "@/components/home/trust-carousel";
import { PublicLayout } from "@/components/public/public-layout";
import { Badge } from "@/components/ui/badge";
import { getAuthContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Core Banking MVP | Fintech Operating Platform",
  description:
    "Cloud-native core banking MVP for onboarding, accounts, ledger transactions, loan origination, compliance monitoring, and admin governance."
};

const overviewSteps = [
  {
    id: "discover",
    title: "Onboard and verify customers",
    description:
      "Drive faster customer activation with KYC-aware onboarding workflows and tenant-safe identity records.",
    href: "/customers"
  },
  {
    id: "operate",
    title: "Operate accounts and payments",
    description:
      "Manage account lifecycle, initiate transfers, and keep transaction state visible to operations teams.",
    href: "/accounts"
  },
  {
    id: "govern",
    title: "Govern risk and access",
    description:
      "Enforce RBAC permissions, review compliance events, and inspect immutable audit history in one control surface.",
    href: "/admin"
  }
];

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const context = user ? await getAuthContext() : null;
  const isAuthenticated = Boolean(user);
  const isAdmin = context?.roles.includes("admin") ?? false;

  const primaryHref = isAuthenticated ? "/accounts" : "/register";
  const primaryLabel = isAuthenticated ? "Open dashboard" : "Create workspace";

  const secondaryHref = isAuthenticated ? (isAdmin ? "/admin" : "/profile") : "/login";
  const secondaryLabel = isAuthenticated
    ? (isAdmin ? "Manage access" : "Profile & security")
    : "Sign in";

  return (
    <PublicLayout>
      <main className="relative overflow-x-clip bg-[radial-gradient(circle_at_top,_#e8f4ff_0%,_#f4f8fb_45%,_#f7fafc_100%)] pb-10">
        <div className="pointer-events-none absolute inset-x-0 top-[-220px] h-[520px] bg-[radial-gradient(circle,_rgba(14,165,233,0.23)_0%,_rgba(148,163,184,0)_65%)]" />
        <div className="pointer-events-none absolute right-[-120px] top-[360px] h-72 w-72 rounded-full bg-cyan-100/70 blur-3xl" />

        <section className="relative mx-auto max-w-[1250px] px-4 pb-14 pt-10 sm:px-6 lg:px-8 lg:pb-16">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-6">
              <Badge tone="info" className="w-fit">Cloud-native core banking, ready for launch</Badge>
              <div className="space-y-4">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                  Run onboarding, ledger operations, and compliance from one trusted platform.
                </h1>
                <p className="max-w-xl text-base text-slate-600 sm:text-lg">
                  A premium, API-first banking control plane for fintech teams building secure account,
                  transaction, and loan products without compromising governance.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  className="inline-flex h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
                  href={primaryHref}
                >
                  {primaryLabel}
                </Link>
                <Link
                  className="inline-flex h-11 items-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-100"
                  href={secondaryHref}
                >
                  {secondaryLabel}
                </Link>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-600">
                {isAuthenticated ? (
                  <p>
                    Signed in as <span className="font-semibold text-slate-800">{user?.email}</span>
                    {context ? " with active tenant permissions." : " but awaiting tenant role assignment."}
                  </p>
                ) : (
                  <p>
                    Start with signup, then seed demo data to unlock tenant dashboards, KPIs, and admin controls.
                  </p>
                )}
              </div>
            </div>

            <HeroDashboardPreview />
          </div>
        </section>

        <section className="mx-auto max-w-[1250px] px-4 py-8 sm:px-6 lg:px-8">
          <Suspense fallback={<KpiSkeleton />}>
            <LiveKpiSection />
          </Suspense>
        </section>

        <section className="mx-auto max-w-[1250px] px-4 py-8 sm:px-6 lg:px-8" id="features">
          <FeatureExplorer isAuthenticated={isAuthenticated} roles={context?.roles ?? []} />
        </section>

        <section className="mx-auto max-w-[1250px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="lg:sticky lg:top-20 lg:h-fit">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Product overview</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">Operational flow built for scale</h2>
              <p className="mt-2 text-sm text-slate-600">
                Each stage keeps customer operations, financial records, and governance controls connected.
              </p>
            </div>

            <div className="space-y-3">
              {overviewSteps.map((step, index) => (
                <article
                  className="group rounded-2xl border border-slate-200 bg-white/95 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-[0_18px_36px_-28px_rgba(6,182,212,0.65)] sm:p-5"
                  key={step.id}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Step {index + 1}</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{step.description}</p>
                  <Link
                    className="mt-3 inline-flex text-sm font-semibold text-slate-800 underline-offset-4 transition group-hover:text-cyan-700 group-hover:underline"
                    href={step.href}
                  >
                    Open module
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1250px] px-4 py-8 sm:px-6 lg:px-8" id="security">
          <TrustCarousel />
        </section>

        <section className="mx-auto max-w-[1250px] px-4 py-8 sm:px-6 lg:px-8" id="integrations">
          <IntegrationShowcase />
        </section>

        <section className="mx-auto max-w-[1250px] px-4 py-8 sm:px-6 lg:px-8" id="faq">
          <FaqAccordion />
        </section>

        <section className="mx-auto max-w-[1250px] px-4 pt-8 sm:px-6 lg:px-8">
          <HomeFooter />
        </section>
      </main>
    </PublicLayout>
  );
}
