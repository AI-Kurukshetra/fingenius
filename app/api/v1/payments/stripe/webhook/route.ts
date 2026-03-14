import { ok } from "@/lib/api/response";

export const runtime = "nodejs";

export async function POST() {
  // TODO(payments): enable real Stripe webhook processing when Stripe adapter is implemented.
  // In the current stage, payments are simulated in-app and do not rely on external provider callbacks.
  return ok({
    status: "ignored",
    reason: "stripe_integration_deferred",
    message: "Stripe webhook processing is disabled until provider integration is enabled."
  });
}
