"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { parseApiResponse } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type PermissionMatrixRow = {
  role: string;
  permissions: string[];
};

type RoleAssignment = {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
};

type DirectoryUser = {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
  assignedRoles: string[];
};

type AuditRow = {
  id: string;
  createdAt: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorId: string;
  metadata: string;
};

type AdminMetrics = {
  customers: number;
  accounts: number;
  postedTransactions: number;
  openComplianceAlerts: number;
  activeSessions: number;
};

type AdminConsoleProps = {
  tenantId: string;
  error?: string;
  message?: string;
  permissionMatrix: PermissionMatrixRow[];
  assignments: RoleAssignment[];
  users: DirectoryUser[];
  auditRows: AuditRow[];
  metrics: AdminMetrics;
};

const roleTone = (role: string): "info" | "success" | "warning" | "danger" | "neutral" => {
  if (role === "super_admin") return "danger";
  if (role === "admin") return "danger";
  if (role === "compliance_officer") return "warning";
  if (role === "ops") return "info";
  if (role === "teller") return "success";
  return "neutral";
};

export const AdminConsole = ({
  tenantId,
  error,
  message,
  permissionMatrix,
  assignments,
  users,
  auditRows,
  metrics
}: AdminConsoleProps) => {
  const router = useRouter();
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");
  const [auditQuery, setAuditQuery] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [isApplyingAccess, setIsApplyingAccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(error ?? null);
  const [serverMessage, setServerMessage] = useState<string | null>(message ?? null);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const rolePass =
        selectedRoleFilter === "all" || user.assignedRoles.some((role) => role === selectedRoleFilter);
      const normalizedQuery = directoryQuery.toLowerCase();
      const queryPass =
        user.fullName.toLowerCase().includes(normalizedQuery) ||
        user.email.toLowerCase().includes(normalizedQuery) ||
        user.assignedRoles.some((role) => role.toLowerCase().includes(normalizedQuery));

      return rolePass && queryPass;
    });
  }, [directoryQuery, selectedRoleFilter, users]);

  const uniqueAuditActions = useMemo(() => {
    return [...new Set(auditRows.map((row) => row.action))];
  }, [auditRows]);

  const filteredAuditRows = useMemo(() => {
    return auditRows.filter((row) => {
      const actionPass = auditActionFilter === "all" || row.action === auditActionFilter;
      const queryPass =
        row.actorId.toLowerCase().includes(auditQuery.toLowerCase()) ||
        row.resourceId.toLowerCase().includes(auditQuery.toLowerCase()) ||
        row.action.toLowerCase().includes(auditQuery.toLowerCase());

      return actionPass && queryPass;
    });
  }, [auditActionFilter, auditQuery, auditRows]);

  const handleApplyAccess = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setServerMessage(null);
    setIsApplyingAccess(true);

    try {
      const formData = new FormData(event.currentTarget);

      await parseApiResponse(
        await fetch("/api/v1/admin/permissions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            tenantId,
            userId: String(formData.get("userId") ?? ""),
            role: String(formData.get("role") ?? ""),
            action: String(formData.get("action") ?? "")
          })
        })
      );

      setServerMessage("Access updated successfully.");
      router.refresh();
    } catch (requestError) {
      setServerError(requestError instanceof Error ? requestError.message : "Unable to update access.");
    } finally {
      setIsApplyingAccess(false);
    }
  };

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <section className="rounded-3xl border border-slate-200/70 bg-gradient-to-r from-[#023047] via-[#0b4f6c] to-[#036666] p-6 text-white shadow-[0_20px_70px_-45px_rgba(2,48,71,0.9)] sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="bg-white/20 text-white" tone="info">
            RBAC + Audit Control Center
          </Badge>
          <Badge className="bg-white/20 text-white" tone="info">
            Tenant: {tenantId}
          </Badge>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Authorization Operations</h1>
        <p className="mt-2 max-w-2xl text-sm text-cyan-50 sm:text-base">
          Manage role grants, verify permission coverage, and inspect immutable audit trails from one
          place.
        </p>
        {serverError ? (
          <p className="mt-4 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {serverError}
          </p>
        ) : null}
        {serverMessage ? (
          <p className="mt-4 rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {serverMessage}
          </p>
        ) : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100">Customers</p>
            <p className="text-lg font-semibold text-white">{metrics.customers}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100">Accounts</p>
            <p className="text-lg font-semibold text-white">{metrics.accounts}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100">Posted Txns</p>
            <p className="text-lg font-semibold text-white">{metrics.postedTransactions}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100">Open Alerts</p>
            <p className="text-lg font-semibold text-white">{metrics.openComplianceAlerts}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100">Active Sessions</p>
            <p className="text-lg font-semibold text-white">{metrics.activeSessions}</p>
          </div>
        </div>
      </section>

      <Tabs
        items={[
          {
            key: "roles",
            label: "Role Management",
            content: (
              <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
                <Card>
                  <CardHeader>
                    <h2 className="text-base font-semibold text-slate-900">Assign Access</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Select a user by email, choose role and action. Tenant membership is synced automatically.
                    </p>
                  </CardHeader>
                  <CardBody>
                    {users.length === 0 ? (
                      <EmptyState
                        description="No users are available yet. Ask users to sign up first."
                        title="No users found"
                      />
                    ) : (
                      <form className="space-y-3" onSubmit={handleApplyAccess}>
                        <input name="tenantId" type="hidden" value={tenantId} />

                        <label className="block text-sm">
                          <span className="mb-1 block font-medium text-slate-700">User</span>
                          <select
                            className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                            defaultValue={users[0]?.id}
                            name="userId"
                          >
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.fullName} ({user.email})
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block text-sm">
                          <span className="mb-1 block font-medium text-slate-700">Role</span>
                          <select
                            className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                            name="role"
                          >
                            <option value="super_admin">super_admin</option>
                            <option value="admin">admin</option>
                            <option value="ops">ops</option>
                            <option value="compliance_officer">compliance_officer</option>
                            <option value="teller">teller</option>
                            <option value="customer_support">customer_support</option>
                          </select>
                        </label>

                        <label className="block text-sm">
                          <span className="mb-1 block font-medium text-slate-700">Action</span>
                          <select
                            className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                            name="action"
                          >
                            <option value="grant">Grant</option>
                            <option value="revoke">Revoke</option>
                          </select>
                        </label>

                        <PendingSubmitButton
                          className="w-full"
                          isLoading={isApplyingAccess}
                          label="Apply Change"
                          pendingLabel="Applying..."
                        />
                      </form>
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-base font-semibold text-slate-900">User Access Directory</h2>
                      <Badge tone="neutral">
                        {filteredUsers.length} users • {assignments.length} grants
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        onChange={(event) => setDirectoryQuery(event.target.value)}
                        placeholder="Search by name, email, or role"
                        value={directoryQuery}
                      />
                      <select
                        className="h-11 rounded-xl border border-slate-300 px-3 text-sm"
                        onChange={(event) => setSelectedRoleFilter(event.target.value)}
                        value={selectedRoleFilter}
                      >
                        <option value="all">All roles</option>
                        <option value="super_admin">super_admin</option>
                        <option value="admin">admin</option>
                        <option value="ops">ops</option>
                        <option value="compliance_officer">compliance_officer</option>
                        <option value="teller">teller</option>
                        <option value="customer_support">customer_support</option>
                      </select>
                    </div>
                  </CardHeader>
                  <CardBody>
                    {filteredUsers.length === 0 ? (
                      <EmptyState
                        description="No users match the current filters."
                        title="No users found"
                      />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-left text-slate-500">
                              <th className="pb-2 pr-3 font-medium">Name</th>
                              <th className="pb-2 pr-3 font-medium">Email</th>
                              <th className="pb-2 pr-3 font-medium">Assigned Roles</th>
                              <th className="pb-2 pr-3 font-medium">Status</th>
                              <th className="pb-2 font-medium">Joined</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredUsers.map((user) => (
                              <tr className="border-b border-slate-100" key={user.id}>
                                <td className="py-3 pr-3 text-slate-800">{user.fullName}</td>
                                <td className="py-3 pr-3 text-slate-700">{user.email}</td>
                                <td className="py-3 pr-3">
                                  {user.assignedRoles.length === 0 ? (
                                    <span className="text-xs text-slate-500">None</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {user.assignedRoles.map((role) => (
                                        <Badge key={`${user.id}-${role}`} tone={roleTone(role)}>
                                          {role}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 text-slate-600">
                                  <Badge tone={user.assignedRoles.length > 0 ? "success" : "warning"}>
                                    {user.assignedRoles.length > 0 ? "Assigned" : "Awaiting Access"}
                                  </Badge>
                                </td>
                                <td className="py-3 text-slate-600">
                                  {new Date(user.createdAt).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            )
          },
          {
            key: "permissions",
            label: "Permission Matrix",
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                {permissionMatrix.map((entry) => (
                  <Card key={entry.role}>
                    <CardHeader className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-slate-900">{entry.role}</h3>
                      <Badge tone={roleTone(entry.role)}>{entry.permissions.length} permissions</Badge>
                    </CardHeader>
                    <CardBody>
                      <div className="flex flex-wrap gap-2">
                        {entry.permissions.map((permission) => (
                          <span
                            className={cn(
                              "rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
                            )}
                            key={`${entry.role}-${permission}`}
                          >
                            {permission}
                          </span>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )
          },
          {
            key: "audit",
            label: "Audit Logs",
            content: (
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Security & Authorization Events</h2>
                    <Badge tone="info">{filteredAuditRows.length} events</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      onChange={(event) => setAuditQuery(event.target.value)}
                      placeholder="Search action, actor id, resource id"
                      value={auditQuery}
                    />
                    <select
                      className="h-11 rounded-xl border border-slate-300 px-3 text-sm"
                      onChange={(event) => setAuditActionFilter(event.target.value)}
                      value={auditActionFilter}
                    >
                      <option value="all">All actions</option>
                      {uniqueAuditActions.map((action) => (
                        <option key={action} value={action}>
                          {action}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardHeader>
                <CardBody>
                  {filteredAuditRows.length === 0 ? (
                    <EmptyState
                      description="No audit events found for the current filter."
                      title="No audit entries"
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-slate-500">
                            <th className="pb-2 pr-3 font-medium">Time</th>
                            <th className="pb-2 pr-3 font-medium">Action</th>
                            <th className="pb-2 pr-3 font-medium">Actor</th>
                            <th className="pb-2 pr-3 font-medium">Resource</th>
                            <th className="pb-2 font-medium">Metadata</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAuditRows.map((row) => (
                            <tr className="border-b border-slate-100 align-top" key={row.id}>
                              <td className="py-3 pr-3 text-slate-600">
                                {new Date(row.createdAt).toLocaleString()}
                              </td>
                              <td className="py-3 pr-3">
                                <Badge tone="info">{row.action}</Badge>
                              </td>
                              <td className="py-3 pr-3 font-mono text-xs text-slate-700">{row.actorId}</td>
                              <td className="py-3 pr-3 text-slate-700">
                                {row.resourceType}:{" "}
                                <span className="font-mono text-xs">{row.resourceId}</span>
                              </td>
                              <td className="py-3 font-mono text-xs text-slate-600">{row.metadata}</td>
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
