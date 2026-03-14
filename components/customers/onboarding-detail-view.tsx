"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { parseApiResponse } from "@/lib/api/client";
import { getNextAllowedStatuses } from "@/lib/onboarding/state-machine";

type Customer = {
  id: string;
  tenantId: string;
  externalCustomerRef: string;
  fullName: string;
  email: string;
  phone: string | null;
  countryCode: string | null;
  type: string;
  kycStatus: string;
  riskTier: string;
  onboardingStatus: string;
  createdAt: string;
};

type Kyc = {
  id: string;
  idType: string;
  idNumber: string;
  idCountry: string;
  dateOfBirth: string | null;
  nationality: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string | null;
  country: string;
  verifiedAt: string | null;
} | null;

type Aml = {
  id: string;
  sourceOfFunds: string;
  expectedMonthlyVolumeMinor: number | null;
  purposeOfAccount: string;
  pepDeclaration: boolean;
  sanctionedCountryExposure: boolean;
  reviewedAt: string | null;
} | null;

type Doc = {
  id: string;
  documentType: string;
  storagePath: string;
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  status: string;
  createdAt: string;
  downloadUrl: string | null;
};

type Review = {
  id: string;
  reviewerId: string;
  action: string;
  comment: string | null;
  previousStatus: string;
  newStatus: string;
  createdAt: string;
};

type OnboardingDetailViewProps = {
  tenantId: string;
  customer: Customer;
  kyc: Kyc;
  aml: Aml;
  documents: Doc[];
  reviews: Review[];
  canWrite: boolean;
  canReviewKyc: boolean;
  canReviewAml: boolean;
  canReviewCompliance: boolean;
  canOpenAccount: boolean;
};

