import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

const envTestPath = path.resolve(__dirname, ".env.test");
if (fs.existsSync(envTestPath)) {
  process.loadEnvFile(envTestPath);
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    name: "integration",
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // Real network calls to a local Supabase stack are slower than jsdom
    // unit tests; give them room rather than flaking under load.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
