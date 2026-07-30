export type StreamName = "attestations" | "payments";

export type AttestationEvent = {
  recordHash: string;
  stellarAddress: string;
  attestedAt: string;
  transactionHash: string;
  ledger: number;
};

export type PayoutEvent = {
  recordHash: string;
  stellarAddress: string;
  amountUsdc: string;
  transactionHash: string;
  paidAt: string;
  pagingToken: string;
};

export type EventPage<T> = {
  events: T[];
  cursor: string;
};

export type AttestationSource = {
  read(
    cursor: string | null,
    startLedger: number,
  ): Promise<EventPage<AttestationEvent>>;
};

export type PayoutSource = {
  read(
    cursor: string | null,
    startCursor?: string,
  ): Promise<EventPage<PayoutEvent>>;
};

export type PayoutIndexerStore = {
  getCursor(stream: StreamName): Promise<string | null>;
  saveCursor(stream: StreamName, cursor: string): Promise<void>;
  applyAttestation(event: AttestationEvent): Promise<string>;
  applyPayout(event: PayoutEvent): Promise<string>;
};

export type PayoutIndexerSummary = {
  attestations: number;
  payments: number;
  attestationCursor: string;
  paymentCursor: string;
};
