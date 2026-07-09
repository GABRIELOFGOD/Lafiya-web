# Lafiya

[![Built on Stellar](https://img.shields.io/badge/Built%20on-Stellar-blue?logo=stellar)](https://stellar.org)
[![Soroban Smart Contracts](https://img.shields.io/badge/Smart%20Contracts-Soroban-purple)](https://soroban.stellar.org)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-green.svg)](#license)
[![Status: Pre-alpha](https://img.shields.io/badge/status-pre--alpha-orange)](#roadmap)

A patient-owned emergency health card on Stellar — the vitals that decide emergency treatment travel with the patient as a scannable QR code, work offline, and can be cryptographically verified by a health worker so a first responder can trust them on the spot.

_Lafiya_ is Hausa for health, safety, and wellbeing.

> **Status:** Pre-alpha · Stellar **testnet** · not yet audited · not a medical device. See [Disclaimer](#disclaimer).

## Overview

Lafiya is a free, patient-owned emergency health card. The handful of facts that change how a patient is treated in an emergency — blood group, genotype, allergies, current medications, chronic conditions — travel with them as a scannable QR code, work offline, and can be cryptographically verified by a health worker.

This repository (`lafiya-web`) contains the patient + responder web app — the Lafiya Card product surface: the public emergency page, the authenticated profile editor, and QR generation. The Soroban attestation contracts, CHW verifier tooling, and project docs live in separate repos — see [Lafiya Organization](#lafiya-organization) below.

### The Problem

In Nigeria, health records are paper, siloed per facility, and effectively lost the moment a patient moves, is referred, or arrives unconscious. In an emergency, the facts that decide treatment are usually unknown to whoever is treating the patient. Wrong assumptions cost lives:

- **Genotype (AS/SS sickle-cell status), blood group, and drug allergies** are rarely known at the point of care
- **Referrals and facility transfers** lose the paper trail entirely
- **Unconscious or non-verbal patients** cannot supply the facts themselves
- **No existing system** lets a first responder trust a record without calling the issuing facility

### What Lafiya Does

- **For the patient / mother** — a free card carried on a phone or printed, that speaks for them when they can't
- **For the responder / clinician** — scan the QR, no login, see only the decision-relevant subset, with a clear "verified" indicator that can be trusted
- **For the community health worker (CHW)** — get paid in USDC on Stellar for each person registered and verified, solving the last-mile distribution problem

## Features

- **Lafiya Card**: a patient-owned profile behind a login; the patient chooses exactly what appears on a minimal, read-only public emergency page reachable by QR
- **Offline-first emergency page**: readable without a login and without a network connection once cached, so a responder can read it in a dead zone
- **Cryptographic attestation (Soroban)**: a licensed health worker's verification is recorded on-chain as a hash of the record + the attester's identity + a timestamp — never the health data itself
- **CHW incentive rails (USDC on Stellar)**: community health workers are paid a micro-amount per verified registration, with near-zero fees and stablecoin settlement
- **Transparent funding**: grant and donor funds flow on-chain into the CHW incentive pool, so every dollar maps to a countable number of verified cards
- **Privacy by design**: no personal health data ever touches the blockchain; only hashes, attestations, and payments are on-chain

## Architecture

```mermaid
graph TB
    subgraph Card["Lafiya Card (lafiya-web)"]
        PROFILE[Authenticated profile editor]
        PAGE[Public emergency page]
        QR[QR code]
    end

    subgraph DataLayer["Off-chain Data Layer"]
        SUPA[Supabase — encrypted Postgres + Row-Level Security]
    end

    subgraph Proof["Lafiya Proof (lafiya-contracts)"]
        ATTEST[Attestation registry — Soroban]
        ALLOW[Attester allowlist]
        PAY[USDC incentive payouts]
    end

    subgraph Consumers["Who reads / writes it"]
        CHW[Community health worker]
        RESP[Responder / clinician]
        FUNDER[Grant / donor funding pool]
    end

    PROFILE --> SUPA
    SUPA --> PAGE
    PAGE --> QR
    CHW -->|verifies record| ATTEST
    ATTEST --> ALLOW
    ATTEST -->|hash + attester ID + timestamp| SUPA
    RESP -->|scans QR| QR
    QR --> PAGE
    PAGE -.->|checks verified flag| ATTEST
    FUNDER --> PAY
    PAY --> CHW
```

### Core Components

- **app/(public)/card/[id]** _(planned)_: public, read-only emergency page — the page a QR code points to
- **app/(auth)/profile** _(planned)_: authenticated profile editor where a patient manages their private record
- **lib/supabase/** _(planned)_: Supabase client and Row-Level Security policies for the off-chain encrypted store
- **lib/stellar/** _(planned)_: Soroban contract bindings and USDC payment helpers
- **lib/qr/** _(planned)_: QR code generation for the emergency page

The Soroban attestation registry, attester allowlist, and CHW verifier tool live in the `lafiya-contracts` and `lafiya-verifier` repos respectively — see [Lafiya Organization](#lafiya-organization).

## Attestation & Trust Layer

Lafiya Proof is the Stellar-native trust and payment layer underneath the Lafiya Card:

| Layer                   | Mechanism                                                                       | What it guarantees                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Attestation**         | Soroban on-chain record: hash of the record + attester's identity + a timestamp | A responder can cryptographically confirm a real, allowlisted health worker verified this exact record, without the data ever being exposed |
| **Incentive rails**     | USDC on Stellar, paid per verified registration                                 | Near-zero-fee, cross-border micropayments make last-mile CHW outreach economically viable                                                   |
| **Transparent funding** | Grant and donor funds flow on-chain into the CHW incentive pool                 | Every donated dollar maps to a countable, auditable number of verified cards                                                                |

> **Core design principle.** No personal health data ever touches the blockchain. Personal data lives in an encrypted, access-controlled off-chain database. Stellar holds only hashes, attestations, and payments. This is what keeps Lafiya both privacy-respecting and regulator-compatible — and it is why Stellar is a _core_ component here, not a database substitute.

### Why Stellar (core, not shoehorned)

Stellar/Soroban does two things Lafiya genuinely needs that a plain web app cannot: it makes verification tamper-evident and independently checkable without exposing data, and it moves stablecoin micropayments to health workers cheaply and across borders. Remove Stellar and the trust layer and the incentive engine both disappear.

## Soroban Smart Contract Layer

The Soroban contract is the on-chain trust layer for Lafiya attestations — planned for `lafiya-contracts`, landing with milestone **M1**.

### Contract Functions (planned)

- `attest(record_hash: BytesN<32>, attester: Address, timestamp: u64)` - registers an attestation for a record hash (allowlisted attester only)
- `get_attestation(record_hash: BytesN<32>) -> Attestation` - read-only; returns the most recent attestation for a record hash, callable by any verifier
- `is_allowlisted(attester: Address) -> bool` - read-only; checks whether an address is a registered health worker

```rust
// Planned Soroban interface (Rust pseudocode) — lands with lafiya-contracts, M1
pub struct Attestation {
    pub record_hash: BytesN<32>,  // hash of the patient record; never the data itself
    pub attester: Address,        // allowlisted health worker's Stellar address
    pub timestamp: u64,           // ledger timestamp of the attestation
}
```

This composability lets a responder's scanner, or any other Stellar-aware verifier, confirm a record was attested by a real, allowlisted health worker — without an external oracle and without ever seeing the health data.

## Data Model (Emergency Subset)

The public emergency page is intentionally minimal:

- Name, age, photo
- **Blood group and genotype**
- Drug allergies
- Current medications (esp. anticoagulants, insulin, anti-epileptics)
- Chronic conditions / implants
- Emergency contact(s)
- Language spoken

Everything else (full history, documents, notes) stays private, behind authentication.

## Privacy & Compliance

- **Nigeria Data Protection Act (2023)** governs all personal data held. Consent, encryption, and minimal disclosure are designed in from day one.
- Patients opt into exactly what appears on their public page.
- No health data on-chain; only non-reversible hashes and attestations.

## Repository Structure

This repository (`lafiya-web`) contains the patient + responder web app. The Soroban contracts, docs, and CHW verifier tool live in separate repos — see [Lafiya Organization](#lafiya-organization) below. Nothing has been scaffolded yet; this is the planned layout for milestone **M0**:

```
lafiya-web/
│
├── README.md                    ← This file
├── package.json                 ← Next.js dependencies
├── .env.example                 ← Supabase + Stellar testnet config template
├── next.config.js
│
├── app/
│   ├── (public)/
│   │   └── card/[id]/           ← Public, read-only emergency page (QR target)
│   ├── (auth)/
│   │   └── profile/             ← Authenticated profile editor
│   └── api/
│       └── attestation/         ← Calls into lafiya-contracts / Soroban RPC
│
├── lib/
│   ├── supabase/                ← Supabase client + Row-Level Security policies
│   ├── stellar/                 ← Soroban contract bindings, USDC payment helpers
│   └── qr/                      ← QR code generation
│
└── docs/                        ← Local copies of data model / privacy notes (see lafiya-docs)
```

## Quick Start

> **Status**: these steps describe the planned M0 setup. `package.json`, `.env.example`, and the app scaffold have not landed yet — see [Roadmap](#roadmap).

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in the Supabase project keys and Stellar testnet config — see [Lafiya Organization](#lafiya-organization) for the shared environment variable names.

### 3. Run the dev server

```bash
npm run dev
```

Serves the authenticated profile editor and the public emergency page locally.

## Testing

```bash
npm test
```

No test suite exists yet — it lands with M0 alongside the initial Next.js scaffold. Planned coverage:

- [ ] Public emergency page renders only the patient-selected subset
- [ ] Row-Level Security policies enforce patient-only write access
- [ ] QR generation and scan-to-page routing
- [ ] Verified-indicator rendering once an attestation exists

## Roadmap

### M0 — Public Card _(testnet)_

- [ ] Patient can create a profile via `lafiya-web`
- [ ] Public, read-only emergency page reachable by QR
- [ ] Deployed to Vercel against Stellar testnet config

### M1 — Attestation

- [ ] Soroban attestation registry deployed (`lafiya-contracts`)
- [ ] Allowlisted attester can verify a record
- [ ] Card displays a verified indicator

### M2 — Incentives

- [ ] USDC-on-Stellar payout wired to attestation events
- [ ] CHW payout tracking

### M3 — Pilot

- [ ] Small, supervised field pilot
- [ ] Metrics: verified cards created, scan events

### M4 — Mainnet + Funding

- [ ] Mainnet deployment
- [ ] Transparent on-chain funding pool live

## Why This Matters for the Stellar Ecosystem

A health record that can't be trusted at the point of care is one that costs lives. Lafiya addresses this directly:

- **For patients and mothers** — a free card that speaks for them when they can't, without requiring technical expertise
- **For responders and clinicians** — a verified indicator they can trust on the spot, with no login and no facility call required
- **For community health workers** — a real, near-zero-fee income stream tied to verified registrations, solving last-mile distribution
- **For the Stellar Foundation and ecosystem** — a Digital Public Good that demonstrates Soroban attestations and stablecoin micropayments solving a real-world, life-or-death problem

Lafiya is built as an open-source **Digital Public Good** (SDG 3, Good Health and Well-being):

- **Primary:** Stellar Community Fund (SCF) — Build track
- **Bridge:** Registration against the Digital Public Goods Standard
- **Later:** DPG-aligned and public-goods streaming funders once real-world impact is demonstrable

## Dependencies

- Node.js 18+ / Next.js — the `lafiya-web` app (`package.json`, planned), deployed on Vercel
- Supabase — Postgres, Row-Level Security, encryption at rest
- Soroban / Stellar SDK — for calling the on-chain attestation registry and USDC payments
- W3C Verifiable Credentials data model, HL7 FHIR — standards informing the data model (see [References](#references))

## License

Recommended: **Apache-2.0** (OSI-approved, includes a patent grant — required for Digital Public Good status).

## Contributing

Issues and PRs welcome once M0 lands. Contributors agree to the project's code of conduct and license terms.

Quick checklist for contributions:

- Follows the project's code of conduct and license terms
- New features include tests once the test suite lands
- Documentation is updated (this README and `lafiya-docs`)

## Lafiya Organization

This project lives under the `lafiya-xyz` GitHub organization. This repo is one of five. If a change here touches a shared contract (below), call it out so the matching repo can be updated.

| Repo                           | Role                                                                                      | Primary language     |
| ------------------------------ | ----------------------------------------------------------------------------------------- | -------------------- |
| **`.github`**                  | Organization profile README and contribution guidelines                                   | Markdown             |
| **`lafiya-docs`**              | Concept note, data model, threat model, privacy design, funding/DPG materials, references | Markdown             |
| **`lafiya-web`** _(this repo)_ | Patient + responder web app. Public emergency page, authed profile editor, QR generation  | TypeScript (Next.js) |
| **`lafiya-contracts`**         | Soroban smart contracts (Rust): attestation registry + attester allowlist. Testnet first  | Rust (Soroban)       |
| **`lafiya-verifier`**          | CHW verification tool. Begins as a route inside `lafiya-web`; split out only if it grows  | TypeScript (planned) |

> Resist scaffolding empty repos. Two working repos (`lafiya-web`, `lafiya-contracts`) beat five half-built ones. Build one honest milestone at a time.

### Data Flow

```
lafiya-docs        ──(data model, threat model)──▶  lafiya-web
                                                        │
   patient input ──(profile data)──▶                   │  (Supabase, encrypted)
                                                        │
                                                        ▼
                                          Public emergency page (QR)
                                                        │
                        ┌───────────────────────────────┴───────────────────────────────┐
                        ▼                                                               ▼
              lafiya-contracts (Soroban)                                    lafiya-verifier (CHW tool)
                        │                                                               │
                        ▼                                                               ▼
        On-chain attestation + USDC payout                          Responder scans QR, sees verified flag
```

### Shared Contracts (must stay in sync across repos)

**1. Attestation schema** — a hash of the record + the attester's identity + a timestamp, defined conceptually here and mirrored by `lafiya-contracts`'s on-chain `Attestation` struct:

```
Attestation {
    record_hash: BytesN<32>   // hash of the patient record; never the data itself
    attester:    Address       // allowlisted health worker's Stellar address
    timestamp:   u64           // ledger timestamp of the attestation
}
```

If you change a field name, type, or hashing scheme here, update the Rust struct in `lafiya-contracts` in the same change set (or open a tracked follow-up in each repo).

**2. Emergency data model** — the field list in [Data Model](#data-model-emergency-subset) is the canonical decision-relevant subset. `lafiya-docs` mirrors it in the full data model / threat model; changing a field name here requires an update there.

**3. Environment variables / config keys** — `.env.example` (planned) will define the cross-repo keys:

- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — the off-chain encrypted store
- `STELLAR_NETWORK_PASSPHRASE` — must match the network the contracts are deployed on
- `SOROBAN_RPC_URL` — Soroban RPC endpoint (testnet first)
- `ATTESTATION_CONTRACT_ID` — the deployed `lafiya-contracts` attestation registry contract id

### Open Integration Points (not yet implemented)

- How `lafiya-web` calls `lafiya-contracts` — direct Soroban RPC from the app vs. a thin backend service
- How the attester allowlist is managed and updated — governance model not yet decided
- The exact USDC payout trigger — per attestation event vs. batched payouts

### Conventions for AI Agents

- Treat this section as the source of truth for **cross-repo** contracts. Each repo's own README covers repo-local conventions.
- When a change in this repo affects a shared contract above, call it out explicitly so the corresponding change can be made in the other repo(s).
- Never let personal health data reach an on-chain call — only hashes, attester identity, and timestamps belong in `lafiya-contracts` calls.
- Keep attestation and health-record field names identical (same casing, same units) across TypeScript (`web`), Rust (`contracts`), and Markdown (`docs`) — translation layers are a common source of bugs.

## Support

For issues and questions:

- GitHub Issues: [Create an issue](https://github.com/lafiya-xyz/lafiya-web/issues)

## Disclaimer

Lafiya is an information aid, **not a medical device** and **not a substitute for professional medical judgment**. Verified indicators reflect that a record was attested by a registered health worker; they are not a clinical guarantee. Treatment decisions remain the responsibility of the attending clinician.

## References

These works directly informed Lafiya's design and are the intended reading for contributors.

**Books**

- Shortliffe, E. H., & Cimino, J. J. (Eds.). (2021). _Biomedical Informatics: Computer Applications in Health Care and Biomedicine_ (5th ed.). Springer. — Grounds the clinical data model: which fields are decision-relevant in an emergency, and how health records are structured and coded.
- Preukschat, A., & Reed, D. (2021). _Self-Sovereign Identity: Decentralized Digital Identity and Verifiable Credentials_. Manning. — The blueprint for Lafiya Proof: issuer/holder/verifier roles, verifiable credentials, hash-based attestation, key management, and offline verification.
- Toyama, K. (2015). _Geek Heresy: Rescuing Social Change from the Cult of Technology_. PublicAffairs. — Keeps the project honest: technology amplifies human capacity rather than replacing it, which is why Lafiya centers community health workers, not the app.
- Kleppmann, M. (2017). _Designing Data-Intensive Applications_. O'Reilly. — Informs the off-chain data layer: reliable and secure storage, encryption, and the boundary between what lives in the database and what is anchored on-chain.
- Martin, R. C. (2017). _Clean Architecture: A Craftsman's Guide to Software Structure and Design_. Prentice Hall. — Discipline for an AI-assisted codebase: clear boundaries so the app, the contracts, and the data layer stay independently maintainable.

**Standards & documentation**

- Stellar Development Foundation — Stellar and Soroban developer documentation.
- W3C — Verifiable Credentials Data Model.
- HL7 — FHIR (health-data interoperability standard).
- Nigeria Data Protection Act (2023) — Nigeria Data Protection Commission.
- Digital Public Goods Alliance — DPG Standard.

---

<div align="center">

**Lafiya** — Your vitals, verified. When you can't speak, Lafiya does.

_Built for the Stellar ecosystem. Open source. Community owned._

</div>
