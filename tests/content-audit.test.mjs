import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
test("content audit emits machine-readable JSON", () => {
  const result = spawnSync(process.execPath, ["scripts/audit-content.mjs", "--json"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(typeof report.summary.errors, "number");
  assert.ok(Array.isArray(report.findings));
});
