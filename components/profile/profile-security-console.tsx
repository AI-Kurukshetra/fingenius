"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PasswordStrength } from "@/components/auth/password-strength";
import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Tabs } from "@/components/ui/tabs";
import { parseApiResponse } from "@/lib/api/client";

type SessionItem = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastSeenAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

type ProfileSecurityConsoleProps = {
  fullName: string;
  email: string;
  sessions: SessionItem[];
  error?: string;
  message?: string;
};

export const ProfileSecurityConsole = ({
  fullName,
  email,
  sessions,
  error,
  message
}: ProfileSecurityConsoleProps) => {
  const router = useRouter();
  const [nameDraft, setNameDraft] = useState(fullName);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [confirmPasswordDraft, setConfirmPasswordDraft] = useState("");
  const [sessionQuery, setSessionQuery] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isRevokingSessions, setIsRevokingSessions] = useState(false);
  const [serverError, setServerError] = useState<string | null>(error ?? null);
  const [serverMessage, setServerMessage] = useState<string | null>(message ?? null);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const target = `${session.userAgent ?? ""} ${session.ipAddress ?? ""}`.toLowerCase();
      return target.includes(sessionQuery.toLowerCase());
    });
  }, [sessionQuery, sessions]);

  const handleProfileSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setServerMessage(null);
    setIsSavingProfile(true);

    try {
      const formData = new FormData(event.currentTarget);
      await parseApiResponse(
        await fetch("/api/v1/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fullName: String(formData.get("fullName") ?? "").trim()
          })
        })
      );

      setServerMessage("Profile updated.");
      router.refresh();
    } catch (requestError) {
      setServerError(requestError instanceof Error ? requestError.message : "Unable to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setServerMessage(null);

    if (passwordDraft.length < 8 || passwordDraft !== confirmPasswordDraft) {
      setServerError("Password must be at least 8 characters and match confirmation.");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      await parseApiResponse(
        await fetch("/api/v1/auth/update-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            password: passwordDraft
          })
        })
      );

      setPasswordDraft("");
      setConfirmPasswordDraft("");
      setServerMessage("Password updated.");
      router.refresh();
    } catch (requestError) {
      setServerError(
        requestError instanceof Error ? requestError.message : "Unable to update password."
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSessionRevoke = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setServerMessage(null);
    setIsRevokingSessions(true);

    try {
      await parseApiResponse(
        await fetch("/api/v1/profile/revoke-sessions", {
          method: "POST"
        })
      );

      setServerMessage("Active sessions revoked.");
      router.refresh();
    } catch (requestError) {
      setServerError(
        requestError instanceof Error ? requestError.message : "Unable to revoke sessions."
      );
    } finally {
      setIsRevokingSessions(false);
    }
  };

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <section className="rounded-3xl border border-slate-200/70 bg-gradient-to-r from-[#0f172a] via-[#1e3a5f] to-[#0f766e] p-6 text-white shadow-[0_20px_70px_-45px_rgba(15,23,42,0.95)] sm:p-8">
        <Badge className="bg-white/20 text-white" tone="info">
          Profile & Security
        </Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Account Security Center</h1>
        <p className="mt-2 max-w-2xl text-sm text-cyan-100 sm:text-base">
          Manage identity profile details, password controls, and session posture for your tenant account.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge className="bg-white/20 text-white" tone="info">
            {email}
          </Badge>
          <Badge className="bg-white/20 text-white" tone="info">
            {sessions.filter((session) => !session.revokedAt).length} active sessions
          </Badge>
        </div>
      </section>

      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      {serverMessage ? <Alert tone="success">{serverMessage}</Alert> : null}

      <Tabs
        items={[
          {
            key: "profile",
            label: "Profile",
            content: (
              <Card>
                <CardHeader>
                  <h2 className="text-base font-semibold text-slate-900">Profile Details</h2>
                  <p className="mt-1 text-sm text-slate-500">Keep your operator profile accurate.</p>
                </CardHeader>
                <CardBody>
                  <form className="space-y-4" onSubmit={handleProfileSave}>
                    <FormField label="Email">
                      <Input disabled type="email" value={email} />
                    </FormField>
                    <FormField hint="Displayed in internal audit and ownership records" label="Full Name">
                      <Input
                        minLength={2}
                        name="fullName"
                        onChange={(event) => setNameDraft(event.target.value)}
                        required
                        type="text"
                        value={nameDraft}
                      />
                    </FormField>
                    <PendingSubmitButton
                      className="w-full sm:w-auto"
                      isLoading={isSavingProfile}
                      label="Save Profile"
                      pendingLabel="Saving..."
                    />
                  </form>
                </CardBody>
              </Card>
            )
          },
          {
            key: "security",
            label: "Security",
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <h2 className="text-base font-semibold text-slate-900">Password Rotation</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Rotate your password periodically to maintain strong security posture.
                    </p>
                  </CardHeader>
                  <CardBody>
                    <form className="space-y-4" onSubmit={handlePasswordUpdate}>
                      <FormField label="New Password">
                        <PasswordInput
                          minLength={8}
                          name="password"
                          onChange={(event) => setPasswordDraft(event.target.value)}
                          required
                          value={passwordDraft}
                        />
                        <PasswordStrength value={passwordDraft} />
                      </FormField>
                      <FormField
                        error={
                          confirmPasswordDraft && confirmPasswordDraft !== passwordDraft
                            ? "Passwords do not match"
                            : null
                        }
                        label="Confirm New Password"
                      >
                        <PasswordInput
                          minLength={8}
                          onChange={(event) => setConfirmPasswordDraft(event.target.value)}
                          required
                          value={confirmPasswordDraft}
                        />
                      </FormField>
                      <PendingSubmitButton
                        className="w-full sm:w-auto"
                        isLoading={isUpdatingPassword}
                        label="Update Password"
                        pendingLabel="Saving..."
                      />
                    </form>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <h2 className="text-base font-semibold text-slate-900">Session Controls</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Invalidate every active session token for this operator account.
                    </p>
                  </CardHeader>
                  <CardBody>
                    <form className="space-y-3" onSubmit={handleSessionRevoke}>
                      <p className="text-sm text-slate-600">
                        Recommended after sensitive permission changes or shared device usage.
                      </p>
                      <Button disabled={isRevokingSessions} type="submit" variant="secondary">
                        {isRevokingSessions ? "Revoking..." : "Revoke All Sessions"}
                      </Button>
                    </form>
                  </CardBody>
                </Card>
              </div>
            )
          },
          {
            key: "sessions",
            label: "Sessions",
            content: (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Active Sessions</h2>
                    <Badge tone="neutral">{filteredSessions.length} records</Badge>
                  </div>
                  <Input
                    onChange={(event) => setSessionQuery(event.target.value)}
                    placeholder="Filter by user agent or IP"
                    value={sessionQuery}
                  />
                </CardHeader>
                <CardBody>
                  {filteredSessions.length === 0 ? (
                    <EmptyState
                      description="No sessions found for the current filter."
                      title="No sessions"
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-slate-500">
                            <th className="pb-2 pr-3 font-medium">Status</th>
                            <th className="pb-2 pr-3 font-medium">User Agent</th>
                            <th className="pb-2 pr-3 font-medium">IP</th>
                            <th className="pb-2 pr-3 font-medium">Last Seen</th>
                            <th className="pb-2 font-medium">Expires</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSessions.map((session) => (
                            <tr className="border-b border-slate-100 align-top" key={session.id}>
                              <td className="py-3 pr-3">
                                <Badge tone={session.revokedAt ? "danger" : "success"}>
                                  {session.revokedAt ? "Revoked" : "Active"}
                                </Badge>
                              </td>
                              <td className="py-3 pr-3 text-slate-700">{session.userAgent ?? "Unknown"}</td>
                              <td className="py-3 pr-3 font-mono text-xs text-slate-700">
                                {session.ipAddress ?? "-"}
                              </td>
                              <td className="py-3 pr-3 text-slate-600">
                                {new Date(session.lastSeenAt).toLocaleString()}
                              </td>
                              <td className="py-3 text-slate-600">
                                {session.expiresAt ? new Date(session.expiresAt).toLocaleString() : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardBody>
              </Card>
            )
          }
        ]}
      />
    </main>
  );
};
