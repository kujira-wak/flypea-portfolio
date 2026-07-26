import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = `${root}dist`;

const requiredPages = new Map([
  ["index.html", "https://flypea.tech/"],
  ["index/index.html", "https://flypea.tech/index/"],
  ["projects/index.html", "https://flypea.tech/projects/"],
  ["projects/flypea-tech/index.html", "https://flypea.tech/projects/flypea-tech/"],
  [
    "projects/portfolio-foundation/index.html",
    "https://flypea.tech/projects/portfolio-foundation/",
  ],
  ["notes/index.html", "https://flypea.tech/notes/"],
  [
    "notes/astro-portfolio-foundation/index.html",
    "https://flypea.tech/notes/astro-portfolio-foundation/",
  ],
  ["notes/domain-and-deploy/index.html", "https://flypea.tech/notes/domain-and-deploy/"],
  ["shelf/index.html", "https://flypea.tech/shelf/"],
  ["about/index.html", "https://flypea.tech/about/"],
]);

const hiddenPages = new Map([
  ["garden-000/index.html", "https://flypea.tech/garden-000/"],
  ["admin/garden/index.html", "https://flypea.tech/admin/garden/"],
]);
for (const [path, canonical] of hiddenPages) {
  const html = await readFile(`${dist}/${path}`, "utf8");
  if (!html.includes('<meta name="robots" content="noindex, nofollow">')) {
    throw new Error(`${path}: hidden page must use noindex, nofollow`);
  }
  if (!html.includes(`<link rel="canonical" href="${canonical}">`)) {
    throw new Error(`${path}: canonical URL is missing or incorrect`);
  }
}

const gardenHtml = await readFile(`${dist}/garden-000/index.html`, "utf8");
if (
  gardenHtml.includes('aria-label="メインナビゲーション"') ||
  gardenHtml.includes('href="/admin/garden/"')
) {
  throw new Error(
    "garden-000/index.html: hidden game must not expose standard or admin navigation",
  );
}

const gardenAdminHtml = await readFile(`${dist}/admin/garden/index.html`, "utf8");
for (const localOnlyText of ["LOCAL SETUP", "worker/.dev.vars", "ローカル管理トークン"]) {
  if (gardenAdminHtml.includes(localOnlyText)) {
    throw new Error(`admin/garden/index.html: production build includes ${localOnlyText}`);
  }
}

const homeHtml = await readFile(`${dist}/index.html`, "utf8");
if (!homeHtml.includes("data-garden-signal")) {
  throw new Error("index.html: hidden Garden signal control is missing");
}
const aboutHtml = await readFile(`${dist}/about/index.html`, "utf8");
if (
  !aboutHtml.includes("data-garden-portrait-entry") ||
  !aboutHtml.includes('data-entry-path="/garden-000/"') ||
  !aboutHtml.includes('aria-disabled="true"')
) {
  throw new Error("about/index.html: locked Garden portrait entry is missing");
}

for (const path of [
  "index.html",
  "index/index.html",
  "projects/index.html",
  "notes/index.html",
  "shelf/index.html",
  "about/index.html",
]) {
  const html = await readFile(`${dist}/${path}`, "utf8");
  if (html.includes('href="/garden-000/"')) {
    throw new Error(`${path}: hidden garden entry must not be present before discovery`);
  }
  if (html.includes('href="/admin/garden/"')) {
    throw new Error(`${path}: Garden admin utility must not appear in public navigation`);
  }
}

for (const [path, canonical] of requiredPages) {
  const html = await readFile(`${dist}/${path}`, "utf8");
  if (!html.includes(`<link rel="canonical" href="${canonical}">`)) {
    throw new Error(`${path}: canonical URL is missing or incorrect`);
  }
  if (!html.includes('property="og:image" content="https://flypea.tech/og.png"')) {
    throw new Error(`${path}: shared OGP image is missing`);
  }
  if (!html.includes('name="twitter:card" content="summary_large_image"')) {
    throw new Error(`${path}: Twitter Card metadata is missing`);
  }
}

for (const path of [
  "notes/astro-portfolio-foundation/index.html",
  "notes/domain-and-deploy/index.html",
]) {
  const html = await readFile(`${dist}/${path}`, "utf8");
  if (!html.includes('property="og:type" content="article"')) {
    throw new Error(`${path}: Note detail must use og:type=article`);
  }
}

const notesHtml = await readFile(`${dist}/notes/index.html`, "utf8");
const reactionIds = [...notesHtml.matchAll(/data-entry-id="([a-z0-9-]+)"/g)].map(
  (match) => match[1],
);
if (reactionIds.length !== new Set(reactionIds).size)
  throw new Error("reactionId values must be unique");
for (const id of ["astro-portfolio-foundation", "domain-and-deploy"]) {
  if (!reactionIds.includes(id)) throw new Error(`Migrated reactionId is missing: ${id}`);
}

const redirects = new Map([
  ["works/index.html", "/projects/"],
  ["works/flypea-tech/index.html", "/projects/flypea-tech"],
  ["log/index.html", "/notes/"],
  ["log/domain-and-deploy/index.html", "/notes/domain-and-deploy"],
  ["profile/index.html", "/about/"],
]);
for (const [path, target] of redirects) {
  const html = await readFile(`${dist}/${path}`, "utf8");
  if (!html.includes(`http-equiv="refresh" content="0;url=${target}"`)) {
    throw new Error(`${path}: redirect fallback does not target ${target}`);
  }
}

const og = await readFile(`${dist}/og.png`);
if (og.readUInt32BE(16) !== 1200 || og.readUInt32BE(20) !== 630) {
  throw new Error("og.png must be 1200 × 630 pixels");
}

const assets = await readdir(`${dist}/_astro`);
if (!assets.some((asset) => asset.endsWith(".woff2"))) {
  throw new Error("Self-hosted WOFF2 fonts are missing from the build");
}

console.log(
  `Validated ${requiredPages.size} canonical pages, ${hiddenPages.size} hidden pages, ${redirects.size} redirects, metadata, reactions, fonts, and OGP.`,
);
