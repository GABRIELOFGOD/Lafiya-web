import Link from "next/link";

export const metadata = {
  title: "Privacy Notice | Lafiya",
  description:
    "Lafiya Privacy Notice and Nigeria Data Protection Act (2023) Compliance information.",
};

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <main className="w-full max-w-2xl">
        <Link
          href="/signup"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          &larr; Back to signup
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Privacy Notice
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Last updated: July 18, 2026 · Version: ndpa-2023-v1
        </p>

        <div className="prose prose-zinc dark:prose-invert mt-8 flex flex-col gap-6 text-zinc-600 dark:text-zinc-400">
          <p>
            Lafiya (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is
            committed to protecting your privacy. This Privacy Notice explains
            how we collect, use, disclose, and safeguard your personal and
            sensitive health data when you use the Lafiya platform, in
            compliance with the{" "}
            <strong>Nigeria Data Protection Act (2023)</strong>.
          </p>

          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              1. Consent and Control
            </h2>
            <p className="mt-2">
              By signing up for a Lafiya account, you provide explicit consent
              for the processing of your personal and health data (including
              blood group, genotype, allergies, medications, and chronic
              conditions). You maintain complete ownership of your data and can
              view, modify, or delete your health information at any time from
              your profile.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              2. Data Minimization & Security
            </h2>
            <p className="mt-2">
              We adhere strictly to the principle of data minimization:
            </p>
            <ul className="mt-2 list-disc pl-5 flex flex-col gap-1">
              <li>
                Only the minimal medical details necessary for emergency response
                are collected.
              </li>
              <li>
                Your personal health data is stored in an encrypted off-chain
                database and is never placed on the public blockchain.
              </li>
              <li>
                We only anchor cryptographic, non-reversible hashes on the
                Stellar blockchain to attest the validity of your credentials
                without leaking the underlying data.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              3. Minimal Disclosure & Public Sharing
            </h2>
            <p className="mt-2">
              You choose exactly what emergency subset details are shown on your
              public responder page. The public page is accessed via a secure,
              unguessable public ID encoded in your QR code, ensuring third
              parties cannot discover your details without scanning your
              physical card.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              4. Your Rights Under NDPA 2023
            </h2>
            <p className="mt-2">
              Under the Nigeria Data Protection Act (2023), you have the right
              to request access to, correction of, or erasure of your personal
              data. You may withdraw your consent at any time by deleting your
              account, which completely purges your health profile from our
              systems.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
