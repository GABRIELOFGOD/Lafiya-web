import { describe, expect, it } from "vitest";

import { generateQrDataUrl } from "./generateQrDataUrl";

describe("generateQrDataUrl", () => {
  it("returns a PNG data URL", async () => {
    const url = await generateQrDataUrl(
      "https://lafiya.example/card/11111111-1111-1111-1111-111111111111",
    );
    expect(url).toMatch(/^data:image\/png;base64,/);
  });

  it("produces different output for different input", async () => {
    const a = await generateQrDataUrl("https://lafiya.example/card/aaaa");
    const b = await generateQrDataUrl("https://lafiya.example/card/bbbb");
    expect(a).not.toBe(b);
  });
});
