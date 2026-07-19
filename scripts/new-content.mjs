import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
const taxonomy = JSON.parse(await readFile(`${root}src/data/taxonomy.json`, "utf8"));
const { values } = parseArgs({
  options: {
    type: { type: "string", short: "t" },
    slug: { type: "string", short: "s" },
    title: { type: "string" },
    description: { type: "string" },
    topics: { type: "string" },
    technologies: { type: "string" },
    status: { type: "string" },
    kind: { type: "string" },
    role: { type: "string" },
    period: { type: "string" },
    liveUrl: { type: "string" },
    repositoryUrl: { type: "string" },
    order: { type: "string" },
    creator: { type: "string" },
    externalUrl: { type: "string" },
    publish: { type: "boolean", default: false },
    outputDir: { type: "string" },
  },
});

const terminal = createInterface({ input: process.stdin, output: process.stdout });
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const ids = (record) => Object.keys(record);
const today = (() => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
})();

const askRequired = async (label, provided) => {
  if (provided === undefined && !interactive)
    throw new Error(`${label}をオプションで指定してください。`);
  const value = String(provided ?? (await terminal.question(`${label}: `))).trim();
  if (!value) throw new Error(`${label}は必須です。`);
  return value;
};

const askOptional = async (label, provided) => {
  if (provided === undefined && !interactive) return "";
  return String(provided ?? (await terminal.question(`${label}（空欄可）: `))).trim();
};

const validateOptionalUrl = (label, value) => {
  if (!value) return;
  try {
    new URL(value);
  } catch {
    throw new Error(`${label}は有効なURLで入力してください。`);
  }
};

const askChoice = async (label, choices, provided, defaultValue) => {
  if (provided === undefined && !interactive) return defaultValue;
  const answer = String(
    provided ?? (await terminal.question(`${label} [${choices.join(" / ")}] (${defaultValue}): `)),
  ).trim();
  const value = answer || defaultValue;
  if (!choices.includes(value))
    throw new Error(`${label}は ${choices.join(", ")} から選んでください。`);
  return value;
};

const askMany = async (label, choices, provided) => {
  if (provided === undefined && !interactive) return [];
  const answer = String(
    provided ??
      (await terminal.question(`${label}（カンマ区切り／空欄可） [${choices.join(", ")}]: `)),
  ).trim();
  const selected = answer
    ? [
        ...new Set(
          answer
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ]
    : [];
  const invalid = selected.filter((value) => !choices.includes(value));
  if (invalid.length) throw new Error(`${label}に未定義のIDがあります: ${invalid.join(", ")}`);
  return selected;
};

const yamlString = (value) => JSON.stringify(value);
const yamlArray = (key, values) =>
  values.length ? `${key}:\n${values.map((value) => `  - ${value}`).join("\n")}` : `${key}: []`;
const optionalLine = (key, value) => (value ? `${key}: ${yamlString(value)}\n` : "");

try {
  const type = await askChoice("種類", ids(taxonomy.contentTypes), values.type, "note");
  const slug = await askRequired("slug（半角英数字とハイフン）", values.slug);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("slugは半角小文字・数字・ハイフンだけで入力してください。");
  }
  const title = await askRequired("タイトル", values.title);
  const description = await askRequired("短い説明", values.description);
  const topics = await askMany("Topics", ids(taxonomy.topics), values.topics);
  const technologies = await askMany(
    "Technologies",
    ids(taxonomy.technologies),
    values.technologies,
  );
  const defaultStatus = type === "note" ? "completed" : "active";
  const status = await askChoice("Status", ids(taxonomy.statuses), values.status, defaultStatus);
  const common = [
    `type: ${type}`,
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description)}`,
  ];

  if (type === "project") {
    const orderText = String(
      values.order ?? (interactive ? await terminal.question("表示順（整数） (0): ") : ""),
    ).trim();
    const order = Number(orderText || 0);
    if (!Number.isInteger(order)) throw new Error("表示順は整数で入力してください。");
    const role = await askOptional("役割", values.role);
    const period = await askOptional("期間", values.period);
    const liveUrl = await askOptional("公開URL", values.liveUrl);
    const repositoryUrl = await askOptional("Repository URL", values.repositoryUrl);
    validateOptionalUrl("公開URL", liveUrl);
    validateOptionalUrl("Repository URL", repositoryUrl);
    common.push(
      `startedAt: ${today}`,
      `status: ${status}`,
      `order: ${order}`,
      "featured: false",
      yamlArray("topics", topics),
      yamlArray("technologies", technologies),
      optionalLine("role", role).trimEnd(),
      optionalLine("period", period).trimEnd(),
      optionalLine("liveUrl", liveUrl).trimEnd(),
      optionalLine("repositoryUrl", repositoryUrl).trimEnd(),
      `draft: ${values.publish ? "false" : "true"}`,
    );
  } else if (type === "note") {
    common.push(
      `publishedAt: ${today}`,
      `reactionId: ${slug}`,
      `status: ${status}`,
      "featured: false",
      yamlArray("topics", topics),
      yamlArray("technologies", technologies),
      `draft: ${values.publish ? "false" : "true"}`,
    );
  } else {
    const kind = await askChoice("Shelf kind", ids(taxonomy.shelfKinds), values.kind, "software");
    const creator = await askOptional("作者・メーカー", values.creator);
    const externalUrl = await askOptional("外部URL", values.externalUrl);
    validateOptionalUrl("外部URL", externalUrl);
    common.push(
      `kind: ${kind}`,
      `addedAt: ${today}`,
      `status: ${status}`,
      "featured: false",
      yamlArray("topics", topics),
      yamlArray("technologies", technologies),
      optionalLine("creator", creator).trimEnd(),
      optionalLine("externalUrl", externalUrl).trimEnd(),
      `draft: ${values.publish ? "false" : "true"}`,
    );
  }

  const collection = type === "project" ? "projects" : type === "note" ? "notes" : "shelf";
  const outputDir = resolve(values.outputDir ?? `${root}src/content/${collection}`);
  const outputPath = resolve(outputDir, `${slug}.md`);
  if (dirname(outputPath) !== outputDir) throw new Error("出力先を解決できませんでした。");
  try {
    await access(outputPath, constants.F_OK);
    throw new Error(`すでに存在します: ${outputPath}`);
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  const frontmatter = common.filter(Boolean).join("\n");
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    outputPath,
    `---\n${frontmatter}\n---\n\n<!-- ここから本文を書いてください。公開時はdraftをfalseにします。 -->\n`,
    "utf8",
  );
  console.log(`Created draft: ${outputPath}`);
} finally {
  terminal.close();
}
