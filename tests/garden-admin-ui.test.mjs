import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Astro development proxies the Garden API to the Worker", async () => {
  const config = await readFile(new URL("../astro.config.mjs", import.meta.url), "utf8");
  assert.match(config, /"\/api\/garden":\s*"http:\/\/localhost:8787"/);
});

test("Garden administration follows the existing ADMIN_TOKEN convention", async () => {
  const page = await readFile(new URL("../src/pages/admin/garden.astro", import.meta.url), "utf8");

  assert.match(page, /robots="noindex, nofollow"/);
  assert.match(page, /const isDevelopment = import\.meta\.env\.DEV/);
  assert.match(page, /isDevelopment &&/);
  assert.match(page, /worker\/\.dev\.vars\.example/);
  assert.match(page, /worker\/\.dev\.vars/);
  assert.match(page, /ADMIN_TOKEN=/);
  assert.match(page, /const storageKey = "flypea:admin-token"/);
  assert.match(page, /authorization: `Bearer \$\{token\}`/);
  assert.match(page, /\/api\/garden\/admin\/players\?limit=100&includeHidden=true/);
  assert.match(page, /method: "PATCH"/);
  assert.match(page, /JSON\.stringify\(\{ hidden \}\)/);
});
