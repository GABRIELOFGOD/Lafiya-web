import { afterEach, describe, expect, it } from "vitest";

import { SupabasePayoutIndexerStore } from "@/lib/stellar/payout-indexer/store";

import { adminClient } from "./helpers/testUser";

const hashes = new Set<string>();

afterEach(async () => {
  for (const recordHash of hashes) {
    await adminClient
      .from("chw_payouts")
      .delete()
      .eq("record_hash", recordHash);
    await adminClient
      .from("chw_payout_observations")
      .delete()
      .eq("record_hash", recordHash);
  }
  await adminClient
    .from("stellar_indexer_cursors")
    .delete()
    .in("stream", ["attestations", "payments"]);
  hashes.clear();
});

describe("CHW payout indexer persistence", () => {
  it("writes through service-role RPCs and reconciles an early payout", async () => {
    const recordHash = crypto.randomUUID().replaceAll("-", "").padEnd(64, "0");
    hashes.add(recordHash);
    const store = new SupabasePayoutIndexerStore(adminClient);

    expect(
      await store.applyPayout({
        recordHash,
        stellarAddress: "GLOCALCHW",
        amountUsdc: "2.5000000",
        transactionHash: crypto.randomUUID().replaceAll("-", ""),
        paidAt: "2026-07-30T12:01:00.000Z",
        pagingToken: "123-1",
      }),
    ).toBe("awaiting_attestation");
    expect(
      await store.applyAttestation({
        recordHash,
        stellarAddress: "GLOCALCHW",
        attestedAt: "2026-07-30T12:00:00.000Z",
        transactionHash: "attestation-tx",
        ledger: 123,
      }),
    ).toBe("paid_from_observation");

    const { data, error } = await adminClient
      .from("chw_payouts")
      .select("record_hash,status,amount_usdc,payout_tx_hash")
      .eq("record_hash", recordHash)
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      record_hash: recordHash,
      status: "paid",
      amount_usdc: 2.5,
    });
  });
});
