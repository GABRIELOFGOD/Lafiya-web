import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms — Lafiya",
  robots: { index: false, follow: false },
};

const LAST_UPDATED = "2026-07-17";
const VERSION = "1.0.0";

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Version {VERSION} · Last updated {LAST_UPDATED}
        </p>
      </div>

      <div className="flex flex-col gap-6 text-sm text-zinc-700 dark:text-zinc-300">
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Pre-alpha software
          </h2>
          <p>
            Lafiya is pre-alpha software running on the Stellar testnet. It is
            not yet audited and is not a medical device. Do not rely on it for
            emergency treatment decisions.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Not a substitute for professional medical judgment
          </h2>
          <p>
            Lafiya is an information aid. Verified indicators reflect that a
            record was attested by a registered health worker; they are not a
            clinical guarantee. Treatment decisions remain the responsibility of
            the attending clinician.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            User responsibilities
          </h2>
          <p>
            You are responsible for keeping your credentials secure and for the
            accuracy of the information on your card. Do not enter information
            you know to be false or misleading.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Availability
          </h2>
          <p>
            Lafiya is provided as-is, without warranties of any kind. We do not
            guarantee continuous or error-free operation. The service may be
            modified, suspended, or discontinued at any time.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Governing law
          </h2>
          <p>
            Lafiya is developed under the Nigeria Data Protection Act (2023) and
            is designed to comply with its requirements for consent, encryption,
            and minimal disclosure.
          </p>
        </section>
      </div>
    </div>
  );
}
