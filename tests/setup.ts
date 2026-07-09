import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

// Vitest doesn't expose test globals by default, so RTL's own auto-cleanup
// (which detects a global afterEach) never registers without this.
afterEach(() => {
  cleanup();
});
