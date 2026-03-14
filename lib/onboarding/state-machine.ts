/**
 * Onboarding status state machine.
 * Defines valid transitions and which roles can perform them.
 */

export const ONBOARDING_STATUSES = [
  "draft",
  "profile_complete",
  "kyc_pending",
  "kyc_submitted",
  "kyc_verified",
  "kyc_rejected",
  "aml_pending",
  "aml_submitted",
  "aml_approved",
  "compliance_review",
  "approved",
  "rejected",
  "ready_for_account_opening"
] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

export type OnboardingReviewAction =
  | "kyc_approve"
  | "kyc_reject"
  | "aml_approve"
  | "aml_reject"
  | "compliance_approve"
  | "compliance_reject"
  | "request_changes";

/** Valid next statuses from each state (transition target). */
export const TRANSITIONS: Record<OnboardingStatus, OnboardingStatus[]> = {
  draft: ["profile_complete"],
  profile_complete: ["kyc_pending"],
  kyc_pending: ["kyc_submitted"],
  kyc_submitted: ["kyc_verified", "kyc_rejected"],
  kyc_verified: ["aml_pending"],
  kyc_rejected: [],
  aml_pending: ["aml_submitted"],
  aml_submitted: ["aml_approved", "compliance_review"],
  aml_approved: ["compliance_review"],
  compliance_review: ["approved", "rejected", "ready_for_account_opening"],
  approved: ["ready_for_account_opening"],
  rejected: [],
  ready_for_account_opening: []
};

/** Which review action leads to which status (for API). */
export const REVIEW_ACTION_TO_STATUS: Record<OnboardingReviewAction, OnboardingStatus> = {
  kyc_approve: "kyc_verified",
  kyc_reject: "kyc_rejected",
  aml_approve: "aml_approved",
  aml_reject: "rejected",
  compliance_approve: "approved",
  compliance_reject: "rejected",
  request_changes: "kyc_pending"
};

/** Allowed from-status for each review action. */
export const REVIEW_ACTION_FROM_STATUS: Record<OnboardingReviewAction, OnboardingStatus[]> = {
  kyc_approve: ["kyc_submitted"],
  kyc_reject: ["kyc_submitted"],
  aml_approve: ["aml_submitted", "compliance_review"],
  aml_reject: ["aml_submitted", "compliance_review"],
  compliance_approve: ["compliance_review", "aml_approved"],
  compliance_reject: ["compliance_review", "aml_approved"],
  request_changes: ["kyc_submitted", "aml_submitted", "compliance_review"]
};

export function canTransition(
  from: OnboardingStatus,
  to: OnboardingStatus
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextAllowedStatuses(current: OnboardingStatus): OnboardingStatus[] {
  return TRANSITIONS[current] ?? [];
}

export function isTerminalStatus(status: OnboardingStatus): boolean {
  return status === "rejected" || status === "ready_for_account_opening";
}

export function canOpenAccount(status: OnboardingStatus): boolean {
  return status === "ready_for_account_opening";
}

export function isReviewActionAllowed(
  action: OnboardingReviewAction,
  currentStatus: OnboardingStatus
): boolean {
  return REVIEW_ACTION_FROM_STATUS[action]?.includes(currentStatus) ?? false;
}
