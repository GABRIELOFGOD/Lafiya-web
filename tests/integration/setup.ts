import { vi } from "vitest";

// The real "server-only" package throws unconditionally unless the bundler
// sets the "react-server" resolve condition (how Next.js marks RSC/server
// builds). Vitest doesn't set that condition, so any integration test that
// imports server-only application code (e.g. @/lib/rate-limit, which pulls
// in @/lib/supabase/admin -> @/lib/env-server -> "server-only") would
// otherwise crash at import time. Mirrors the identical mock in
// tests/setup.ts for the unit suite.
vi.mock("server-only", () => ({}));
