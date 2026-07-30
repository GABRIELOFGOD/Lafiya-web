import { NextResponse } from "next/server";

import { getAttestation } from "@/lib/stellar/attestation";
import { checkRateLimit, getClientIp, recordFailure } from "@/lib/rate-limit";

import { logError } from "@/lib/logging/logger";

const RECORD_HASH_PATTERN = /^[0-9a-f]{64}$/i;

/**
 * Read-only, unauthenticated lookup of an attestation by record hash. A
 * distinct Route Handler (rather than folded into the card page's Server
 * Component) because this is meant to be callable by things that aren't
 * this app's own pages — client-side polling, or lafiya-verifier later —
 * per README.md > Repository Structure.
 *
 * --- Rate limiting (issue-03) ---
 * The *primary* defense against enumerating record hashes is the
 * commitment scheme itself: record_hash is now HMAC-keyed by a per-patient
 * 256-bit secret (lib/attestation/recordHash.ts), so brute-forcing a valid
 * hash is computationally infeasible regardless of request rate. The
 * per-instance limiter below is defense-in-depth on top of that, not the
 * primary control — a fully distributed, atomicity-correct rate limiter is
 * separately tracked in issues/issue-07-distributed-rate-limiting.md
 * (which explicitly scopes this route out of its own work); duplicating
 * that effort here would be out of scope for this issue.
 *
 * Keyed by IP only: there's no user/email identity on this route, and
 * keying by the guessed hash itself would let an attacker evade the limit
 * trivially by varying the hash every request. recordFailure is called on
 * every request (not just misses) — a single lucky guess must not reset an
 * attacker's counter the way a correct password does on sign-in.
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

  const ip = await getClientIp();
  const rateLimitKey = `attestation-lookup:${ip}`;

  const limitCheck = await checkRateLimit(rateLimitKey);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        secondsRemaining: limitCheck.secondsRemaining,
      },
      { status: 429 },
    );
  }

  await recordFailure(rateLimitKey);

  try {
    const attestation = await getAttestation(recordHash);
    return NextResponse.json({
      verified: attestation !== null,
      attestation,
    });
  } catch (error) {
    logError("Failed to lookup attestation", error, {
      route: "/api/attestation/[recordHash]",
      recordHash,
    });
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
