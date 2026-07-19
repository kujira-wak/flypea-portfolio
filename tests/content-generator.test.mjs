import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const script = `${root}scripts/new-content.mjs`;

const generate = (outputDir, args) => {
  const result = spawnSync(process.execPath, [script, ...args, "--outputDir", outputDir], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
};

test("content generator writes schema-aligned Project, Note, and Shelf drafts", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "flypea-content-"));
  try {
    generate(outputDir, [
      "--type",
      "project",
      "--slug",
      "sample-project",
      "--title",
      "Sample project",
      "--description",
      "Project description",
      "--topics",
      "software,web",
      "--technologies",
      "astro,typescript",
      "--status",
      "active",
      "--order",
      "12",
      "--role",
      "Design and development",
      "--liveUrl",
      "https://example.com/project",
    ]);
    generate(outputDir, [
      "--type",
      "note",
      "--slug",
      "sample-note",
      "--title",
      "Sample note",
      "--description",
      "Note description",
      "--topics",
      "ui",
      "--technologies",
      "tailwind-css",
    ]);
    generate(outputDir, [
      "--type",
      "shelf",
      "--slug",
      "sample-shelf",
      "--title",
      "Sample shelf",
      "--description",
      "Shelf description",
      "--topics",
      "music",
      "--kind",
      "music",
      "--creator",
      "Sample Artist",
      "--externalUrl",
      "https://example.com/music",
    ]);

    const project = await readFile(join(outputDir, "sample-project.md"), "utf8");
    const note = await readFile(join(outputDir, "sample-note.md"), "utf8");
    const shelf = await readFile(join(outputDir, "sample-shelf.md"), "utf8");
    assert.match(project, /type: project/);
    assert.match(project, /order: 12/);
    assert.match(project, /role: "Design and development"/);
    assert.match(project, /liveUrl: "https:\/\/example\.com\/project"/);
    assert.match(project, /draft: true/);
    assert.match(note, /reactionId: sample-note/);
    assert.match(note, /status: completed/);
    assert.match(shelf, /kind: music/);
    assert.match(shelf, /creator: "Sample Artist"/);
    assert.match(shelf, /externalUrl: "https:\/\/example\.com\/music"/);
    assert.match(shelf, /addedAt: \d{4}-\d{2}-\d{2}/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("content generator rejects taxonomy IDs that are not defined", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "flypea-content-invalid-"));
  try {
    const result = spawnSync(
      process.execPath,
      [
        script,
        "--type",
        "note",
        "--slug",
        "invalid-note",
        "--title",
        "Invalid",
        "--description",
        "Invalid taxonomy",
        "--topics",
        "not-defined",
        "--outputDir",
        outputDir,
      ],
      { cwd: root, encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /未定義のID/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
