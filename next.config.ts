import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Local Supabase Storage (supabase start)
      { protocol: "http", hostname: "127.0.0.1", port: "54321" },
      // Hosted Supabase Storage
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

const sentryWebpackPluginOptions = {
  silent: true,
  org: "lafiya",
  project: "lafiya-web",
  // Disable source map upload if we don't have the auth token to avoid build failures
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
