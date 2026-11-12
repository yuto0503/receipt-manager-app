import assert from "node:assert/strict";
import test from "node:test";

test("CI verification: deliberate frontend failure", () => {
  assert.fail("CI_FAILURE_PROBE_FRONTEND: intentional failure on verification branch only");
});