const formatFileSize = (size: number | null): string => {
  if (!size || size <= 0) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

export function OnboardingDetailView({
  tenantId,
  customer,
  kyc,
  aml,
  documents,
  reviews,
  canWrite,
  canReviewKyc,
  canReviewAml,
  canReviewCompliance,
  canOpenAccount
}: OnboardingDetailViewProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const nextStatuses = getNextAllowedStatuses(
    customer.onboardingStatus as Parameters<typeof getNextAllowedStatuses>[0]
  );
  const readyForAccount = customer.onboardingStatus === "ready_for_account_opening";

  const transition = async (nextStatus: string) => {
    setError(null);
    setMessage(null);
    setLoading("transition");
    try {
      await parseApiResponse(
        await fetch(`/api/v1/onboarding/${customer.id}/transition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, customerId: customer.id, nextStatus })
        })
      );
      setMessage(`Status updated to ${nextStatus}.`);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Transition failed.");
    } finally {
      setLoading(null);
    }
  };

  const submitReview = async (action: string, comment?: string) => {
    setError(null);
    setMessage(null);
    setLoading(action);
    try {
      await parseApiResponse(
        await fetch(`/api/v1/onboarding/${customer.id}/reviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, customerId: customer.id, action, comment })
        })
      );
      setMessage(`Review action ${action} applied.`);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Review failed.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-900">Onboarding Status</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="info">{customer.onboardingStatus}</Badge>
            {canWrite &&
              nextStatuses.map((next) => (
                <button
                  key={next}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  disabled={loading !== null}
                  onClick={() => transition(next)}
                  type="button"
                >
                  -&gt; {next.replace(/_/g, " ")}
                </button>
              ))}
          </div>
          {readyForAccount && canOpenAccount ? (
            <div className="mt-3">
              <Link
                className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                href={`/accounts?customerId=${customer.id}`}
              >
                Open account -&gt;
              </Link>
            </div>
          ) : null}
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-900">Customer Profile</h2>
        </CardHeader>
        <CardBody className="grid gap-2 text-sm">
          <p>
            <span className="text-slate-500">Ref:</span> {customer.externalCustomerRef}
          </p>
          <p>
            <span className="text-slate-500">Name:</span> {customer.fullName}
          </p>
          <p>
            <span className="text-slate-500">Email:</span> {customer.email}
          </p>
          <p>
            <span className="text-slate-500">Phone:</span> {customer.phone ?? "-"}
          </p>
          <p>
            <span className="text-slate-500">Country:</span> {customer.countryCode ?? "-"}
          </p>
          <p>
            <span className="text-slate-500">Type:</span> {customer.type}
          </p>
          <p>
            <span className="text-slate-500">Risk:</span> {customer.riskTier}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-900">KYC Details</h2>
          {kyc?.verifiedAt ? (
            <Badge tone="success">Verified {new Date(kyc.verifiedAt).toLocaleString()}</Badge>
          ) : null}
        </CardHeader>
        <CardBody>
          {kyc ? (
            <div className="grid gap-2 text-sm">
              <p>
                <span className="text-slate-500">ID:</span> {kyc.idType} {kyc.idNumber} ({kyc.idCountry})
              </p>
              <p>
                <span className="text-slate-500">DOB:</span> {kyc.dateOfBirth ?? "-"}
              </p>
              <p>
                <span className="text-slate-500">Address:</span> {kyc.addressLine1}
                {kyc.addressLine2 ? `, ${kyc.addressLine2}` : ""}, {kyc.city} {kyc.postalCode ?? ""} {kyc.country}
              </p>
            </div>
          ) : (
            <p className="text-slate-500">
              No KYC details yet. Move status to <code>kyc_pending</code> and submit the form.
            </p>
          )}

          {canWrite && customer.onboardingStatus === "kyc_pending" ? (
            <KycForm
              customerId={customer.id}
              initial={kyc ?? undefined}
              onSuccess={() => router.refresh()}
              tenantId={tenantId}
            />
          ) : null}

          {customer.onboardingStatus === "kyc_submitted" && (canReviewKyc || canReviewCompliance) ? (
            <div className="mt-3 flex gap-2">
              <button
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={loading !== null}
                onClick={() => submitReview("kyc_approve")}
                type="button"
              >
                Approve KYC
              </button>
              <button
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                disabled={loading !== null}
                onClick={() => submitReview("kyc_reject")}
                type="button"
              >
                Reject KYC
              </button>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-900">AML Details</h2>
          {aml?.reviewedAt ? (
            <Badge tone="success">Reviewed {new Date(aml.reviewedAt).toLocaleString()}</Badge>
          ) : null}
        </CardHeader>
        <CardBody>
          {aml ? (
            <div className="grid gap-2 text-sm">
              <p>
                <span className="text-slate-500">Source of funds:</span> {aml.sourceOfFunds}
              </p>
              <p>
                <span className="text-slate-500">Purpose:</span> {aml.purposeOfAccount}
              </p>
              <p>
                <span className="text-slate-500">PEP:</span> {aml.pepDeclaration ? "Yes" : "No"}
              </p>
              <p>
                <span className="text-slate-500">Sanctioned exposure:</span>{" "}
                {aml.sanctionedCountryExposure ? "Yes" : "No"}
              </p>
            </div>
          ) : (
            <p className="text-slate-500">
              No AML details yet. Move status to <code>aml_pending</code> and submit the form.
            </p>
          )}

          {canWrite && customer.onboardingStatus === "aml_pending" ? (
            <AmlForm
              customerId={customer.id}
              initial={aml ?? undefined}
              onSuccess={() => router.refresh()}
              tenantId={tenantId}
            />
          ) : null}

          {(customer.onboardingStatus === "aml_submitted" ||
            customer.onboardingStatus === "compliance_review") &&
          (canReviewAml || canReviewCompliance) ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={loading !== null}
                onClick={() => submitReview("aml_approve")}
                type="button"
              >
                Approve AML
              </button>
              <button
                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
                disabled={loading !== null}
                onClick={() => submitReview("compliance_approve")}
                type="button"
              >
                Compliance approve
              </button>
              <button
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                disabled={loading !== null}
                onClick={() => submitReview("compliance_reject")}
                type="button"
              >
                Reject
              </button>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-900">Documents</h2>
          {canWrite ? (
            <p className="mt-1 text-sm text-slate-500">Upload PDF/JPG/PNG/WebP documents up to 10 MB.</p>
          ) : null}
        </CardHeader>
        <CardBody className="space-y-4">
          {canWrite ? (
            <DocumentUploadForm
              customerId={customer.id}
              onError={(nextError) => setError(nextError)}
              onSuccess={(nextMessage) => {
                setError(null);
                setMessage(nextMessage);
                router.refresh();
              }}
            />
          ) : null}

          {documents.length === 0 ? (
            <p className="text-slate-500">No uploaded documents yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {documents.map((document) => (
                <li key={document.id} className="rounded border border-slate-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-800">{document.documentType}</p>
                      <p className="text-xs text-slate-500">
                        {document.fileName ?? "No filename"} - {formatFileSize(document.fileSizeBytes)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">{document.status}</Badge>
                      {document.downloadUrl ? (
                        <a
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          href={document.downloadUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          View
                        </a>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-900">Review History</h2>
        </CardHeader>
        <CardBody>
          {reviews.length === 0 ? (
            <p className="text-slate-500">No reviews yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {reviews.map((review) => (
                <li key={review.id} className="border-b border-slate-100 pb-2">
                  <span className="font-medium">{review.action}</span> {review.previousStatus} -&gt; {review.newStatus}
                  {review.comment ? ` - ${review.comment}` : ""}{" "}
                  <span className="text-slate-400">{new Date(review.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function DocumentUploadForm({
  customerId,
  onSuccess,
  onError
}: {
  customerId: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    onError("");
    setIsUploading(true);

    try {
      const selectedFile = fileInputRef.current?.files?.[0];
      if (!selectedFile) {
        onError("Please choose a document file before uploading.");
        return;
      }

      const formData = new FormData(form);
      await parseApiResponse(
        await fetch(`/api/v1/onboarding/${customerId}/documents`, {
          method: "POST",
          body: formData
        })
      );

      onSuccess("Document uploaded successfully.");
      form?.reset?.();
      setSelectedFileName("");
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : "Unable to upload document.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="block min-w-0 text-sm">
          <span className="mb-1 block font-medium text-slate-700">Document type</span>
          <select className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" name="documentType" required>
            <option value="id_proof">id_proof</option>
            <option value="address_proof">address_proof</option>
            <option value="income_proof">income_proof</option>
            <option value="contract">contract</option>
            <option value="statement">statement</option>
            <option value="other">other</option>
          </select>
        </label>

        <FormField label="Document file">
          <div className="min-w-0 rounded-xl border border-slate-300 bg-white p-2 shadow-sm">
            <input
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              name="file"
              onChange={(event) => {
                setSelectedFileName(event.currentTarget.files?.[0]?.name ?? "");
              }}
              ref={fileInputRef}
              required
              type="file"
            />
            <div className="flex min-w-0 items-center gap-2">
              <button
                className="shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                Choose file
              </button>
              <p className="truncate text-sm text-slate-600">
                {selectedFileName || "No file selected"}
              </p>
            </div>
          </div>
        </FormField>
      </div>

      <PendingSubmitButton
        className="w-full sm:w-fit"
        isLoading={isUploading}
        label="Upload document"
        pendingLabel="Uploading..."
      />
    </form>
  );
}

function KycForm({
  tenantId,
  customerId,
  initial,
  onSuccess
}: {
  tenantId: string;
  customerId: string;
  initial?: Kyc;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErr(null);
    setLoading(true);
    const form = event.currentTarget;

    const payload = {
      tenantId,
      customerId,
      idType: (form.querySelector('[name="idType"]') as HTMLInputElement).value,
      idNumber: (form.querySelector('[name="idNumber"]') as HTMLInputElement).value,
      idCountry: (form.querySelector('[name="idCountry"]') as HTMLInputElement).value.slice(0, 2),
      dateOfBirth: (form.querySelector('[name="dateOfBirth"]') as HTMLInputElement).value || null,
      nationality: (form.querySelector('[name="nationality"]') as HTMLInputElement).value.slice(0, 2) || null,
      addressLine1: (form.querySelector('[name="addressLine1"]') as HTMLInputElement).value,
      addressLine2: (form.querySelector('[name="addressLine2"]') as HTMLInputElement).value || null,
      city: (form.querySelector('[name="city"]') as HTMLInputElement).value,
      postalCode: (form.querySelector('[name="postalCode"]') as HTMLInputElement).value || null,
      country: (form.querySelector('[name="country"]') as HTMLInputElement).value.slice(0, 2)
    };

    try {
      await parseApiResponse(
        await fetch(`/api/v1/onboarding/${customerId}/kyc`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      );

      await parseApiResponse(
        await fetch(`/api/v1/onboarding/${customerId}/transition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, customerId, nextStatus: "kyc_submitted" })
        })
      );

      onSuccess();
    } catch (requestError) {
      setErr(requestError instanceof Error ? requestError.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4" onSubmit={handleSubmit}>
      <h3 className="text-sm font-semibold text-slate-700">Submit KYC</h3>
      {err ? <Alert tone="error">{err}</Alert> : null}
      <FormField label="ID Type">
        <Input defaultValue={initial?.idType} name="idType" required type="text" />
      </FormField>
      <FormField label="ID Number">
        <Input defaultValue={initial?.idNumber} name="idNumber" required type="text" />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="ID Country (2 letters)">
          <Input defaultValue={initial?.idCountry} maxLength={2} name="idCountry" required type="text" />
        </FormField>
        <FormField label="Date of birth">
          <Input defaultValue={initial?.dateOfBirth ?? ""} name="dateOfBirth" type="date" />
        </FormField>
      </div>
      <FormField label="Nationality (2 letters)">
        <Input defaultValue={initial?.nationality ?? ""} maxLength={2} name="nationality" type="text" />
      </FormField>
      <FormField label="Address line 1">
        <Input defaultValue={initial?.addressLine1} name="addressLine1" required type="text" />
      </FormField>
      <FormField label="Address line 2">
        <Input defaultValue={initial?.addressLine2 ?? ""} name="addressLine2" type="text" />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="City">
          <Input defaultValue={initial?.city} name="city" required type="text" />
        </FormField>
        <FormField label="Postal code">
          <Input defaultValue={initial?.postalCode ?? ""} name="postalCode" type="text" />
        </FormField>
      </div>
      <FormField label="Country (2 letters)">
        <Input defaultValue={initial?.country} maxLength={2} name="country" required type="text" />
      </FormField>
      <PendingSubmitButton isLoading={loading} label="Save & submit for verification" pendingLabel="Submitting..." />
    </form>
  );
}

function AmlForm({
  tenantId,
  customerId,
  initial,
  onSuccess
}: {
  tenantId: string;
  customerId: string;
  initial?: Aml;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErr(null);
    setLoading(true);
    const form = event.currentTarget;

    const payload = {
      tenantId,
      customerId,
      sourceOfFunds: (form.querySelector('[name="sourceOfFunds"]') as HTMLInputElement).value,
      expectedMonthlyVolumeMinor:
        parseInt((form.querySelector('[name="expectedMonthlyVolumeMinor"]') as HTMLInputElement).value, 10) || null,
      purposeOfAccount: (form.querySelector('[name="purposeOfAccount"]') as HTMLInputElement).value,
      pepDeclaration: (form.querySelector('[name="pepDeclaration"]') as HTMLInputElement).checked,
      sanctionedCountryExposure: (form.querySelector('[name="sanctionedCountryExposure"]') as HTMLInputElement)
        .checked
    };

    try {
      await parseApiResponse(
        await fetch(`/api/v1/onboarding/${customerId}/aml`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      );

      await parseApiResponse(
        await fetch(`/api/v1/onboarding/${customerId}/transition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, customerId, nextStatus: "aml_submitted" })
        })
      );

      onSuccess();
    } catch (requestError) {
      setErr(requestError instanceof Error ? requestError.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4" onSubmit={handleSubmit}>
      <h3 className="text-sm font-semibold text-slate-700">Submit AML details</h3>
      {err ? <Alert tone="error">{err}</Alert> : null}
      <FormField label="Source of funds">
        <Input defaultValue={initial?.sourceOfFunds} name="sourceOfFunds" required type="text" />
      </FormField>
      <FormField label="Expected monthly volume (minor units)">
        <Input
          defaultValue={initial?.expectedMonthlyVolumeMinor ?? ""}
          name="expectedMonthlyVolumeMinor"
          type="number"
        />
      </FormField>
      <FormField label="Purpose of account">
        <Input defaultValue={initial?.purposeOfAccount} name="purposeOfAccount" required type="text" />
      </FormField>
      <label className="flex items-center gap-2">
        <input defaultChecked={initial?.pepDeclaration} name="pepDeclaration" type="checkbox" />
        <span className="text-sm">PEP declaration</span>
      </label>
      <label className="flex items-center gap-2">
        <input
          defaultChecked={initial?.sanctionedCountryExposure}
          name="sanctionedCountryExposure"
          type="checkbox"
        />
        <span className="text-sm">Sanctioned country exposure</span>
      </label>
      <PendingSubmitButton isLoading={loading} label="Save & submit for review" pendingLabel="Submitting..." />
    </form>
  );
}
