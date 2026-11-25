import { test } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const frontend = fileURLToPath(new URL("../", import.meta.url));

// Keep the real Go/MySQL acceptance script out of this mock-backed suite.
for (const name of [
  "navigation",
  "layout",
  "list",
  "form",
  "create",
  "detail",
  "edit",
  "delete",
]) {
  test(`receipt-${name}`, async ({}, testInfo) => {
    const env = {
      ...process.env,
      RECEIPT_UI_TEST_URL: "http://127.0.0.1:3100",
      RECEIPT_TEST_API_URL: "http://127.0.0.1:18080",
      RECEIPT_E2E_OUTPUT_DIR: testInfo.outputPath("screenshots"),
    };
    // Always use the locked Playwright package and its bundled Chromium.
    delete env.PLAYWRIGHT_MODULE;
    delete env.PLAYWRIGHT_CHANNEL;
    let output;
    try {
      output = await run(process.execPath, [`tests/receipt-${name}.e2e.mjs`], {
        cwd: frontend,
        env,
        timeout: 150_000,
        killSignal: "SIGKILL",
        maxBuffer: 5 * 1024 * 1024,
      });
    } catch (error) {
      output = error;
      throw error;
    } finally {
      const log = `${output?.stdout ?? ""}${output?.stderr ?? ""}`;
      console.log(log);
      await testInfo.attach("script-output", {
        body: log,
        contentType: "text/plain",
      });
    }
  });
}
