import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";

import "@testing-library/jest-dom/vitest";
import * as matchers from "vitest-axe/matchers";
import "vitest-axe/extend-expect";

expect.extend(matchers);

// Vitest doesn't expose test globals by default, so RTL's own auto-cleanup
// (which detects a global afterEach) never registers without this.
afterEach(() => {
  cleanup();
});
