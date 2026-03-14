import { createHash } from "crypto";

export const computeAuditHash = (input: {
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  at: string;
  previousHash: string | null;
}): string => {
  const payload = [
    input.tenantId,
    input.actorId,
    input.action,
    input.resourceType,
    input.resourceId,
    input.at,
    input.previousHash ?? ""
  ].join("|");

  return createHash("sha256").update(payload).digest("hex");
};
