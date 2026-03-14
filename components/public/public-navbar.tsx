"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PublicNavbarProps = {
  isAuthenticated: boolean;
  isAdmin: boolean;
};

type NavItem = {
  href: string;
  label: string;
};

const publicLinks: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/#features", label: "Features" },
  { href: "/#security", label: "Security" },
  { href: "/#faq", label: "About" }
];

const actionItems = (isAuthenticated: boolean, isAdmin: boolean): NavItem[] => {
  if (isAuthenticated) {
    return [
      { href: "/accounts", label: "Dashboard" },
      { href: isAdmin ? "/admin" : "/profile", label: isAdmin ? "Admin" : "Profile" }
    ];
  }

  return [
    { href: "/login", label: "Login" },
    { href: "/register", label: "Register" }
  ];
};

export const PublicNavbar = ({ isAuthenticated, isAdmin }: PublicNavbarProps) => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentHash, setCurrentHash] = useState("");

  useEffect(() => {
    const syncHash = () => {
      if (typeof window !== "undefined") {
        setCurrentHash(window.location.hash.toLowerCase());
      }
    };

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => {
      window.removeEventListener("hashchange", syncHash);
    };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname, currentHash]);

  const actions = useMemo(() => actionItems(isAuthenticated, isAdmin), [isAdmin, isAuthenticated]);

  const isLinkActive = (href: string): boolean => {
    if (href.startsWith("/#")) {
      return pathname === "/" && currentHash === href.slice(1).toLowerCase();
    }

    if (href === "/") {
      return pathname === "/" && (currentHash === "" || currentHash === "#top");
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/78 backdrop-blur-xl">
      <div className="mx-auto max-w-[1250px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link
            className="group inline-flex items-center gap-3 rounded-xl px-1 py-1 transition hover:bg-slate-100/80"
            href="/"
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 shadow-[0_8px_18px_-10px_rgba(6,182,212,0.9)] transition duration-200 group-hover:scale-[1.03]" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Fintech Platform</p>
              <p className="text-sm font-semibold text-slate-900">Core Banking MVP</p>
            </div>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {publicLinks.map((item) => {
              const active = isLinkActive(item.href);

              return (
                <Link
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-slate-900 text-white shadow-[0_10px_16px_-14px_rgba(15,23,42,1)]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:-translate-y-0.5"
                  )}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {actions.map((item, index) => {
              const active = isLinkActive(item.href);
              const isPrimary = index === 0;

              return (
                <Link href={item.href} key={item.href}>
                  <Button
                    className={cn(
                      "transition duration-200 hover:-translate-y-0.5",
                      active && "ring-2 ring-cyan-300 ring-offset-1"
                    )}
                    size="sm"
                    variant={isPrimary ? "primary" : "secondary"}
                  >
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>

          <button
            aria-controls="public-mobile-menu"
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 md:hidden"
            onClick={() => setIsMobileMenuOpen((value) => !value)}
            type="button"
          >
            <span className="sr-only">Menu</span>
            <div className="flex flex-col gap-1.5">
              <span
                className={cn(
                  "h-0.5 w-5 rounded-full bg-current transition-transform duration-200",
                  isMobileMenuOpen && "translate-y-2 rotate-45"
                )}
              />
              <span
                className={cn(
                  "h-0.5 w-5 rounded-full bg-current transition-opacity duration-200",
                  isMobileMenuOpen && "opacity-0"
                )}
              />
              <span
                className={cn(
                  "h-0.5 w-5 rounded-full bg-current transition-transform duration-200",
                  isMobileMenuOpen && "-translate-y-2 -rotate-45"
                )}
              />
            </div>
          </button>
        </div>

        <div
          className={cn(
            "overflow-hidden border-t border-slate-200/80 transition-all duration-200 md:hidden",
            isMobileMenuOpen ? "max-h-[420px] pb-4 opacity-100" : "max-h-0 opacity-0"
          )}
          id="public-mobile-menu"
        >
          <nav aria-label="Mobile primary" className="flex flex-col gap-1 pt-3">
            {publicLinks.map((item) => {
              const active = isLinkActive(item.href);

              return (
                <Link
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                  )}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {actions.map((item, index) => (
              <Link className="w-full" href={item.href} key={item.href}>
                <Button className="w-full" size="sm" variant={index === 0 ? "primary" : "secondary"}>
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};
