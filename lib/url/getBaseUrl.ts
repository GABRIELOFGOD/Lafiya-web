import { headers } from "next/headers";

/**
 * Derives the site's own origin from the incoming request rather than a
 * hardcoded env var, so QR codes/links are correct on localhost, any Vercel
 * preview URL, and the eventual production domain without extra config.
 */
export async function getBaseUrl(): Promise<string> {
  const headersList = await headers();
  const host =
    headersList.get("x-forwarded-host") ??
    headersList.get("host") ??
    "localhost:3000";
  const protocol =
    headersList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${protocol}://${host}`;
}
