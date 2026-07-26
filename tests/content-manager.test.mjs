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

test("content manager explains commands and reports a machine-readable summary", () => {
  const help = run("--help");
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /publish は draft: false にするだけ/);
  assert.match(help.stdout, /npm run manage -- release/);

  const result = run("summary", "--json");
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(typeof summary.total, "number");
  assert.equal(summary.total, summary.published + summary.drafts);
  assert.equal(typeof summary.types.note.drafts, "number");
});

test("content manager inspects entries and protects paths", () => {
  const inspected = run("inspect", "note", "domain-and-deploy", "--json");
  assert.equal(inspected.status, 0, inspected.stderr);
  const details = JSON.parse(inspected.stdout);
  assert.equal(details.type, "note");
  assert.equal(details.slug, "domain-and-deploy");
  assert.match(details.file, /src\/content\/notes\/domain-and-deploy\.md/);

  const publish = run("publish", "note", "domain-and-deploy");
  assert.equal(publish.status, 0, publish.stderr);
  assert.match(publish.stdout, /すでに公開対象です/);

  const traversal = run("inspect", "note", "../../package");
  assert.notEqual(traversal.status, 0);
  assert.match(traversal.stderr, /slugは半角小文字/);
});
