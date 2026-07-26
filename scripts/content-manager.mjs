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
    help: { type: "boolean", short: "h" },
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
const helpText = `コンテンツ管理CLI

対話メニュー:
  npm run content

よく使う操作:
  npm run content -- summary
  npm run content -- list [project|note|shelf]
  npm run content -- new
  npm run content -- inspect <種類> <slug>
  npm run content -- edit <種類> <slug>
  npm run content -- publish <種類> <slug>
  npm run content -- draft <種類> <slug>
  npm run content -- audit

分類:
  npm run content -- taxonomy list <topic|technology|status|shelf-kind>
  npm run content -- taxonomy add <分類> <ID>
  npm run content -- taxonomy edit <分類> <ID>
  npm run content -- taxonomy rename <分類> <旧ID> <新ID>
  npm run content -- taxonomy delete <分類> <ID> [--replace-with <ID>]

安全上の注意:
  publish は draft: false にするだけで、本番公開は行いません。
  delete と非対話のpublishは確認のため --force が必要です。
  公開前は npm run manage -- release を実行してください。
`;
const ensureType = (type) => {
  if (!collections[type]) throw new Error("種類は project, note, shelf から選んでください。");
};
const ensureSlug = (slug) => {
  if (!ID_RE.test(slug ?? ""))
    throw new Error("slugは半角小文字・数字・ハイフンだけで指定してください。");
};
const loadOne = async (type, slug) => {
  ensureType(type);
  ensureSlug(slug);
  const path = contentPath(type, slug);
  try {
    return {
      type,
      slug,
      path,
      ...parseDocument(await readFile(path, "utf8")),
    };
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`見つかりません: ${displayPath(path)}`);
    throw error;
  }
};
const summary = async () => {
  const items = await loadContent();
  const result = {
    total: items.length,
    published: items.filter(({ data }) => !data.draft).length,
    drafts: items.filter(({ data }) => data.draft).length,
    types: {},
  };
  for (const type of Object.keys(collections)) {
    const selected = items.filter((item) => item.type === type);
    result.types[type] = {
      total: selected.length,
      published: selected.filter(({ data }) => !data.draft).length,
      drafts: selected.filter(({ data }) => data.draft).length,
    };
  }
  if (values.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  console.log(
    `コンテンツ状況: ${result.total}件（公開 ${result.published} / 下書き ${result.drafts}）`,
  );
  for (const [type, counts] of Object.entries(result.types))
    console.log(
      `  ${type.padEnd(7)} ${counts.total}件（公開 ${counts.published} / 下書き ${counts.drafts}）`,
    );
  return result;
};
const list = async (type) => {
  if (type) ensureType(type);
  const items = (await loadContent()).filter((item) => !type || item.type === type);
  if (!items.length) {
    console.log("該当するコンテンツはありません。");
    return;
  }
  console.log("種類     公開状態  slug                         タイトル");
  console.log("-------- -------- ---------------------------- ------------------------------");
  for (const item of items)
    console.log(
      `${item.type.padEnd(8)} ${(item.data.draft ? "下書き" : "公開").padEnd(8)} ${item.slug.padEnd(28)} ${item.data.title}`,
    );
};
const inspect = async (type, slug) => {
  const item = await loadOne(type, slug);
  const date =
    item.data.publishedAt ?? item.data.startedAt ?? item.data.addedAt ?? item.data.updatedAt ?? "-";
  const details = {
    type,
    slug,
    title: item.data.title,
    publication: item.data.draft ? "下書き" : "公開対象",
    status: item.data.status,
    date,
    topics: item.data.topics ?? [],
    technologies: item.data.technologies ?? [],
    file: displayPath(item.path),
    bodyCharacters: item.body.replace(/<!--.*?-->/gs, "").trim().length,
  };
  if (values.json) {
    console.log(JSON.stringify(details, null, 2));
    return;
  }
  console.log(`
コンテンツ詳細
  種類:       ${details.type}
  slug:       ${details.slug}
  タイトル:   ${details.title}
  公開状態:   ${details.publication}
  Status:     ${details.status}
  日付:       ${details.date}
  Topics:     ${details.topics.join(", ") || "-"}
  Technology: ${details.technologies.join(", ") || "-"}
  本文文字数: ${details.bodyCharacters}
  ファイル:   ${details.file}
`);
  console.log(
    item.data.draft
      ? `公開準備後: npm run content -- publish ${type} ${slug}`
      : `非公開へ戻す: npm run content -- draft ${type} ${slug}`,
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
  const item = await loadOne(type, slug);
  const { path } = item;
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
  console.log("\n次の確認:");
  console.log(`  npm run content -- inspect ${type} ${slug}`);
  console.log("  npm run content -- audit");
};
const remove = async (type, slug) => {
  const { path, data } = await loadOne(type, slug);
  console.log(
    `種類: ${type}\nslug: ${slug}\nタイトル: ${data.title}\nファイル: ${displayPath(path)}\ndraft: ${Boolean(data.draft)}`,
  );
  if (!values.force) {
    if (!interactive) throw new Error("非対話で削除するには --force が必要です。");
    if ((await ask("削除するslugを再入力")) !== slug) throw new Error("削除をキャンセルしました。");
  }
  await rm(path);
  console.log(`削除しました: ${displayPath(path)}`);
  console.log("公開済みURLの場合は、redirectとサーバー上の古いファイルも確認してください。");
};
const setPublication = async (type, slug, draft) => {
  const item = await loadOne(type, slug);
  const currentDraft = Boolean(item.data.draft);
  if (currentDraft === draft) {
    console.log(
      `${displayPath(item.path)} はすでに${draft ? "下書き" : "公開対象"}です。変更はありません。`,
    );
    return;
  }

  if (!draft) {
    const body = item.body.replace(/<!--.*?-->/gs, "").trim();
    const missing = [];
    if (!item.data.title?.trim()) missing.push("title");
    if (!item.data.description?.trim()) missing.push("description");
    if (!body) missing.push("本文");
    if (missing.length) throw new Error(`公開できません。未入力の項目: ${missing.join(", ")}`);
    if (/\b(TODO|TBD)\b|あとで書く|仮/u.test(`${item.data.title} ${item.data.description} ${body}`))
      throw new Error("公開できません。仮文、TODO、TBDが残っています。");
    if (!values.force) {
      if (!interactive)
        throw new Error(
          "非対話で公開対象へ変更するには --force が必要です。これは本番deployではありません。",
        );
      console.log(`公開対象へ変更します:
  種類: ${type}
  slug: ${slug}
  タイトル: ${item.data.title}
  ファイル: ${displayPath(item.path)}`);
      if ((await ask("続行するにはslugを再入力")) !== slug)
        throw new Error("公開対象への変更をキャンセルしました。");
    }
  }

  item.data.draft = draft;
  await writeFile(item.path, renderDocument(item), "utf8");
  console.log(
    `${displayPath(item.path)} を${draft ? "下書き（非公開）" : "公開対象"}へ変更しました。`,
  );
  if (!draft) {
    console.log("\nまだ本番公開はされていません。次に実行してください:");
    console.log("  npm run content -- audit");
    console.log("  npm run manage -- preview start");
    console.log("  npm run manage -- release");
  }
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
    console.log(`${kind} "${taxId}" を追加しました。`);
    return;
  }
  if (!entries[id]) throw new Error(`taxonomy IDが見つかりません: ${id}`);
  if (action === "edit") {
    const label = values.label ?? (await ask("label", entries[id].label));
    const description = values.description ?? (await ask("description", entries[id].description));
    if (label) entries[id].label = label;
    if (description) entries[id].description = description;
    await saveTaxonomy(data);
    console.log(`${kind} "${id}" を更新しました。`);
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
    console.log(`${kind} "${id}" を "${newId}" へ改名しました。`);
    return;
  }
  if (action === "delete") {
    if (!values.force) {
      if (!interactive) throw new Error("非対話でtaxonomyを削除するには --force が必要です。");
      if ((await ask("削除するIDを再入力")) !== id)
        throw new Error("taxonomyの削除をキャンセルしました。");
    }
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
    console.log(`${kind} "${id}" を削除しました。`);
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
  if (values.help || command === "help") console.log(helpText);
  else if (!command && interactive) {
    await summary();
    console.log(
      "\n何をしますか？\n\n1. 下書きを新規作成\n2. コンテンツを編集\n3. 公開状態を変更\n4. コンテンツ一覧\n5. コンテンツ詳細\n6. Taxonomyを管理\n7. コンテンツを監査\n8. 削除\n9. ヘルプ\n0. 終了",
    );
    const choice = await ask("番号");
    if (choice === "1") await runNew();
    else if (choice === "2") await edit(await ask("種類"), await ask("slug"));
    else if (choice === "3") {
      const type = await ask("種類 (project / note / shelf)");
      const slug = await ask("slug");
      const state = await ask("publish（公開対象） / draft（下書き）");
      if (state === "publish") await setPublication(type, slug, false);
      else if (state === "draft") await setPublication(type, slug, true);
      else throw new Error("publish または draft を指定してください。");
    } else if (choice === "4") await list();
    else if (choice === "5") await inspect(await ask("種類"), await ask("slug"));
    else if (choice === "6") {
      const action = await ask("操作 (list / add / edit / rename / delete)");
      const kind = await ask("分類 (topic / technology / status / shelf-kind)");
      const id = action === "list" ? undefined : await ask("ID");
      await taxonomy(action, kind, id, action === "rename" ? await ask("新しいID") : undefined);
    } else if (choice === "7") await runAudit();
    else if (choice === "8") await remove(await ask("種類"), await ask("slug"));
    else if (choice === "9") console.log(helpText);
    else if (choice !== "0") console.log("操作にはサブコマンドを指定してください。");
  } else if (!command) console.log(helpText);
  else if (command === "summary") await summary();
  else if (command === "new") await runNew(process.argv.slice(3));
  else if (command === "list") await list(args[0]);
  else if (command === "inspect") await inspect(args[0], args[1]);
  else if (command === "edit") await edit(args[0], args[1]);
  else if (command === "publish") await setPublication(args[0], args[1], false);
  else if (command === "draft") await setPublication(args[0], args[1], true);
  else if (command === "delete") await remove(args[0], args[1]);
  else if (command === "taxonomy") await taxonomy(args[0], args[1], args[2], args[3]);
  else if (command === "audit") await runAudit(process.argv.slice(3));
  else throw new Error(`不明な操作です: ${command}\n\n${helpText}`);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
} finally {
  terminal.close();
}
