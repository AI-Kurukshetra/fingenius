import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/forms";
import { loginAction } from "@/app/(auth)/actions";

export const metadata: Metadata = {
  title: "Login | Core Banking MVP"
};

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      subtitle="Authenticate with your institution credentials and access tenant-scoped operations."
      title="Sign In"
    >
      <LoginForm action={loginAction} error={params?.error} message={params?.message} />
    </AuthShell>
  );
}
