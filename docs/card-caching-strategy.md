# Public Card Page Caching Strategy

## Summary

Replaced `export const dynamic = "force-dynamic"` on the public card page with a deliberate ISR caching strategy. The page now uses a 60s revalidation window, and profile edits push fresh data instantly via `revalidatePath`.

## Problem

`force-dynamic` meant every view of a card — including repeated scans of the same card seconds apart — triggered a fresh RPC call to Supabase. There was no documented reason for this, so it was unclear whether it was a deliberate performance tradeoff or simply the easiest default while the feature was being built.

Given that card data changes rarely relative to how often it is viewed, every avoidable database round trip matters, especially under the high-concurrency scenario described in the load-testing issue.

## Decision

Card data is emergency medical info that changes only when a patient edits their profile. Between edits, a short staleness window is acceptable. The caching strategy is therefore:

- **Default:** ISR with `revalidate = 60` (60s TTL). Repeated views of the same card within that window are served from cache.
- **On edit:** `upsertProfile` explicitly calls `revalidatePath("/card/<card_public_id>")` so the next scan after an edit gets fresh data immediately.

This keeps edits effectively instant for responders while eliminating the per-request database load for the common read-heavy case.

## Files changed

- `app/(public)/card/[id]/page.tsx` — removed `force-dynamic`, added `revalidate = 60` with an explanatory comment
- `app/(auth)/profile/actions.ts` — after a successful upsert, fetches `card_public_id` and calls `revalidatePath("/card/<id>")` in addition to the existing `revalidatePath("/profile")`

## Freshness guarantee

A patient saving an edit expects their own card to reflect it. With the on-demand `revalidatePath` call, the cached version is purged at save time, so the very next request to `/card/<id>` rebuilds from the database. The 60s TTL only applies between edits.

## Verification

- `npm run typecheck` — passes
- `npm test` — 22 tests pass
- `npm run lint` — passes

## Follow-up

Benchmark the improvement using the load-testing setup from the related issue in this batch, and document the delta in the PR.
