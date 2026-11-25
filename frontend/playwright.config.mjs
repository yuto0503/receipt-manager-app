import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "ci-e2e.spec.mjs",
  // The existing scripts share the mock API's records and failure modes.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  maxFailures: 1,
  forbidOnly: Boolean(process.env.CI),
  timeout: 180_000,
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  webServer: [
    {
      name: "Mock API",
      command: "node tests/mock-api.mjs",
      url: "http://127.0.0.1:18080/receipts",
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      name: "Next.js",
      command: "npm run start -- --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100/receipts",
      env: { SERVER_API_BASE_URL: "http://127.0.0.1:18080" },
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
