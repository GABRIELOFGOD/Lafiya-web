import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lafiya — Your vitals, verified",
  description:
    "A patient-owned emergency health card on Stellar. Your vitals, verified. When you can't speak, Lafiya does.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <footer className="mt-auto border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <nav className="flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <Link href="/privacy" className="hover:text-zinc-950 dark:hover:text-zinc-50">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-zinc-950 dark:hover:text-zinc-50">
              Terms
            </Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
