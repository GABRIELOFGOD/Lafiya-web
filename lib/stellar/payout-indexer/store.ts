import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

import type {
  AttestationEvent,
  PayoutEvent,
  PayoutIndexerStore,
  StreamName,
} from "./types";

function assertNoError(
  error: { message: string } | null,
  operation: string,
): void {
  if (error) throw new Error(`${operation}: ${error.message}`);
}

export class SupabasePayoutIndexerStore implements PayoutIndexerStore {
  constructor(
    private readonly client: SupabaseClient<Database> = createAdminClient(),
  ) {}

  async getCursor(stream: StreamName): Promise<string | null> {
    const { data, error } = await this.client
      .from("stellar_indexer_cursors")
      .select("cursor")
      .eq("stream", stream)
      .maybeSingle();
    assertNoError(error, `read ${stream} cursor`);
    return data?.cursor ?? null;
  }

  async saveCursor(stream: StreamName, cursor: string): Promise<void> {
    const { error } = await this.client
      .from("stellar_indexer_cursors")
      .upsert(
        { stream, cursor, updated_at: new Date().toISOString() },
        { onConflict: "stream" },
      );
    assertNoError(error, `save ${stream} cursor`);
  }

  async applyAttestation(event: AttestationEvent): Promise<string> {
    const { data, error } = await this.client.rpc("apply_chw_attestation", {
      p_record_hash: event.recordHash,
      p_stellar_address: event.stellarAddress,
      p_attested_at: event.attestedAt,
    });
    assertNoError(error, "apply attestation");
    if (data === null)
      throw new Error("apply attestation returned no decision");
    return data;
  }

  async applyPayout(event: PayoutEvent): Promise<string> {
    const { data, error } = await this.client.rpc("apply_chw_payout", {
      p_record_hash: event.recordHash,
      p_stellar_address: event.stellarAddress,
      p_amount_usdc: Number(event.amountUsdc),
      p_payout_tx_hash: event.transactionHash,
      p_paid_at: event.paidAt,
      p_paging_token: event.pagingToken,
    });
    assertNoError(error, "apply payout");
    if (data === null) throw new Error("apply payout returned no decision");
    return data;
  }
}
