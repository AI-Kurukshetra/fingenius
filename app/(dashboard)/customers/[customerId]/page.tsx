import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OnboardingDetailView } from "@/components/customers/onboarding-detail-view";
import { getAuthContext, hasPermissionInContext } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Onboarding | Core Banking MVP"
};

type PageProps = { params: Promise<{ customerId: string }> };

export default async function CustomerOnboardingDetailPage({ params }: PageProps) {
  const { customerId } = await params;
  const context = await getAuthContext();
  if (!context) redirect("/login");

  const canRead =
    hasPermissionInContext(context, "customer:read") || hasPermissionInContext(context, "customer:write");
  if (!canRead) redirect("/unauthorized?reason=customer_permission_required");

  const supabase = await createServerSupabaseClient();

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select(
      "id, tenant_id, external_customer_ref, full_name, email, phone, country_code, type, kyc_status, risk_tier, onboarding_status, created_at"
    )
    .eq("id", customerId)
    .eq("tenant_id", context.tenantId)
    .maybeSingle();

  if (customerError || !customer) redirect("/customers");

  const [{ data: kyc }, { data: aml }, { data: documents }, { data: reviews }] = await Promise.all([
    supabase
      .from("customer_kyc_details")
      .select("*")
      .eq("customer_id", customerId)
      .eq("tenant_id", context.tenantId)
      .maybeSingle(),
    supabase
      .from("customer_aml_details")
      .select("*")
      .eq("customer_id", customerId)
      .eq("tenant_id", context.tenantId)
      .maybeSingle(),
    supabase
      .from("customer_documents")
      .select("id, document_type, storage_path, file_name, mime_type, file_size_bytes, status, created_at")
      .eq("customer_id", customerId)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("onboarding_reviews")
      .select("id, reviewer_id, action, comment, previous_status, new_status, created_at")
      .eq("customer_id", customerId)
      .eq("tenant_id", context.tenantId)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  const documentsWithUrls = await Promise.all(
    (documents ?? []).map(async (document) => {
      let downloadUrl: string | null = null;
      if (document.storage_path && document.storage_path !== "pending") {
        const signedUrlResponse = await supabase.storage
          .from("customer-documents")
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
        mimeType: (document as { mime_type?: string | null }).mime_type ?? null,
        fileSizeBytes: (document as { file_size_bytes?: number | null }).file_size_bytes ?? null,
        status: document.status,
        createdAt: document.created_at,
        downloadUrl
      };
    })
  );

  const canWrite = hasPermissionInContext(context, "customer:write");
  const canReviewKyc =
    hasPermissionInContext(context, "kyc:review") || hasPermissionInContext(context, "compliance:manage");
  const canReviewAml =
    hasPermissionInContext(context, "aml:review") || hasPermissionInContext(context, "compliance:manage");
  const canReviewCompliance = hasPermissionInContext(context, "compliance:manage");
  const canOpenAccount = hasPermissionInContext(context, "account:write");

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            href="/customers"
          >
            ← Customers
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">
            {customer.full_name} — Onboarding
          </h1>
        </div>
      </div>

      <OnboardingDetailView
        aml={
          aml
            ? {
                id: aml.id,
                sourceOfFunds: aml.source_of_funds,
                expectedMonthlyVolumeMinor: aml.expected_monthly_volume_minor,
                purposeOfAccount: aml.purpose_of_account,
                pepDeclaration: aml.pep_declaration,
                sanctionedCountryExposure: aml.sanctioned_country_exposure,
                reviewedAt: aml.reviewed_at
              }
            : null
        }
        canOpenAccount={canOpenAccount}
        canReviewAml={canReviewAml}
        canReviewCompliance={canReviewCompliance}
        canReviewKyc={canReviewKyc}
        canWrite={canWrite}
        customer={{
          id: customer.id,
          tenantId: customer.tenant_id,
          externalCustomerRef: customer.external_customer_ref,
          fullName: customer.full_name,
          email: customer.email,
          phone: customer.phone,
          countryCode: customer.country_code,
          type: customer.type,
          kycStatus: customer.kyc_status,
          riskTier: customer.risk_tier,
          onboardingStatus: customer.onboarding_status,
          createdAt: customer.created_at
        }}
        documents={documentsWithUrls}
        kyc={
          kyc
            ? {
                id: kyc.id,
                idType: kyc.id_type,
                idNumber: kyc.id_number,
                idCountry: kyc.id_country,
                dateOfBirth: kyc.date_of_birth,
                nationality: kyc.nationality,
                addressLine1: kyc.address_line1,
                addressLine2: kyc.address_line2,
                city: kyc.city,
                postalCode: kyc.postal_code,
                country: kyc.country,
                verifiedAt: kyc.verified_at
              }
            : null
        }
        reviews={(reviews ?? []).map((r) => ({
          id: r.id,
          reviewerId: r.reviewer_id,
          action: r.action,
          comment: r.comment,
          previousStatus: r.previous_status,
          newStatus: r.new_status,
          createdAt: r.created_at
        }))}
        tenantId={context.tenantId}
      />
    </main>
  );
}
