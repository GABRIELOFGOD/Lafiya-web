import Image from "next/image";

import { generateQrDataUrl } from "@/lib/qr/generateQrDataUrl";

import { CopyLinkButton } from "./copy-link-button";
import { RegenerateCardButton } from "./regenerate-card-button";

export async function QrCardDisplay({ cardUrl }: { cardUrl: string }) {
  const qrDataUrl = await generateQrDataUrl(cardUrl);

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-zinc-300 p-6 text-center dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Your emergency card
      </p>
      <Image
        src={qrDataUrl}
        alt="QR code linking to your public emergency card"
        width={200}
        height={200}
        unoptimized
        className="rounded-md"
      />
      <p className="max-w-xs text-xs break-all text-zinc-500 dark:text-zinc-500">
        {cardUrl}
      </p>
      <div className="flex gap-3">
        <CopyLinkButton text={cardUrl} />
        <RegenerateCardButton />
      </div>
    </div>
  );
}
