import { NextResponse } from "next/server";

import { getAttestation } from "@/lib/stellar/attestation";

const RECORD_HASH_PATTERN = /^[0-9a-f]{64}$/i;

/**
 * Read-only, unauthenticated lookup of an attestation by record hash. A
 * distinct Route Handler (rather than folded into the card page's Server
 * Component) because this is meant to be callable by things that aren't
 * this app's own pages — client-side polling, or lafiya-verifier later —
 * per README.md > Repository Structure.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ recordHash: string }> },
) {
  const { recordHash } = await params;

  if (!RECORD_HASH_PATTERN.test(recordHash)) {
    return NextResponse.json(
      { error: "recordHash must be a 64-character hex SHA-256 digest" },
      { status: 400 },
    );
  }

  const attestation = await getAttestation(recordHash);

  return NextResponse.json({
    verified: attestation !== null,
    attestation,
  });
}
