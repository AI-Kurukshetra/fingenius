import { fail } from "@/lib/api/response";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { readDocumentFile } from "@/lib/onboarding/document-storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ customerId: string; documentId: string }> };

export const runtime = "nodejs";

const canReadOnboardingDocuments = (permissions: string[]): boolean => {
  return permissions.includes("customer:read") || permissions.includes("customer:write");
};

const sanitizeFileName = (fileName: string): string => {
  return fileName.replace(/[^\w.-]/g, "_");
};

const inferMimeTypeFromFileName = (fileName: string): string => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
};

export async function GET(request: Request, context: RouteContext) {
  const { customerId, documentId } = await context.params;
  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);
  if (!canReadOnboardingDocuments(auth.permissions)) return fail("Forbidden", 403);

  const supabase = await createServerSupabaseClient();
  const { data: document, error } = await supabase
    .from("customer_documents")
    .select("id, customer_id, storage_path, file_name, status")
    .eq("tenant_id", auth.tenantId)
    .eq("customer_id", customerId)
    .eq("id", documentId)
    .maybeSingle();

  if (error) return fail(error.message, 500);
  if (!document) return fail("Document not found", 404);
  if (!document.storage_path || document.storage_path === "pending" || document.status === "pending") {
    return fail("Document file is not available yet", 404);
  }

  try {
    const fileBuffer = await readDocumentFile(document.storage_path);
    const fileName = sanitizeFileName(document.file_name || `${document.id}.dat`);

    return new Response(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": inferMimeTypeFromFileName(fileName),
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store, max-age=0"
      }
    });
  } catch {
    return fail("Stored document file is missing", 404);
  }
}
