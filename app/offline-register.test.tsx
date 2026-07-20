import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ServiceWorkerRegister } from "./offline-register";

function mockServiceWorker() {
  const register = vi.fn().mockResolvedValue({} as ServiceWorkerRegistration);
  Object.defineProperty(navigator, "serviceWorker", {
    value: { register },
    configurable: true,
  });
  return register;
}

describe("ServiceWorkerRegister", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("registers the module service worker on load when supported", () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = mockServiceWorker();

    render(<ServiceWorkerRegister />);
    // jsdom may report readyState as "complete" (fires on mount) or still
    // loading (fires on the load event); dispatch it to cover both.
    window.dispatchEvent(new Event("load"));

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith("/sw.js", { type: "module" });
  });

  it("does nothing and does not throw when service workers are unsupported", () => {
    vi.stubEnv("NODE_ENV", "production");
    Object.defineProperty(navigator, "serviceWorker", {
      value: undefined,
      configurable: true,
    });

    expect(() => render(<ServiceWorkerRegister />)).not.toThrow();
  });

  it("skips registration while in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const register = mockServiceWorker();

    render(<ServiceWorkerRegister />);
    window.dispatchEvent(new Event("load"));

    expect(register).not.toHaveBeenCalled();
  });
});
