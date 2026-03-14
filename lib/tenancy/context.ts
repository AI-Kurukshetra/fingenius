import { headers } from "next/headers";

export const getTenantIdFromHeaders = async (): Promise<string | null> => {
  const headerStore = await headers();
  return headerStore.get("x-tenant-id");
};

export const assertTenantScope = (
  requestedTenantId: string,
  effectiveTenantId: string | null
): void => {
  if (!effectiveTenantId || requestedTenantId !== effectiveTenantId) {
    throw new Error("Tenant scope violation");
  }
};
