import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export const AuthShell = ({ title, subtitle, children }: AuthShellProps) => {
  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[radial-gradient(circle_at_15%_15%,rgba(20,184,166,0.16),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(2,132,199,0.12),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef6f9_100%)] px-4 py-10 sm:px-6 lg:px-10">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500" />
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <section className="rounded-3xl border border-white/70 bg-white/70 p-7 shadow-[0_30px_70px_-45px_rgba(8,47,73,0.5)] backdrop-blur lg:p-10">
          <Badge tone="info">Core Banking Security</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Trusted identity operations for modern banking teams.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            Multi-tenant authentication, role-aware controls, and immutable audit trails. Built for
            regulated operations with a premium operator experience.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Security posture</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">Adaptive Session Controls</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Audit integrity</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">Hash-chained Event Logs</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Authorization</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">Role + Permission Matrix</p>
            </Card>
          </div>
        </section>

        <section>
          <Card className="auth-card-fade rounded-3xl border-white/80 p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </Card>
        </section>
      </div>
    </main>
  );
};
