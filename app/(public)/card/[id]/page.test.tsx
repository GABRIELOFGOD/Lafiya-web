import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/stellar/attestation", () => ({
  getAttestation: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { createClient } from "@/lib/supabase/server";
import { getAttestation } from "@/lib/stellar/attestation";

import PublicCardPage from "./page";

const VALID_ID = "11111111-1111-1111-1111-111111111111";

const fixtureCard = {
  name: "Amina Yusuf",
  age: 28,
  photo_url: null,
  blood_group: "O+",
  genotype: "AS",
  allergies: ["Penicillin"],
  medications: ["Insulin"],
  chronic_conditions: ["Asthma"],
  emergency_contacts: [
    { name: "Halima Yusuf", phone: "+2348012345678", relationship: "Mother" },
  ],
  language: "Hausa",
};

function mockRpc(result: { data: unknown; error: unknown }) {
  const fakeClient = { rpc: vi.fn().mockResolvedValue(result) };
  vi.mocked(createClient).mockResolvedValue(
    fakeClient as unknown as Awaited<ReturnType<typeof createClient>>,
  );
}

describe("PublicCardPage", () => {
  it("renders only the emergency subset for a valid card", async () => {
    mockRpc({ data: [fixtureCard], error: null });
    vi.mocked(getAttestation).mockResolvedValue(null);

    const jsx = await PublicCardPage({
      params: Promise.resolve({ id: VALID_ID }),
    });
    render(jsx);

    expect(screen.getByText("Amina Yusuf")).toBeInTheDocument();
    expect(screen.getByText("28 years old")).toBeInTheDocument();
    expect(screen.getByText("O+")).toBeInTheDocument();
    expect(screen.getByText("AS")).toBeInTheDocument();
    expect(screen.getByText("Penicillin")).toBeInTheDocument();
    expect(screen.getByText("Insulin")).toBeInTheDocument();
    expect(screen.getByText("Asthma")).toBeInTheDocument();
    expect(screen.getByText(/Halima Yusuf/)).toBeInTheDocument();
    expect(screen.getByText("Hausa")).toBeInTheDocument();

    // Never leaks internal identifiers, only the emergency subset.
    expect(screen.queryByText(/user_id/i)).not.toBeInTheDocument();
    expect(screen.queryByText(VALID_ID)).not.toBeInTheDocument();
  });

  it("passes axe-core accessibility audit", async () => {
    mockRpc({ data: [fixtureCard], error: null });
    vi.mocked(getAttestation).mockResolvedValue(null);

    const jsx = await PublicCardPage({
      params: Promise.resolve({ id: VALID_ID }),
    });
    const { container } = render(jsx);

    // Run axe against the document body to catch landmark violations
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  it("calls notFound for a malformed id without querying the database", async () => {
    await expect(
      PublicCardPage({ params: Promise.resolve({ id: "not-a-uuid" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("calls notFound when no card matches the id", async () => {
    mockRpc({ data: [], error: null });

    await expect(
      PublicCardPage({
        params: Promise.resolve({ id: "22222222-2222-2222-2222-222222222222" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("throws an unavailable error when the RPC errors, instead of notFound", async () => {
    mockRpc({ data: null, error: new Error("boom") });

    await expect(
      PublicCardPage({ params: Promise.resolve({ id: VALID_ID }) }),
    ).rejects.toThrow("UNAVAILABLE");
  });
});
