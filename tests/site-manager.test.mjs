import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const run = (...args) =>
  spawnSync(process.execPath, ["scripts/site-manager.mjs", ...args], {
    cwd: root,
    encoding: "utf8",
  });

test("site manager provides a task-oriented beginner help", () => {
  const result = run("--help");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /サイトを初めて触る人向け/);
  assert.match(result.stdout, /本番公開、D1 migration、Worker deployは自動実行しません/);
  assert.match(result.stdout, /preview start/);
  assert.match(result.stdout, /release/);
});

test("site manager status is machine-readable and non-mutating", () => {
  const result = run("status", "--json");
  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(result.stdout);
  assert.equal(typeof status.node.current, "string");
  assert.equal(typeof status.dependenciesInstalled, "boolean");
  assert.equal(typeof status.git.changes, "number");
  assert.equal(typeof status.devServer.running, "boolean");
  assert.equal(typeof status.devServer.message, "string");
  assert.equal(status.content.total, status.content.published + status.content.drafts);
});

test("site manager doctor checks local prerequisites without deploying", () => {
  const result = run("doctor", "--json");
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.ok(report.checks.some(({ id }) => id === "content"));
  assert.ok(report.checks.some(({ id }) => id === "redirects"));
});

test("site manager rejects unknown preview actions", () => {
  const result = run("preview", "restart");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /preview は start, status, logs, stop/);
});
