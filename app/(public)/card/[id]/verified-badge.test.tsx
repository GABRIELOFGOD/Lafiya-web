import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VerifiedBadge } from "./verified-badge";

describe("VerifiedBadge", () => {
  it("shows the verified state when an attestation exists", () => {
    render(<VerifiedBadge verified />);
    expect(screen.getByText("Verified by a health worker")).toBeInTheDocument();
    expect(screen.queryByText("Not yet verified")).not.toBeInTheDocument();
  });

  it("shows the unverified state when no attestation exists", () => {
    render(<VerifiedBadge verified={false} />);
    expect(screen.getByText("Not yet verified")).toBeInTheDocument();
    expect(
      screen.queryByText("Verified by a health worker"),
    ).not.toBeInTheDocument();
  });
});
