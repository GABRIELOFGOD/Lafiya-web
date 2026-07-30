// ---------------------------------------------------------------------------
// k6 load-test harness for the public emergency card page (/card/[id]).
//
// Two scenarios, run sequentially:
//
//   cache_hit  — All VUs repeatedly hit ONE card ID.  After the first
//                request, Next.js ISR (revalidate = 60) serves the cached
//                HTML.  This measures the *best-case* response time a
//                responder sees when scanning a card that was recently
//                accessed by someone else.
//
//   cache_miss — Each VU picks a random card ID from a pool of 500.  Most
//                requests miss the ISR cache and force a Supabase RPC round-
//                trip.  This measures *worst-case / cold-cache* latency
//                under realistic multi-patient load.
//
// Usage:
//   BASE_URL=http://localhost:3000 k6 run loadtest/k6_get_emergency_card_test.js
//
// Environment variables:
//   BASE_URL     — origin of the running Next.js app  (required)
//   CONCURRENCY  — target VUs per scenario             (default: 50)
//   DURATION     — steady-state duration per scenario  (default: "1m")
// ---------------------------------------------------------------------------

import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Rate, Trend } from "k6/metrics";

// ── Custom metrics ──────────────────────────────────────────────────────────

const errorRate = new Rate("errors");

// Per-scenario latency trends (k6 built-in http_req_duration is global;
// these let us set separate thresholds and report independently).
const cacheHitDuration = new Trend("cache_hit_duration", true);
const cacheMissDuration = new Trend("cache_miss_duration", true);
const cacheHitErrors = new Rate("cache_hit_errors");
const cacheMissErrors = new Rate("cache_miss_errors");

// ── Shared data ─────────────────────────────────────────────────────────────

const cardIds = new SharedArray("card ids", function () {
  const raw = open("./card_ids.txt");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((id) => id.length > 0);
});

if (cardIds.length === 0) {
  throw new Error(
    "loadtest/card_ids.txt is empty or missing — run the seed script first.",
  );
}

// Pick one fixed card ID for the cache-hit scenario.
const fixedCardId = cardIds[0];

// ── Options ─────────────────────────────────────────────────────────────────

const vus = Number(__ENV.CONCURRENCY) || 50;
const duration = __ENV.DURATION || "1m";

export const options = {
  scenarios: {
    // Scenario A: repeated hits to the SAME card (cache-hit dominated).
    cache_hit: {
      executor: "ramping-vus",
      exec: "cacheHitScenario",
      startVUs: 0,
      stages: [
        { duration: "15s", target: vus },
        { duration: duration, target: vus },
        { duration: "15s", target: 0 },
      ],
      tags: { scenario: "cache_hit" },
    },

    // Scenario B: hits spread across many distinct cards (cache-miss / DB-bound).
    // Starts after cache_hit finishes + 30 s cool-down so ISR entries from
    // scenario A have a chance to expire and we avoid cross-contamination.
    cache_miss: {
      executor: "ramping-vus",
      exec: "cacheMissScenario",
      startVUs: 0,
      stages: [
        { duration: "15s", target: vus },
        { duration: duration, target: vus },
        { duration: "15s", target: 0 },
      ],
      // cache_hit ≈ 15s ramp + duration + 15s ramp + 30s gap
      startTime: `${30 + parseDurationSeconds(duration) + 30}s`,
      tags: { scenario: "cache_miss" },
    },
  },

  thresholds: {
    // Global SLOs
    errors: ["rate<0.01"],

    // Cache-hit: ISR-served responses should be very fast.
    cache_hit_duration: ["p(50)<200", "p(95)<500", "p(99)<800"],
    cache_hit_errors: ["rate<0.01"],

    // Cache-miss: includes DB round-trip; allowed to be slower.
    cache_miss_duration: ["p(50)<500", "p(95)<1500", "p(99)<2500"],
    cache_miss_errors: ["rate<0.01"],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a k6 duration string like "1m", "2m30s", "90s" into total seconds.
 * Only supports minutes and seconds — sufficient for this harness.
 */
function parseDurationSeconds(dur) {
  let total = 0;
  const minMatch = dur.match(/(\d+)m/);
  const secMatch = dur.match(/(\d+)s/);
  if (minMatch) total += parseInt(minMatch[1], 10) * 60;
  if (secMatch) total += parseInt(secMatch[1], 10);
  return total || 60; // fallback to 60 s
}

function makeRequest(cardId) {
  // Correct path: (public) is a Next.js route group — excluded from the URL.
  const url = `${__ENV.BASE_URL}/card/${cardId}`;
  return http.get(url, { tags: { name: "GET /card/[id]" } });
}

// ── Scenario functions ──────────────────────────────────────────────────────

export function cacheHitScenario() {
  const res = makeRequest(fixedCardId);
  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "body contains patient name": (r) =>
      r.body && r.body.includes("Load Test User"),
  });

  cacheHitDuration.add(res.timings.duration);
  cacheHitErrors.add(!ok);
  errorRate.add(!ok);

  sleep(0.5 + Math.random() * 0.5); // 0.5–1 s think time
}

export function cacheMissScenario() {
  // Pick a random card from the full pool — with 500 cards and 50 VUs,
  // most requests will be cache misses within any 60 s ISR window.
  const id = cardIds[Math.floor(Math.random() * cardIds.length)];
  const res = makeRequest(id);
  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "body contains patient name": (r) =>
      r.body && r.body.includes("Load Test User"),
  });

  cacheMissDuration.add(res.timings.duration);
  cacheMissErrors.add(!ok);
  errorRate.add(!ok);

  sleep(0.5 + Math.random() * 0.5);
}
