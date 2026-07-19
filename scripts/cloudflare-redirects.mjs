import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourcePath = `${root}cloudflare/redirects.json`;
const outputPath = `${root}cloudflare/redirects.csv`;
const entries = JSON.parse(await readFile(sourcePath, "utf8"));

if (!Array.isArray(entries)) throw new Error("cloudflare/redirects.json must be an array");

const csvValue = (value) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const rows = entries.map((entry, index) => {
  const source = new URL(entry.source);
  const target = new URL(entry.target);
  if (source.search) throw new Error(`redirects[${index}].source cannot contain a query string`);
  if (source.href === target.href) throw new Error(`redirects[${index}] redirects to itself`);
  const status = entry.status ?? 301;
  if (![301, 302, 307, 308].includes(status))
    throw new Error(`redirects[${index}].status is invalid`);
  return [
    source.href,
    target.href,
    status,
    entry.preserveQuery !== false,
    entry.includeSubdomains === true,
    entry.subpathMatching === true,
    entry.preservePathSuffix === true,
  ]
    .map(csvValue)
    .join(",");
});

const output = rows.length ? `${rows.join("\n")}\n` : "";
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = await readFile(outputPath, "utf8");
  } catch {
    // 初回は未生成として差分を報告します。
  }
  if (current !== output)
    throw new Error("cloudflare/redirects.csv is stale; run npm run redirects:build");
} else {
  await writeFile(outputPath, output);
  console.log(`Generated ${entries.length} redirect(s): cloudflare/redirects.csv`);
}
