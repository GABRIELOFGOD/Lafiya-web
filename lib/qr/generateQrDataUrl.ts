import QRCode from "qrcode";

/**
 * Renders `text` (the public card URL) as a scannable QR code, returned as a
 * data: URL so it can be embedded directly in an <img> with no extra route
 * or client JS needed to display it.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
  });
}
