import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GARDEN_DISCOVERY_HASH,
  GARDEN_DISCOVERY_URL,
  GARDEN_SIGNAL_THRESHOLD,
  isGardenDiscoveryHash,
} from "../src/lib/garden-discovery.mjs";

test("garden discovery requires three in-page activations", () => {
  assert.equal(GARDEN_SIGNAL_THRESHOLD, 3);
});

test("garden discovery uses a transient About URL hash", () => {
  assert.equal(GARDEN_DISCOVERY_HASH, "#garden-signal");
  assert.equal(GARDEN_DISCOVERY_URL, "/about/#garden-signal");
  assert.equal(isGardenDiscoveryHash("#garden-signal"), true);
  assert.equal(isGardenDiscoveryHash("#GARDEN-SIGNAL"), true);
  assert.equal(isGardenDiscoveryHash("#garden-signal-other"), false);
});

test("discovery UI never persists progress in web storage", async () => {
  const sources = await Promise.all(
    [
      "../src/components/SignalField.astro",
      "../src/components/GardenPortraitEntry.astro",
      "../src/lib/garden-discovery.mjs",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  const combined = sources.join("\n");
  assert.doesNotMatch(combined, /\blocalStorage\b/);
  assert.doesNotMatch(combined, /\bsessionStorage\b/);
  assert.doesNotMatch(combined, /\bdocument\.cookie\b/);
  assert.match(sources[0], /<button[\s\S]*?data-garden-signal/);
  assert.match(sources[0], /window\.location\.assign\(GARDEN_DISCOVERY_URL\)/);
  assert.match(sources[1], /aria-disabled="true"/);
  assert.match(sources[1], /fetch\("\/api\/garden\/session"/);
  const portraitAnchor = sources[1].match(/<a[\s\S]*?>/)?.[0] ?? "";
  assert.doesNotMatch(portraitAnchor, /\shref=/);
  assert.match(portraitAnchor, /data-entry-path="\/garden-000\/"/);
});
