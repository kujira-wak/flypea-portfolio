import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const collections = { project: "projects", note: "notes", shelf: "shelf" };
export const taxonomyKinds = {
  topic: "topics",
  technology: "technologies",
  status: "statuses",
  "shelf-kind": "shelfKinds",
};
export const taxonomyPath = join(root, "src/data/taxonomy.json");
export const loadTaxonomy = async () => JSON.parse(await readFile(taxonomyPath, "utf8"));
export const saveTaxonomy = (value) =>
  writeFile(taxonomyPath, `${JSON.stringify(value, null, 2)}\n`);
export const contentPath = (type, slug) =>
  join(root, "src/content", collections[type], `${slug}.md`);
export const contentFiles = async () => {
  const result = [];
  for (const [type, directory] of Object.entries(collections)) {
    const dir = join(root, "src/content", directory);
    const visit = async (current) => {
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const path = join(current, entry.name);
        if (entry.isDirectory()) await visit(path);
        else if (entry.name.endsWith(".md") && !entry.name.startsWith("_"))
          result.push({
            type,
            path,
            slug: relative(dir, path).replace(/\.md$/, ""),
          });
      }
    };
    await visit(dir);
  }
  return result;
};
const scalar = (raw) => {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  )
    return value.startsWith('"') ? JSON.parse(value) : value.slice(1, -1);
  if (value === "true" || value === "false") return value === "true";
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^\[.*\]$/.test(value))
    return value
      .slice(1, -1)
      .split(",")
      .map((x) => scalar(x))
      .filter(Boolean);
  return value;
};
export const parseDocument = (text) => {
  if (!text.startsWith("---\n")) throw new Error("Frontmatter is missing.");
  const end = text.indexOf("\n---", 4);
  if (end < 0) throw new Error("Frontmatter is not closed.");
  const data = {};
  const lines = text.slice(4, end).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^([^:#][^:]*):(?:\s?(.*))?$/);
    if (!match) continue;
    const [, key, raw = ""] = match;
    if (raw !== "") data[key] = scalar(raw);
    else {
      const values = [];
      while (lines[i + 1]?.match(/^\s+-\s+/))
        values.push(scalar(lines[++i].replace(/^\s+-\s+/, "")));
      data[key] = values;
    }
  }
  return { data, body: text.slice(end + 5).replace(/^\n/, "") };
};
const renderValue = (value) =>
  typeof value === "string"
    ? /^[a-z0-9-]+$/.test(value)
      ? value
      : JSON.stringify(value)
    : String(value);
export const renderDocument = ({ data, body }) =>
  `---\n${Object.entries(data)
    .map(([key, value]) =>
      Array.isArray(value)
        ? `${key}:\n${value.map((x) => `  - ${renderValue(x)}`).join("\n")}`
        : `${key}: ${renderValue(value)}`,
    )
    .join("\n")}\n---\n\n${body.replace(/^\n+/, "").replace(/\s*$/, "")}\n`;
export const loadContent = async () =>
  Promise.all(
    (await contentFiles()).map(async (item) => ({
      ...item,
      ...parseDocument(await readFile(item.path, "utf8")),
    })),
  );
export const displayPath = (path) => relative(root, resolve(path));
export const writeTransaction = async (changes) => {
  const staged = [];
  try {
    for (const { path, content } of changes) {
      await mkdir(dirname(path), { recursive: true });
      const temporaryPath = `${path}.content-manager-${process.pid}.tmp`;
      await writeFile(temporaryPath, content, "utf8");
      staged.push({ path, temporaryPath });
    }
    for (const { path, temporaryPath } of staged) await rename(temporaryPath, path);
  } catch (error) {
    await Promise.all(
      staged.map(({ temporaryPath }) =>
        import("node:fs/promises").then(({ rm }) => rm(temporaryPath, { force: true })),
      ),
    );
    throw error;
  }
};
