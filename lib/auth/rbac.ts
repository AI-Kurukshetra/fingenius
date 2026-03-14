export type Role =
  | "admin"
  | "ops"
  | "compliance_officer"
  | "teller"
  | "customer_support";

export type Permission =
  | "admin:manage_users"
  | "admin:manage_permissions"
  | "customer:write"
  | "account:write"
  | "transaction:approve"
  | "transaction:reverse"
  | "loan:approve"
  | "compliance:manage"
  | "audit:read"
  | "transaction:create"
  | "loan:write"
  | "report:read"
  | "kyc:review"
  | "aml:review"
  | "customer:read"
  | "account:read"
  | "transaction:cash"
  | "transaction:read"
  | "notification:send";

export const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    "admin:manage_users",
    "admin:manage_permissions",
    "customer:write",
    "account:write",
    "transaction:approve",
    "transaction:reverse",
    "loan:approve",
    "compliance:manage",
    "audit:read"
  ],
  ops: [
    "customer:write",
    "account:write",
    "transaction:create",
    "transaction:approve",
    "loan:write",
    "report:read"
  ],
  compliance_officer: ["compliance:manage", "kyc:review", "aml:review", "audit:read"],
  teller: ["customer:read", "account:read", "transaction:create", "transaction:cash"],
  customer_support: ["customer:read", "account:read", "transaction:read", "notification:send"]
};

export const legacyMembershipRoleMap = {
  platform_admin: "admin",
  tenant_admin: "admin",
  operations: "ops",
  compliance_officer: "compliance_officer",
  relationship_manager: "customer_support",
  customer: "customer_support"
} as const;

export type LegacyMembershipRole = keyof typeof legacyMembershipRoleMap;

export const hasPermission = (role: Role, permission: Permission | string): boolean => {
  return rolePermissions[role].includes(permission as Permission);
};

export const mapLegacyMembershipRole = (legacyRole: string): Role | null => {
  return (legacyMembershipRoleMap as Record<string, Role | undefined>)[legacyRole] ?? null;
};

export const getPermissionsForRoles = (roles: Role[]): Permission[] => {
  const combined = new Set<Permission>();

  for (const role of roles) {
    for (const permission of rolePermissions[role]) {
      combined.add(permission);
    }
  }

  return [...combined];
};
