import { redirect } from "next/navigation";
import Link from "next/link";

import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { getAuthContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const context = await getAuthContext();

  if (!context) {
    redirect("/unauthorized?reason=tenant_access_required");
  }

  return (
    <section className="min-h-screen bg-[linear-gradient(180deg,#f8fbfd_0%,#f2f7fb_100%)]">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Fintech Ops</p>
              <p className="text-sm font-semibold text-slate-900">Core Banking Console</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-1.5 text-sm">
            <Link className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100" href="/accounts">
              Accounts
            </Link>
            <Link className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100" href="/customers">
              Customers
            </Link>
            <Link
              className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100"
              href="/transactions"
            >
              Transactions
            </Link>
            <Link className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100" href="/loans">
              Loans
            </Link>
            <Link className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100" href="/payments">
              Payments
            </Link>
            <Link className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100" href="/compliance">
              Compliance
            </Link>
            <Link className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100" href="/admin">
              Admin
            </Link>
            <Link className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100" href="/profile">
              Profile
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Badge tone="info">{user.email ?? "signed-in-user"}</Badge>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1400px]">
        <div className="px-2 pb-8 pt-4 sm:px-4">{children}</div>
      </div>
    </section>
  );
}
