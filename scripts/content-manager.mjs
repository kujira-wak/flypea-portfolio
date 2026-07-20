import { spawn, spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import {
  collections,
  contentPath,
  displayPath,
  ID_RE,
  loadContent,
  loadTaxonomy,
  parseDocument,
  renderDocument,
  saveTaxonomy,
  taxonomyKinds,
  taxonomyPath,
  writeTransaction,
} from "./content-utils.mjs";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    force: { type: "boolean" },
    "replace-with": { type: "string" },
    type: { type: "string" },
    slug: { type: "string" },
    strict: { type: "boolean" },
    fix: { type: "boolean" },
    interactive: { type: "boolean" },
    json: { type: "boolean" },
    title: { type: "string" },
    description: { type: "string" },
    label: { type: "string" },
    topics: { type: "string" },
    technologies: { type: "string" },
    status: { type: "string" },
    kind: { type: "string" },
    publish: { type: "boolean" },
    role: { type: "string" },
    period: { type: "string" },
    liveUrl: { type: "string" },
    repositoryUrl: { type: "string" },
    order: { type: "string" },
    creator: { type: "string" },
    externalUrl: { type: "string" },
    outputDir: { type: "string" },
  },
});
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const terminal = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (label, current = "") =>
  interactive
    ? (
        await terminal.question(
          `${label}${current !== "" ? ` (${Array.isArray(current) ? current.join(", ") : current})` : ""}: `,
        )
      ).trim()
    : "";
const ensureType = (type) => {
  if (!collections[type]) throw new Error("種類は project, note, shelf から選んでください。");
};
const list = async (type) => {
  if (type) ensureType(type);
  for (const item of await loadContent())
    if (!type || item.type === type)
      console.log(
        `${item.type.padEnd(7)} ${item.slug.padEnd(28)} ${item.data.title}${item.data.draft ? " [draft]" : ""}`,
      );
};
const runNew = (args = []) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [new URL("./new-content.mjs", import.meta.url).pathname, ...args],
      { stdio: "inherit" },
    );
    child.on("exit", (code) =>
      code ? reject(new Error(`作成に失敗しました (${code})`)) : resolve(),
    );
  });
