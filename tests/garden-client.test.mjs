import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";
import { createServer } from "vite";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});
const cardModule = await vite.ssrLoadModule("/src/lib/garden-card.ts");
const formatModule = await vite.ssrLoadModule("/src/lib/garden-format.ts");

after(() => vite.close());

test("Garden client never persists authoritative state or queued commands", async () => {
  const sources = await Promise.all(
    [
      "../src/components/GardenGame.astro",
      "../src/lib/garden-api.ts",
      "../src/lib/garden-card.ts",
      "../src/lib/garden-format.ts",
      "../src/lib/garden-types.ts",
    ].map(readSource),
  );
  const combined = sources.join("\n");

  assert.doesNotMatch(combined, /\blocalStorage\b/);
  assert.doesNotMatch(combined, /\bsessionStorage\b/);
  assert.doesNotMatch(combined, /\bdocument\.cookie\b/);
  assert.doesNotMatch(combined, /growthTicks\s*(?:\+\+|\+=)/);
  assert.doesNotMatch(combined, /careTicks\s*(?:\+\+|\+=|-=)/);
});

test("CARE batches up to 25 CPS and discards unsent input when offline", async () => {
  const game = await readSource("../src/components/GardenGame.astro");

  assert.match(game, /const MAX_CARE_PER_SECOND = 25/);
  assert.match(game, /const CARE_BATCH_MS = 1_000/);
  assert.match(game, /pendingCare\s*>=\s*MAX_CARE_PER_SECOND/);
  assert.match(game, /Math\.min\(MAX_CARE_PER_SECOND,\s*pendingCare\)/);
  assert.match(game, /setTimeout\(\(\)\s*=>\s*void flushCare\(\),\s*CARE_BATCH_MS\)/);
  assert.match(game, /setInterval\(queueCare,\s*40\)/);
  assert.match(
    game,
    /if \(mode === "offline"\)[\s\S]*?clearTimeout\(careTimer\)[\s\S]*?pendingCare = 0/,
  );
  assert.match(
    game,
    /const reconnect = async \(\) => \{[\s\S]*?clearTimeout\(careTimer\)[\s\S]*?pendingCare = 0[\s\S]*?updateCarePips\(\)[\s\S]*?setConnection\("loading"\)/,
  );
});

test("ARCHIVE PLATE uses an opaque 1200x1500 canvas with exact section bands", async () => {
  const [game, card] = await Promise.all([
    readSource("../src/components/GardenGame.astro"),
    readSource("../src/lib/garden-card.ts"),
  ]);

  assert.match(game, /<canvas width="1200" height="1500"/);
  assert.match(card, /canvas\.width = 1_200/);
  assert.match(card, /canvas\.height = 1_500/);
  assert.match(card, /getContext\("2d",\s*\{\s*alpha:\s*false/);
  assert.match(card, /colorSpace:\s*"srgb"/);
  assert.match(card, /const specimenY = 140/);
  assert.match(card, /const specimenHeight = 760/);
  assert.match(card, /const recordY = 900/);
  assert.match(card, /const footerY = 1_330/);
  assert.match(card, /fillRect\(0,\s*0,\s*1_200,\s*1_500\)/);
});

test("card open and every export request a fresh certified snapshot", async () => {
  const game = await readSource("../src/components/GardenGame.astro");
  const openCard = game.match(/const openCard = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? "";
  const buildFreshCard =
    game.match(/const buildFreshCardFile = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? "";

  assert.match(openCard, /await refreshCardSnapshot\(\)/);
  assert.match(buildFreshCard, /await refreshCardSnapshot\(\)/);
  assert.match(game, /downloadButton\.addEventListener\("click"/);
  assert.match(game, /copyButton\.addEventListener\("click"/);
  assert.match(game, /shareButton\.addEventListener\("click"/);
});

test("card has an HTML mirror, clipboard copy, download, and file-only Web Share", async () => {
  const game = await readSource("../src/components/GardenGame.astro");
  const shareHandler =
    game.match(
      /shareButton\.addEventListener\("click", \(\) => \{[\s\S]*?\n {2}\}\);\n\n {2}window\.addEventListener/,
    )?.[0] ?? "";

  assert.match(game, /<dl>[\s\S]*?data-card-mirror="nickname"[\s\S]*?<\/dl>/);
  assert.doesNotMatch(game, /<textarea/);
  assert.match(game, /data-copy-card hidden/);
  assert.match(game, /typeof ClipboardItem === "function"/);
  assert.match(game, /navigator\.clipboard\.write\(\[new ClipboardItem/);
  assert.match(game, /PNG画像をクリップボードへコピーしました/);
  assert.match(game, /data-share-card hidden/);
  assert.match(game, /navigator\.canShare\(\{\s*files:\s*\[probe\]\s*\}\)/);
  assert.match(game, /const SHARE_FILE_TTL_MS = 30_000/);
  assert.match(game, /const prepareShareFile = async \(\)/);
  assert.match(game, /const file = await buildFreshCardFile\(\)/);
  assert.match(game, /準備完了：共有する/);
  assert.match(
    shareHandler,
    /sharePromise = navigator\.share\(\{\s*files:\s*\[prepared\.file\]\s*\}\)/,
  );
  assert.doesNotMatch(shareHandler, /\bawait\b/);
  assert.doesNotMatch(game, /navigator\.share\(\{[^}]*?(?:text|title|url)\s*:/s);
  assert.match(
    game,
    /cardDialog\.addEventListener\("close", \(\) => discardPreparedShareFile\(\)\)/,
  );
  assert.match(
    game,
    /const handleCardDecorationChange = \(\) => \{[\s\S]*?discardPreparedShareFile/,
  );
});

test("card comparison catalog is approximate and uses generic silhouettes", async () => {
  const card = await readSource("../src/lib/garden-card.ts");
  const expectedSilhouettes = [
    "coin",
    "phone",
    "person",
    "giraffe",
    "bus",
    "whale",
    "tower",
    "fuji",
    "earth",
  ];

  for (const label of [
    "硬貨の直径",
    "スマートフォン",
    "人の身長",
    "キリン",
    "路線バス",
    "シロナガスクジラ",
    "高い塔",
    "富士山",
    "地球の直径",
    "えんどう豆",
    "プリン",
    "LPレコード",
    "ゲームコントローラー",
  ]) {
    assert.match(card, new RegExp(label));
  }
  assert.match(card, /Math\.abs\(Math\.log\(safe \/ candidate\.lengthMm\)\)/);
  assert.match(card, /SCALE_SILHOUETTE_SVGS/);
  assert.match(card, /<svg[\s\S]*?viewBox=/);
  assert.match(card, /data:image\/svg\+xml/);
  assert.match(card, /context\.drawImage\(image/);
  assert.match(card, /drawScaleSilhouetteFallback/);
  assert.match(card, /drawScaleCaption/);
  assert.match(card, /NEAREST SCALE \/ APPROX\./);
  assert.match(card, /comparison\.label/);
  assert.match(
    card,
    /drawImage\(\s*profileImage,\s*0,\s*0,\s*sourceWidth,\s*sourceHeight,\s*imageX,\s*imageY,\s*imageSize,\s*imageSize/,
  );
  assert.deepEqual(Object.keys(cardModule.SCALE_SILHOUETTE_SVGS), expectedSilhouettes);
  assert.equal(new Set(Object.values(cardModule.SCALE_SILHOUETTE_SVGS)).size, 9);
  for (const [key, svg] of Object.entries(cardModule.SCALE_SILHOUETTE_SVGS)) {
    assert.match(svg, /fill="none"/, `${key} has a readable outline`);
    assert.match(svg, /stroke="currentColor"/, `${key} follows both card themes`);
    assert.ok(svg.length > 250, `${key} has object-specific visual detail`);
    assert.match(card, new RegExp(`key === "${key}"`), `${key} has a canvas fallback`);
  }
  assert.doesNotMatch(card, /<(?:image|use)\b|(?:href|logo)\s*=/i);
});

test("specimen, comparison art, and ruler share one physical scale", () => {
  for (const [millimeters, expectedKey] of [
    [6_000, "giraffe"],
    [13_980, "bus"],
    [50_000, "whale"],
    [10_000_000, "fuji"],
  ]) {
    const ticks = millimeters * 8;
    const comparison = cardModule.getScaleComparison(ticks);
    const guide = cardModule.getSpecimenScaleGuide(ticks, comparison);

    assert.equal(comparison.key, expectedKey);
    assert.ok(guide.maximumMm >= Math.max(millimeters, comparison.lengthMm));
    assert.ok(guide.stepMm > 0);
    assert.ok(guide.pixelsPerMm > 0);
    assert.ok(
      Math.abs(guide.growthPixels / guide.comparisonPixels - millimeters / comparison.lengthMm) <
        1e-12,
    );
    assert.equal(guide.growthPixels / millimeters, guide.pixelsPerMm);
    assert.equal(guide.comparisonPixels / comparison.lengthMm, guide.pixelsPerMm);
  }
});

test("client balance helpers match the server cost and scenery milestones", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((level) => formatModule.nextUpgradeCost(160, level)),
    [160, 256, 410, 656, 1050],
  );
  assert.deepEqual(
    [0, 1, 2, 3].map((level) => formatModule.nextUpgradeCost(240, level)),
    [240, 384, 615, 984],
  );
  assert.deepEqual(formatModule.scenesForGrowth(799), ["plot"]);
  assert.deepEqual(formatModule.scenesForGrowth(800), ["plot", "table"]);
  assert.equal(formatModule.scenesForGrowth(47_999).includes("street"), false);
  assert.equal(formatModule.scenesForGrowth(48_000).includes("street"), true);
});

test("nearest-scale uses logarithmic distance across the complete catalog", () => {
  const cases = [
    [23.5, "coin"],
    [147, "phone"],
    [1_700, "person"],
    [5_000, "giraffe"],
    [12_000, "bus"],
    [25_000, "whale"],
    [333_000, "tower"],
    [3_776_000, "fuji"],
    [12_742_000_000, "earth"],
  ];
  for (const [millimeters, expected] of cases) {
    assert.equal(cardModule.getScaleComparison(millimeters * 8).key, expected);
  }

  const coinPhoneBoundary = Math.sqrt(23.5 * 147);
  assert.equal(cardModule.getScaleComparison((coinPhoneBoundary - 0.001) * 8).key, "coin");
  assert.equal(cardModule.getScaleComparison((coinPhoneBoundary + 0.001) * 8).key, "phone");
});

test("odd-index cycles every meter so every playful object appears after card unlock", () => {
  for (const [millimeters, expected] of [
    [6_000, "record"],
    [7_000, "controller"],
    [8_000, "pea"],
    [9_000, "pudding"],
  ]) {
    const comparison = cardModule.getOddComparison(millimeters * 8);
    assert.equal(comparison.key, expected);
    assert.ok(comparison.count > 1);
    assert.equal(comparison.approximate, true);
  }
});
