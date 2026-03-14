import { randomUUID } from "crypto";

import type { Json } from "@/types/database";

type PrimitiveMetadata = string | number | boolean | null;

export type PaymentMetadata = Record<string, PrimitiveMetadata>;

export type CreatePaymentTransferInput = {
  tenantId: string;
  userId: string;
  accountId: string;
  accountNumber: string;
  amountMinor: number;
  currency: string;
  description?: string;
  idempotencyKey: string;
};

export type CreatePaymentTransferOutput = {
  provider: "stripe";
  providerReference: string;
  status: string;
  lastError: string | null;
  reconciledAt: string | null;
  metadata: PaymentMetadata;
  clientSecret: string | null;
};

export type ReconcilePaymentTransferInput = {
  transferId: string;
  providerReference: string;
  currentStatus: string;
  metadata?: Json;
};

export type ReconcilePaymentTransferOutput = {
  status: string;
  lastError: string | null;
  reconciledAt: string;
  metadata: PaymentMetadata;
};

export interface PaymentService {
  createTransfer(input: CreatePaymentTransferInput): Promise<CreatePaymentTransferOutput>;
  reconcileTransfer(input: ReconcilePaymentTransferInput): Promise<ReconcilePaymentTransferOutput>;
}

class SimulatedPaymentService implements PaymentService {
  async createTransfer(input: CreatePaymentTransferInput): Promise<CreatePaymentTransferOutput> {
    const now = new Date().toISOString();

    return {
      // TODO(payments): when Stripe goes live, keep provider='stripe' but replace this simulated reference
      // with the real PaymentIntent/Transfer identifier returned by Stripe.
      provider: "stripe",
      providerReference: `sim_${Date.now().toString()}_${randomUUID().slice(0, 8)}`,
      // Simulate immediate successful settlement for MVP/demo flow.
      status: "succeeded",
      lastError: null,
      reconciledAt: now,
      metadata: {
        mode: "simulated",
        tenantId: input.tenantId,
        accountId: input.accountId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        description: input.description ?? "",
        idempotencyKey: input.idempotencyKey,
        simulatedAt: now
      },
      // TODO(payments): return Stripe client_secret when using real PaymentIntent confirmation.
      clientSecret: null
    };
  }

  async reconcileTransfer(input: ReconcilePaymentTransferInput): Promise<ReconcilePaymentTransferOutput> {
    const now = new Date().toISOString();

    return {
      // Simulated mode keeps successful state stable on reconcile.
      status: input.currentStatus === "failed" ? "failed" : "succeeded",
      lastError: input.currentStatus === "failed" ? "Simulated payment marked as failed" : null,
      reconciledAt: now,
      metadata: {
        mode: "simulated",
        simulatedReconcileAt: now,
        providerReference: input.providerReference
      }
    };
  }
}

export const getPaymentService = (): PaymentService => {
  // TODO(payments): swap to StripePaymentService via env flag when Stripe integration is enabled.
  return new SimulatedPaymentService();
};
