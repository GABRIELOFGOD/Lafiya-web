import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VerifiedBadge } from "./verified-badge";

describe("VerifiedBadge", () => {
  it("shows the verified state when status is verified", () => {
    render(<VerifiedBadge status="verified" />);
    expect(screen.getByText("Verified by a health worker")).toBeInTheDocument();
    expect(screen.queryByText("Not yet verified")).not.toBeInTheDocument();
    expect(screen.queryByText("Verification status unavailable")).not.toBeInTheDocument();
  });

  it("shows the unverified state when status is not_verified", () => {
    render(<VerifiedBadge status="not_verified" />);
    expect(screen.getByText("Not yet verified")).toBeInTheDocument();
    expect(screen.queryByText("Verified by a health worker")).not.toBeInTheDocument();
    expect(screen.queryByText("Verification status unavailable")).not.toBeInTheDocument();
  });

  it("shows the unavailable state when status is unavailable", () => {
    render(<VerifiedBadge status="unavailable" />);
    expect(screen.getByText("Verification status unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Verified by a health worker")).not.toBeInTheDocument();
    expect(screen.queryByText("Not yet verified")).not.toBeInTheDocument();
  });
});
