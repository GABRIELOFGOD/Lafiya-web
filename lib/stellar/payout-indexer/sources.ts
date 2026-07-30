import {
  Address,
  FeeBumpTransaction,
  Horizon,
  scValToNative,
  TransactionBuilder,
  rpc,
  type xdr,
} from "@stellar/stellar-sdk";

import type {
  AttestationEvent,
  AttestationSource,
  EventPage,
  PayoutEvent,
  PayoutSource,
} from "./types";

const RECORD_HASH_PATTERN = /^[0-9a-f]{64}$/;

export function recordHashFromMemo(
  memoType: string,
  memo: string,
): string | null {
  if (memoType !== "hash") return null;
  const normalized = memo.toLowerCase();
  if (RECORD_HASH_PATTERN.test(normalized)) return normalized;
  try {
    const decoded = Buffer.from(memo, "base64").toString("hex");
    return RECORD_HASH_PATTERN.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function operationsFromEnvelope(
  envelope: xdr.TransactionEnvelope,
  networkPassphrase: string,
) {
  const transaction = TransactionBuilder.fromXDR(
    envelope.toXDR("base64"),
    networkPassphrase,
  );
  return transaction instanceof FeeBumpTransaction
    ? transaction.innerTransaction.operations
    : transaction.operations;
}

export class SorobanAttestationSource implements AttestationSource {
  private readonly server: rpc.Server;

  constructor(
    rpcUrl: string,
    private readonly contractId: string,
    private readonly networkPassphrase: string,
    private readonly pageSize = 100,
  ) {
    this.server = new rpc.Server(rpcUrl, {
      allowHttp: new URL(rpcUrl).protocol === "http:",
    });
  }

  async read(
    cursor: string | null,
    startLedger: number,
  ): Promise<EventPage<AttestationEvent>> {
    const response = await this.server.getTransactions(
      cursor
        ? { pagination: { cursor, limit: this.pageSize } }
        : { startLedger, pagination: { limit: this.pageSize } },
    );
    const events: AttestationEvent[] = [];

    for (const transaction of response.transactions) {
      if (transaction.status !== rpc.Api.GetTransactionStatus.SUCCESS) continue;
      for (const operation of operationsFromEnvelope(
        transaction.envelopeXdr,
        this.networkPassphrase,
      )) {
        if (operation.type !== "invokeHostFunction") continue;
        if (operation.func.switch().name !== "hostFunctionTypeInvokeContract") {
          continue;
        }
        const invocation = operation.func.invokeContract();
        if (
          Address.fromScAddress(invocation.contractAddress()).toString() !==
            this.contractId ||
          invocation.functionName().toString() !== "attest"
        ) {
          continue;
        }
        const args = invocation.args();
        if (args.length < 3) continue;
        const recordHashValue = scValToNative(args[0]);
        const attesterValue = scValToNative(args[1]);
        const timestampValue = scValToNative(args[2]);
        const recordHash = Buffer.isBuffer(recordHashValue)
          ? recordHashValue.toString("hex")
          : "";
        const stellarAddress = String(attesterValue);
        const timestamp = Number(timestampValue);
        if (
          !RECORD_HASH_PATTERN.test(recordHash) ||
          !Number.isSafeInteger(timestamp)
        ) {
          continue;
        }
        events.push({
          recordHash,
          stellarAddress,
          attestedAt: new Date(timestamp * 1000).toISOString(),
          transactionHash: transaction.txHash,
          ledger: transaction.ledger,
        });
      }
    }
    return { events, cursor: response.cursor };
  }
}

export class HorizonPayoutSource implements PayoutSource {
  private readonly server: Horizon.Server;

  constructor(
    horizonUrl: string,
    private readonly poolAddress: string,
    private readonly usdcIssuer: string,
    private readonly pageSize = 100,
  ) {
    this.server = new Horizon.Server(horizonUrl, {
      allowHttp: new URL(horizonUrl).protocol === "http:",
    });
  }

  async read(
    cursor: string | null,
    startCursor = "0",
  ): Promise<EventPage<PayoutEvent>> {
    const page = await this.server
      .payments()
      .forAccount(this.poolAddress)
      .cursor(cursor ?? startCursor)
      .order("asc")
      .limit(this.pageSize)
      .call();
    const events: PayoutEvent[] = [];

    for (const operation of page.records) {
      if (
        operation.type !== "payment" ||
        operation.from !== this.poolAddress ||
        operation.asset_code !== "USDC" ||
        operation.asset_issuer !== this.usdcIssuer
      ) {
        continue;
      }
      const transaction = await operation.transaction();
      const recordHash = recordHashFromMemo(
        transaction.memo_type,
        transaction.memo ?? "",
      );
      if (!recordHash) continue;
      events.push({
        recordHash,
        stellarAddress: operation.to,
        amountUsdc: operation.amount,
        transactionHash: operation.transaction_hash,
        paidAt: operation.created_at,
        pagingToken: operation.paging_token,
      });
    }

    return {
      events,
      cursor: page.records.at(-1)?.paging_token ?? cursor ?? startCursor,
    };
  }
}
