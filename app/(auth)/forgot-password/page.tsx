import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forms";
import { requestPasswordResetAction } from "@/app/(auth)/actions";

export const metadata: Metadata = {
  title: "Forgot Password | Core Banking MVP"
};

type ForgotPasswordPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      subtitle="Recover access securely. Reset links are tied to your signed email and short-lived sessions."
      title="Password Recovery"
    >
      <ForgotPasswordForm
        action={requestPasswordResetAction}
        error={params?.error}
        message={params?.message}
      />
    </AuthShell>
  );
}
