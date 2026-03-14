import { randomUUID } from "crypto";

import { fail, ok } from "@/lib/api/response";
import { safeLogAuditEvent } from "@/lib/audit/logger";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { documentPlaceholderSchema } from "@/lib/validations/onboarding";

type RouteContext = { params: Promise<{ customerId: string }> };

const DOCUMENT_BUCKET = "customer-documents";
const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const toSafeFileName = (fileName: string): string => {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
};

const canReadOnboardingDocuments = (permissions: string[]): boolean => {
  return permissions.includes("customer:read") || permissions.includes("customer:write");
};

export async function GET(request: Request, context: RouteContext) {
  const { customerId } = await context.params;
  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);
  if (!canReadOnboardingDocuments(auth.permissions)) return fail("Forbidden", 403);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customer_documents")
    .select(
      "id, document_type, storage_path, file_name, mime_type, file_size_bytes, status, created_at"
    )
    .eq("customer_id", customerId)
    .eq("tenant_id", auth.tenantId)
    .order("created_at", { ascending: false });

  if (error) return fail(error.message, 500);

  const documentsWithUrls = await Promise.all(
    (data ?? []).map(async (document) => {
      let downloadUrl: string | null = null;
      if (document.storage_path !== "pending" && document.storage_path) {
        const signedUrlResponse = await supabase.storage
          .from(DOCUMENT_BUCKET)
          .createSignedUrl(document.storage_path, 60 * 10);

        if (!signedUrlResponse.error) {
          downloadUrl = signedUrlResponse.data.signedUrl;
        }
      }

      return {
        id: document.id,
        documentType: document.document_type,
        storagePath: document.storage_path,
        fileName: document.file_name,
        mimeType: document.mime_type,
        fileSizeBytes: document.file_size_bytes,
        status: document.status,
        createdAt: document.created_at,
        downloadUrl
      };
    })
  );

  return ok({ documents: documentsWithUrls });
}

export async function POST(request: Request, context: RouteContext) {
  const { customerId } = await context.params;
  const auth = await getAuthContext(request);
  if (!auth) return fail("Unauthenticated", 401);
  if (!hasPermissionInContext(auth, "customer:write")) return fail("Forbidden", 403);

  const supabase = await createServerSupabaseClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();
  if (!customer) return fail("Customer not found", 404);

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const parsed = documentPlaceholderSchema.safeParse({
      tenantId: auth.tenantId,
      customerId,
      documentType: String(formData.get("documentType") ?? "")
    });

    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid document upload payload", 422);
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return fail("Document file is required", 422);
    }

    if (file.size <= 0) {
      return fail("Document file cannot be empty", 422);
    }

    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      return fail("Document file exceeds 10 MB limit", 422);
    }

    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.type)) {
      return fail("Unsupported document mime type", 422);
    }

    const safeName = toSafeFileName(file.name || `${parsed.data.documentType}.dat`);
    const storagePath = `${auth.tenantId}/${customerId}/${Date.now()}-${randomUUID()}-${safeName}`;

    const uploadResult = await supabase.storage.from(DOCUMENT_BUCKET).upload(storagePath, file, {
      contentType: file.type,
      upsert: false
    });

    if (uploadResult.error) {
      return fail(uploadResult.error.message, 409);
    }

    const { data: insertedDocument, error: insertError } = await supabase
      .from("customer_documents")
      .insert({
        tenant_id: auth.tenantId,
        customer_id: customerId,
        document_type: parsed.data.documentType,
        storage_path: storagePath,
        file_name: safeName,
        mime_type: file.type,
        file_size_bytes: file.size,
        uploaded_by: auth.userId,
        status: "uploaded"
      })
      .select(
        "id, document_type, storage_path, file_name, mime_type, file_size_bytes, status, created_at"
      )
      .single();

    if (insertError || !insertedDocument) {
      return fail(insertError?.message ?? "Unable to save uploaded document", 409);
    }

    const signedUrlResponse = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(storagePath, 60 * 10);

    await safeLogAuditEvent({
      tenantId: auth.tenantId,
      actorId: auth.userId,
      action: "onboarding.document_uploaded",
      resourceType: "customer_documents",
      resourceId: insertedDocument.id,
      metadata: {
        customerId,
        documentType: parsed.data.documentType,
        fileSizeBytes: file.size
      }
    });

    return ok(
      {
        document: {
          id: insertedDocument.id,
          documentType: insertedDocument.document_type,
          storagePath: insertedDocument.storage_path,
          fileName: insertedDocument.file_name,
          mimeType: insertedDocument.mime_type,
          fileSizeBytes: insertedDocument.file_size_bytes,
          status: insertedDocument.status,
          createdAt: insertedDocument.created_at,
          downloadUrl: signedUrlResponse.error ? null : signedUrlResponse.data.signedUrl
        }
      },
      201
    );
  }

  const body = await request.json();
  const parsed = documentPlaceholderSchema.safeParse({ ...body, customerId, tenantId: auth.tenantId });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid document payload", 422);

  const { data, error } = await supabase
    .from("customer_documents")
    .insert({
      tenant_id: auth.tenantId,
      customer_id: customerId,
      document_type: parsed.data.documentType,
      storage_path: "pending",
      status: "pending"
    })
    .select("id, document_type, status")
    .single();

  if (error) return fail(error.message, 409);

  await safeLogAuditEvent({
    tenantId: auth.tenantId,
    actorId: auth.userId,
    action: "onboarding.document_placeholder_created",
    resourceType: "customer_documents",
    resourceId: data.id,
    metadata: { customerId, documentType: parsed.data.documentType }
  });

  return ok({ document: { id: data.id, documentType: data.document_type, status: data.status } }, 201);
}
