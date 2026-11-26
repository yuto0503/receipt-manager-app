import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function artifactPath(name) {
  const directory = process.env.RECEIPT_E2E_OUTPUT_DIR || tmpdir();
  mkdirSync(directory, { recursive: true });
  return join(directory, name);
}
