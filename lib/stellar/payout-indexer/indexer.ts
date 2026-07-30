import { logError, logInfo } from "@/lib/logging/logger";

import type {
  AttestationSource,
  PayoutIndexerStore,
  PayoutIndexerSummary,
  PayoutSource,
} from "./types";

export class PayoutIndexer {
  constructor(
    private readonly store: PayoutIndexerStore,
    private readonly attestations: AttestationSource,
    private readonly payouts: PayoutSource,
    private readonly startLedger: number,
    private readonly startPaymentCursor = "0",
  ) {}

  async runOnce(): Promise<PayoutIndexerSummary> {
    try {
      // Deliberately read both cursors before either stream is processed. The
      // database observation table makes stream order irrelevant.
      const [attestationCursor, paymentCursor] = await Promise.all([
        this.store.getCursor("attestations"),
        this.store.getCursor("payments"),
      ]);
      const [attestationPage, paymentPage] = await Promise.all([
        this.attestations.read(attestationCursor, this.startLedger),
        this.payouts.read(paymentCursor, this.startPaymentCursor),
      ]);

      for (const event of paymentPage.events) {
        const decision = await this.store.applyPayout(event);
        logInfo("CHW payout event processed", {
          recordHash: event.recordHash,
          transactionHash: event.transactionHash,
          pagingToken: event.pagingToken,
          decision,
        });
      }
      await this.store.saveCursor("payments", paymentPage.cursor);

      for (const event of attestationPage.events) {
        const decision = await this.store.applyAttestation(event);
        logInfo("CHW attestation event processed", {
          recordHash: event.recordHash,
          transactionHash: event.transactionHash,
          ledger: event.ledger,
          decision,
        });
      }
      await this.store.saveCursor("attestations", attestationPage.cursor);

      const summary = {
        attestations: attestationPage.events.length,
        payments: paymentPage.events.length,
        attestationCursor: attestationPage.cursor,
        paymentCursor: paymentPage.cursor,
      };
      logInfo("CHW payout indexer run completed", summary);
      return summary;
    } catch (error) {
      logError("CHW payout indexer run failed", error);
      throw error;
    }
  }
}
