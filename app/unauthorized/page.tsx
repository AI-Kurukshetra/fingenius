import Link from "next/link";
import type { Metadata } from "next";

import { PublicLayout } from "@/components/public/public-layout";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Access Denied | Core Banking MVP"
};

type UnauthorizedPageProps = {
  searchParams?: Promise<{
    reason?: string;
  }>;
};

const reasonMap: Record<string, string> = {
  admin_permission_required: "Your account does not currently have administrative permission.",
  tenant_access_required:
    "Your account is authenticated but has no tenant access yet. Ask your admin to assign membership and role.",
  default: "Your current role cannot access this section."
};

export default async function UnauthorizedPage({ searchParams }: UnauthorizedPageProps) {
  const params = await searchParams;
  const description = reasonMap[params?.reason ?? ""] ?? reasonMap.default;

  return (
    <PublicLayout>
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(15,118,110,0.15),transparent_40%),linear-gradient(180deg,#f8fafc_0%,#eef5fa_100%)] px-4 py-10">
        <Card className="max-w-xl rounded-3xl p-3">
          <CardBody className="rounded-2xl bg-white/95 p-8 text-center sm:p-10">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Access Control</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Access Denied</h1>
            <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/accounts">
                <Button>Go to Accounts</Button>
              </Link>
              <Link href="/login">
                <Button variant="secondary">Switch Account</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </main>
    </PublicLayout>
  );
}
