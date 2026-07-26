import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../src/pages/admin/index.astro", import.meta.url);

test("the integrated admin dashboard keeps the existing protected APIs and token convention", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.match(page, /pathname="\/admin\/"/);
  assert.match(page, /robots="noindex, nofollow"/);
  assert.match(page, /const storageKey = "flypea:admin-token"/);
  assert.match(page, /\/api\/reactions\/admin\/stats/);
  assert.match(page, /\/api\/garden\/admin\/players\?limit=100&includeHidden=true/);
  assert.match(page, /authorization", `Bearer \$\{token\}`/);
  assert.match(page, /credentials: "same-origin"/);
  assert.match(page, /AbortSignal\.timeout\(8000\)/);
});

test("the integrated admin dashboard can manage and filter Garden visibility", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.match(page, /data-player-filter/);
  assert.match(page, /data-visibility-filter/);
  assert.match(page, /method: "PATCH"/);
  assert.match(page, /JSON\.stringify\(\{ hidden \}\)/);
  assert.match(page, /renderOverview\(\)/);
  assert.match(page, /renderGardenRows\(\)/);
});

test("the integrated admin dashboard can explicitly forget its tab-scoped credential", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.match(page, /data-admin-forget/);
  assert.match(page, /window\.sessionStorage\.removeItem\(storageKey\)/);
  assert.match(page, /dashboard\.hidden = true/);
  assert.doesNotMatch(page, /window\.localStorage/);
});

test("the existing focused admin screens link back to the integrated dashboard", async () => {
  const [reactionPage, gardenPage] = await Promise.all([
    readFile(new URL("../src/pages/admin/reactions.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/admin/garden.astro", import.meta.url), "utf8"),
  ]);

  assert.match(reactionPage, /href="\/admin\/"/);
  assert.match(gardenPage, /href="\/admin\/"/);
});
