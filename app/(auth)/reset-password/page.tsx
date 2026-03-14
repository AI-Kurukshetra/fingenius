import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/forms";
import { updatePasswordAction } from "@/app/(auth)/actions";

export const metadata: Metadata = {
  title: "Set New Password | Core Banking MVP"
};

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      subtitle="Set a new credential and immediately secure your session posture across the platform."
      title="Set New Password"
    >
      <ResetPasswordForm action={updatePasswordAction} error={params?.error} message={params?.message} />
    </AuthShell>
  );
}
