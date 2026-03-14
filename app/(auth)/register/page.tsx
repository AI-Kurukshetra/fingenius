import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/forms";
import { signupAction } from "@/app/(auth)/actions";

export const metadata: Metadata = {
  title: "Register | Core Banking MVP"
};

type RegisterPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      subtitle="Create secure operator access with built-in validation and strong credential requirements."
      title="Create Account"
    >
      <RegisterForm action={signupAction} error={params?.error} message={params?.message} />
    </AuthShell>
  );
}
