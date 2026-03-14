import Link from "next/link";

const productLinks = [
  { href: "/customers", label: "Onboarding" },
  { href: "/accounts", label: "Accounts" },
  { href: "/transactions", label: "Transactions" },
  { href: "/loans", label: "Loans" },
  { href: "/compliance", label: "Compliance" }
];

const companyLinks = [
  { href: "/admin", label: "Admin" },
  { href: "/profile", label: "Profile & Security" },
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" }
];

export const HomeFooter = () => {
  return (
    <footer className="rounded-3xl border border-slate-200 bg-white/95 px-5 py-6 shadow-[0_20px_40px_-35px_rgba(15,23,42,0.5)] sm:px-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Core Banking MVP</p>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            A cloud-native, API-first operating core built for secure onboarding, transaction integrity,
            compliance oversight, and scalable financial operations.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">Product</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {productLinks.map((item) => (
              <li key={item.href}>
                <Link className="transition hover:text-slate-900" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">Platform</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {companyLinks.map((item) => (
              <li key={item.href}>
                <Link className="transition hover:text-slate-900" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
        © {new Date().getFullYear()} Core Banking MVP. Built for fintech operators and compliance teams.
      </div>
    </footer>
  );
};
