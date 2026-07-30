import { describe, expect, it } from "vitest";

import { recordHashFromMemo } from "./sources";

describe("payout MemoHash correlation", () => {
  const hash = "0123456789abcdef".repeat(4);

  it("decodes Horizon's base64 MemoHash representation", () => {
    expect(
      recordHashFromMemo("hash", Buffer.from(hash, "hex").toString("base64")),
    ).toBe(hash);
  });

  it("accepts a normalized hex MemoHash representation", () => {
    expect(recordHashFromMemo("hash", hash.toUpperCase())).toBe(hash);
  });

  it("rejects text memos and malformed values rather than guessing", () => {
    expect(recordHashFromMemo("text", hash)).toBeNull();
    expect(recordHashFromMemo("hash", "patient-123")).toBeNull();
  });
});
