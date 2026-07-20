import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import {
  contentFiles,
  displayPath,
  ID_RE,
  loadTaxonomy,
  parseDocument,
  renderDocument,
  root,
  saveTaxonomy,
} from "./content-utils.mjs";

const { values } = parseArgs({
  options: {
    strict: { type: "boolean" },
    fix: { type: "boolean" },
    interactive: { type: "boolean" },
    json: { type: "boolean" },
  },
});
const findings = [];
const add = (severity, code, file, message, extra = {}) =>
  findings.push({ severity, code, file, message, ...extra });
let taxonomy,
  contents = [];
try {
  taxonomy = await loadTaxonomy();
} catch (error) {
  add("error", "INVALID_TAXONOMY_JSON", "src/data/taxonomy.json", `Invalid JSON: ${error.message}`);
  taxonomy = {};
}
for (const [group, entries] of Object.entries(taxonomy)) {
  if (typeof entries !== "object" || !entries) continue;
  const labels = new Map();
  for (const [id, entry] of Object.entries(entries)) {
    if (!ID_RE.test(id))
      add(
        "error",
        "INVALID_TAXONOMY_ID",
        `taxonomy.${group}.${id}`,
        "Taxonomy ID format is invalid.",
      );
    if (!entry.label?.trim() || !entry.description?.trim())
      add(
        "error",
        "INVALID_TAXONOMY_ENTRY",
        `taxonomy.${group}.${id}`,
        "label and description are required.",
      );
    const lower = id.toLowerCase();
    if (labels.has(lower))
      add(
        "error",
        "DUPLICATE_TAXONOMY_ID",
        `taxonomy.${group}.${id}`,
        "Duplicate taxonomy ID (case-insensitive).",
      );
    labels.set(lower, id);
  }
  const seenLabels = new Set();
  for (const [id, entry] of Object.entries(entries)) {
    const label = entry.label?.trim().toLowerCase();
    if (label && seenLabels.has(label))
      add(
        "error",
        "DUPLICATE_TAXONOMY_LABEL",
        `taxonomy.${group}.${id}`,
        "Duplicate taxonomy label.",
      );
    seenLabels.add(label);
  }
}
for (const file of await contentFiles()) {
  try {
    const text = await readFile(file.path, "utf8");
    const parsed = parseDocument(text);
    contents.push({ ...file, ...parsed });
  } catch (error) {
    add("error", "INVALID_FRONTMATTER", displayPath(file.path), error.message);
  }
}
const required = {
  project: ["type", "title", "description", "startedAt", "status"],
  note: ["type", "title", "description", "publishedAt", "reactionId", "status"],
  shelf: ["type", "title", "description", "addedAt", "kind", "status"],
};
const reactions = new Map();
const urls = new Map();
for (const item of contents) {
  const f = displayPath(item.path),
    d = item.data;
  if (!ID_RE.test(item.slug)) add("error", "INVALID_SLUG", f, "Filename/slug format is invalid.");
  if (d.type !== item.type) add("error", "TYPE_MISMATCH", f, `type must be ${item.type}.`);
  for (const key of required[item.type])
    if (d[key] === undefined || d[key] === "")
      add("error", "MISSING_REQUIRED_FIELD", f, `Missing required field: ${key}.`);
  for (const field of ["topics", "technologies"]) {
    const values = d[field] ?? [];
    if (!Array.isArray(values)) add("error", "INVALID_ARRAY", f, `${field} must be an array.`);
    else {
      if (new Set(values).size !== values.length)
        add("error", `DUPLICATE_${field.toUpperCase()}`, f, `${field} has duplicates.`);
      for (const id of values)
        if (!taxonomy[field]?.[id])
          add(
            "error",
            `UNDEFINED_${field.slice(0, -3).toUpperCase()}`,
            f,
            `${field === "technologies" ? "Technology" : "Topic"} "${id}" is referenced but not defined.`,
            { field, value: id },
          );
    }
  }
  if (!taxonomy.statuses?.[d.status])
    add("error", "INVALID_STATUS", f, `Status "${d.status}" is not defined.`);
  if (item.type === "shelf" && !taxonomy.shelfKinds?.[d.kind])
    add("error", "INVALID_SHELF_KIND", f, `Shelf kind "${d.kind}" is not defined.`);
  for (const date of ["startedAt", "publishedAt", "addedAt", "updatedAt"])
    if (d[date] && Number.isNaN(Date.parse(d[date])))
      add("error", "INVALID_DATE", f, `Invalid date: ${date}.`);
  for (const key of ["liveUrl", "repositoryUrl", "externalUrl"])
    if (d[key])
      try {
        new URL(d[key]);
      } catch {
        add("error", "INVALID_URL", f, `Invalid URL: ${key}.`);
      }
  if (d.cover && !d.coverAlt?.trim())
    add("error", "MISSING_COVER_ALT", f, "cover requires coverAlt.");
  if (d.cover)
    try {
      await access(join(root, "src", d.cover.replace(/^\//, "")));
    } catch {
      add("error", "MISSING_COVER", f, `Cover image does not exist: ${d.cover}`);
    }
  if (!d.cover && d.coverAlt)
    add("warning", "ORPHAN_COVER_ALT", f, "coverAlt exists without cover.");
  if (
    !d.draft &&
    (!d.title?.trim() || !d.description?.trim() || !item.body.replace(/<!--.*?-->/gs, "").trim())
  )
    add(
      "error",
      "EMPTY_PUBLISHED_CONTENT",
      f,
      "Published content needs title, description, and body.",
    );
  if (["project", "note"].includes(item.type) && !(d.topics ?? []).length)
    add("warning", "EMPTY_TOPICS", f, "Project/Note has no topics.");
  if (item.type === "project" && !(d.technologies ?? []).length)
    add("warning", "EMPTY_TECHNOLOGIES", f, "Project has no technologies.");
  if (d.topics?.length > 8 || d.technologies?.length > 8)
    add("warning", "TOO_MANY_TAXONOMY", f, "Many taxonomy values assigned.");
  if (d.title === d.description)
    add("warning", "TITLE_EQUALS_DESCRIPTION", f, "Title and description are identical.");
  if (
    d.description &&
    (d.description.length < 8 || d.description.length > 180 || /[?？]$/.test(d.description))
  )
    add("warning", "DESCRIPTION_QUALITY", f, "Description may need review.");
  if (/\b(TODO|TBD)\b|あとで書く|仮/u.test(`${d.title} ${d.description} ${item.body}`))
    add("warning", "PLACEHOLDER_TEXT", f, "Temporary wording found.");
  if (d.reactionId) {
    if (!ID_RE.test(d.reactionId))
      add("error", "INVALID_REACTION_ID", f, "reactionId format is invalid.");
    if (reactions.has(d.reactionId))
      add(
        "error",
        "DUPLICATE_REACTION_ID",
        f,
        `reactionId also used by ${reactions.get(d.reactionId)}.`,
      );
    reactions.set(d.reactionId, f);
  }
  for (const key of ["liveUrl", "repositoryUrl", "externalUrl"])
    if (d[key]) {
      if (urls.has(d[key]))
        add("warning", "DUPLICATE_URL", f, `URL also used by ${urls.get(d[key])}.`);
      urls.set(d[key], f);
      if (d[key].startsWith("http://"))
        add("warning", "INSECURE_URL", f, "External URL uses http://.");
    }
  const searchable =
    `${d.title} ${d.description} ${item.body.replace(/```[\s\S]*?```/g, "")}`.toLowerCase();
  for (const [field, group] of [
    ["topics", "topics"],
    ["technologies", "technologies"],
  ])
    for (const [id, entry] of Object.entries(taxonomy[group] ?? {})) {
      if ((d[field] ?? []).includes(id)) continue;
      const terms = [id, entry.label, ...(entry.keywords ?? [])].filter(
        (x) => String(x).length >= 4,
      );
      const match = terms.find((x) => searchable.includes(String(x).toLowerCase()));
      if (match)
        add(
          "suggestion",
          `MISSING_${field.toUpperCase()}`,
          f,
          `${field === "technologies" ? "Technology" : "Topic"} "${id}" may be missing. Matched keyword: ${match}.`,
          { field, value: id },
        );
    }
}
for (const group of ["topics", "technologies"])
  for (const [id, entry] of Object.entries(taxonomy[group] ?? {}))
    if (!entry.allowUnused && !contents.some((item) => item.data[group]?.includes(id)))
      add(
        "warning",
        "UNUSED_TAXONOMY",
        `taxonomy.${group}.${id}`,
        "Defined but unused by any content.",
      );
if (values.fix) {
  for (const item of contents) {
    let changed = false;
    for (const field of ["topics", "technologies"])
      if (Array.isArray(item.data[field])) {
        const next = [...new Set(item.data[field])].sort();
        if (next.join("\0") !== item.data[field].join("\0")) {
          item.data[field] = next;
          changed = true;
        }
      }
    if (changed) {
      await writeFile(item.path, renderDocument(item));
      add(
        "info",
        "AUTO_FIXED",
        displayPath(item.path),
        "Removed duplicate taxonomy values and sorted arrays.",
      );
    }
  }
  if (taxonomy) await saveTaxonomy(taxonomy);
}
if (values.interactive && process.stdin.isTTY && process.stdout.isTTY) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (const finding of findings.filter((item) => item.severity === "suggestion")) {
      const item = contents.find((content) => displayPath(content.path) === finding.file);
      if (!item || !finding.field || !finding.value) continue;
      const answer = (await terminal.question(`${finding.file}: add ${finding.value}? [y/N] `))
        .trim()
        .toLowerCase();
      if (answer !== "y" && answer !== "yes") continue;
      item.data[finding.field] = [
        ...new Set([...(item.data[finding.field] ?? []), finding.value]),
      ].sort();
      await writeFile(item.path, renderDocument(item));
      add(
        "info",
        "SUGGESTION_APPLIED",
        finding.file,
        `Added ${finding.value} to ${finding.field}.`,
      );
    }
  } finally {
    terminal.close();
  }
}
const count = (severity) => findings.filter((x) => x.severity === severity).length;
const result = {
  summary: {
    errors: count("error"),
    warnings: count("warning"),
    suggestions: count("suggestion"),
    info: count("info"),
    contents: contents.length,
  },
  findings,
};
if (values.json) console.log(JSON.stringify(result, null, 2));
else {
  console.log("Content audit\n");
  for (const severity of ["error", "warning", "suggestion", "info"]) {
    const entries = findings.filter((x) => x.severity === severity);
    if (entries.length) {
      console.log(`${severity.toUpperCase()}S`);
      for (const x of entries) console.log(`  ${x.file}\n    - ${x.message}`);
      console.log();
    }
  }
  console.log(
    `Summary\n  Contents: ${contents.length}\n  Errors: ${result.summary.errors}\n  Warnings: ${result.summary.warnings}\n  Suggestions: ${result.summary.suggestions}`,
  );
}
process.exitCode = result.summary.errors || (values.strict && result.summary.warnings) ? 1 : 0;
