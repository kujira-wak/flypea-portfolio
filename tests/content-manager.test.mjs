import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const run = (...args) =>
  spawnSync(process.execPath, ["scripts/content-manager.mjs", ...args], {
    cwd: root,
    encoding: "utf8",
  });
test("content manager lists content and rejects unsafe non-interactive deletion", () => {
  const listed = run("list", "project");
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /project/);
  const deleted = run("delete", "note", "domain-and-deploy");
  assert.notEqual(deleted.status, 0);
  assert.match(deleted.stderr, /--force/);

  const edit = run("edit", "note", "domain-and-deploy");
  assert.notEqual(edit.status, 0);
  assert.match(edit.stderr, /対話式/);
});
test("taxonomy list exposes supported taxonomy", () => {
  const result = run("taxonomy", "list", "technology");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /astro/);
});
