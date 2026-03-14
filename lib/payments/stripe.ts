// Stripe adapter scaffold (deferred).
// TODO(payments): implement this adapter with official Stripe SDK/API calls when provider integration is enabled.

export type StripePaymentIntent = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  client_secret?: string | null;
  last_payment_error?: {
    message?: string | null;
  } | null;
};

export const createStripePaymentIntent = async (): Promise<StripePaymentIntent> => {
  throw new Error("Stripe adapter not implemented yet.");
};

export const retrieveStripePaymentIntent = async (): Promise<StripePaymentIntent> => {
  throw new Error("Stripe adapter not implemented yet.");
};

export const verifyStripeWebhookEvent = async (): Promise<never> => {
  throw new Error("Stripe webhook verification not implemented yet.");
};