const edit = async (type, slug) => {
  if (!interactive)
    throw new Error("編集は対話式で実行してください。本文は $VISUAL または $EDITOR で開きます。");
  ensureType(type);
  const path = contentPath(type, slug);
  let item;
  try {
    item = {
      path,
      ...parseDocument(await readFile(path, "utf8")),
    };
  } catch {
    throw new Error(`見つかりません: ${displayPath(path)}`);
  }
  const d = item.data;
  console.log(`編集: ${displayPath(path)}`);
  for (const key of ["title", "description", "status", "topics", "technologies"]) {
    const answer = await ask(
      {
        title: "タイトル",
        description: "短い説明",
        status: "Status",
        topics: "Topics",
        technologies: "Technologies",
      }[key],
      d[key] ?? "",
    );
    if (!answer) continue;
    if (["topics", "technologies"].includes(key)) {
      const ids = answer
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const taxonomy = await loadTaxonomy();
      const unknown = ids.filter((id) => !taxonomy[key][id]);
      if (unknown.length) throw new Error(`未定義のIDがあります: ${unknown.join(", ")}`);
      d[key] = [...new Set(ids)];
    } else if (key === "status") {
      const currentTaxonomy = await loadTaxonomy();
      if (!currentTaxonomy.statuses[answer]) throw new Error(`未定義のStatusです: ${answer}`);
      d[key] = answer;
    } else d[key] = answer;
  }
  if (type === "note")
    console.log("WARNING: reactionId は永続IDのため、この操作では変更しません。");
  await writeFile(path, renderDocument(item), "utf8");
  const editor = process.env.VISUAL || process.env.EDITOR;
  if (editor) {
    const result = spawnSync(editor, [path], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (result.error) console.log(`本文はエディタで編集できます: ${path}`);
  } else console.log(`本文はエディタで編集できます: ${path}`);
};
const remove = async (type, slug) => {
  ensureType(type);
  const path = contentPath(type, slug);
  const { data } = parseDocument(await readFile(path, "utf8"));
  console.log(
    `種類: ${type}\nslug: ${slug}\nタイトル: ${data.title}\nファイル: ${displayPath(path)}\ndraft: ${Boolean(data.draft)}`,
  );
  if (!values.force) {
    if (!interactive) throw new Error("非対話で削除するには --force が必要です。");
    if ((await ask("削除するslugを再入力")) !== slug) throw new Error("削除をキャンセルしました。");
  }
  await rm(path);
  console.log(`Deleted: ${displayPath(path)}`);
};
const taxonomy = async (action, kind, id, newId) => {
  const group = taxonomyKinds[kind];
  if (!group)
    throw new Error("taxonomy は topic, technology, status, shelf-kind を指定してください。");
  const data = await loadTaxonomy();
  const entries = data[group];
  if (action === "list") {
    for (const [key, entry] of Object.entries(entries))
      console.log(`${key}\t${entry.label}\t${entry.description}`);
    return;
  }
  if (action === "add") {
    const taxId = id || (await ask("ID"));
    if (!ID_RE.test(taxId) || entries[taxId])
      throw new Error("ID形式が不正、または既に存在します。");
    const label = values.label ?? (await ask("label"));
    const description = values.description ?? (await ask("description"));
    if (!label || !description) throw new Error("label と description は必須です。");
    entries[taxId] = { label, description };
    await saveTaxonomy(data);
    return;
  }
  if (!entries[id]) throw new Error(`taxonomy IDが見つかりません: ${id}`);
  if (action === "edit") {
    const label = values.label ?? (await ask("label", entries[id].label));
    const description = values.description ?? (await ask("description", entries[id].description));
    if (label) entries[id].label = label;
    if (description) entries[id].description = description;
    await saveTaxonomy(data);
    return;
  }
  const field =
    group === "topics"
      ? "topics"
      : group === "technologies"
        ? "technologies"
        : group === "statuses"
          ? "status"
          : "kind";
  const all = await loadContent();
  const affected = all.filter((x) =>
    Array.isArray(x.data[field]) ? x.data[field].includes(id) : x.data[field] === id,
  );
  if (action === "rename") {
    if (!ID_RE.test(newId) || entries[newId])
      throw new Error("新しいID形式が不正、または既に存在します。");
    console.log(`${id} → ${newId}\n\n参照を更新するファイル:`);
    for (const item of affected) console.log(`- ${displayPath(item.path)}`);
    const prepared = affected.map((item) => {
      const dataCopy = structuredClone(item.data);
      dataCopy[field] = Array.isArray(dataCopy[field])
        ? dataCopy[field].map((x) => (x === id ? newId : x))
        : newId;
      return { ...item, data: dataCopy };
    });
    const entry = structuredClone(entries[id]);
    delete entries[id];
    entries[newId] = entry;
    await writeTransaction([
      ...prepared.map((item) => ({ path: item.path, content: renderDocument(item) })),
      { path: taxonomyPath, content: `${JSON.stringify(data, null, 2)}\n` },
    ]);
    return;
  }
  if (action === "delete") {
    const replacement = values["replace-with"];
    if (affected.length && (!replacement || !entries[replacement]))
      throw new Error(
        `${kind} "${id}" は${affected.length}件で使用中です。--replace-with <ID> を指定してください。`,
      );
    for (const item of affected) {
      item.data[field] = Array.isArray(item.data[field])
        ? item.data[field].map((x) => (x === id ? replacement : x))
        : replacement;
    }
    delete entries[id];
    await writeTransaction([
      ...affected.map((item) => ({ path: item.path, content: renderDocument(item) })),
      { path: taxonomyPath, content: `${JSON.stringify(data, null, 2)}\n` },
    ]);
    return;
  }
  throw new Error("taxonomy action: list, add, edit, rename, delete");
};
const runAudit = (args = []) =>
  new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [new URL("./audit-content.mjs", import.meta.url).pathname, ...args],
      { stdio: "inherit" },
    );
    child.on("exit", (code) => {
      process.exitCode = code;
      resolve();
    });
  });
try {
  const [command, ...args] = positionals;
  if (!command && interactive) {
    console.log(
      "何をしますか？\n\n1. コンテンツを新規作成\n2. コンテンツを編集\n3. コンテンツを削除\n4. コンテンツ一覧\n5. Taxonomyを管理\n6. コンテンツを監査\n0. 終了",
    );
    const choice = await ask("番号");
    if (choice === "1") await runNew();
    else if (choice === "2") await edit(await ask("種類"), await ask("slug"));
    else if (choice === "3") await remove(await ask("種類"), await ask("slug"));
    else if (choice === "4") await list();
    else if (choice === "5") {
      const action = await ask("操作 (list / add / edit / rename / delete)");
      const kind = await ask("分類 (topic / technology / status / shelf-kind)");
      const id = action === "list" ? undefined : await ask("ID");
      await taxonomy(action, kind, id, action === "rename" ? await ask("新しいID") : undefined);
    } else if (choice === "6") await runAudit();
    else if (choice !== "0") console.log("操作にはサブコマンドを指定してください。");
  } else if (command === "new") await runNew(process.argv.slice(3));
  else if (command === "list") await list(args[0]);
  else if (command === "edit") await edit(args[0], args[1]);
  else if (command === "delete") await remove(args[0], args[1]);
  else if (command === "taxonomy") await taxonomy(args[0], args[1], args[2], args[3]);
  else if (command === "audit") await runAudit(process.argv.slice(3));
  else throw new Error("Usage: content new|list|edit|delete|taxonomy|audit");
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
} finally {
  terminal.close();
}
