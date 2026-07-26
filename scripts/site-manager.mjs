import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadContent } from "./content-utils.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: "boolean", short: "h" },
    json: { type: "boolean" },
  },
});
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const terminal = createInterface({ input: process.stdin, output: process.stdout });
const localAstro = join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "astro.cmd" : "astro",
);

const helpText = `flypea.tech 運用CLI

サイトを初めて触る人向けの安全な作業入口です。
このCLIから本番公開、D1 migration、Worker deployは自動実行しません。

基本:
  npm run manage                 対話メニュー
  npm run manage -- status       現在の作業状態を確認
  npm run manage -- doctor       環境とコンテンツを簡易診断
  npm run manage -- content      コンテンツ管理メニュー
  npm run manage -- verify       公開前の全検証
  npm run manage -- release      公開前検証と次の手順を表示
  npm run manage -- docs         マニュアルの場所を表示

プレビュー:
  npm run manage -- preview start
  npm run manage -- preview status
  npm run manage -- preview logs
  npm run manage -- preview stop

コンテンツの直接操作:
  npm run manage -- content list
  npm run manage -- content new
  npm run manage -- content inspect note example-note
  npm run manage -- content publish note example-note
  npm run manage -- content draft note example-note
  npm run manage -- content audit

困ったとき:
  1. npm run manage -- status
  2. npm run manage -- doctor
  3. docs/operations-manual.md の「検証が失敗したとき」を確認
`;

const run = (command, args, options = {}) =>
  spawnSync(command, args, {
    cwd: root,
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? "pipe" : "inherit",
    shell: process.platform === "win32",
  });

const runNodeScript = (script, args = [], capture = false) =>
  run(process.execPath, [join(root, "scripts", script), ...args], { capture });

const runNpm = (args, capture = false) =>
  run(process.platform === "win32" ? "npm.cmd" : "npm", args, { capture });

const readableAstroOutput = (output) => {
  const text = output?.trim() ?? "";
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    return parsed.message ?? text;
  } catch {
    return text;
  }
};

const contentSummary = async () => {
  const items = await loadContent();
  const result = {
    total: items.length,
    published: items.filter(({ data }) => !data.draft).length,
    drafts: items.filter(({ data }) => data.draft).length,
    byType: {},
  };
  for (const type of ["project", "note", "shelf"]) {
    const selected = items.filter((item) => item.type === type);
    result.byType[type] = {
      total: selected.length,
      published: selected.filter(({ data }) => !data.draft).length,
      drafts: selected.filter(({ data }) => data.draft).length,
    };
  }
  return result;
};

const gitSummary = () => {
  const result = run("git", ["status", "--porcelain"], { capture: true });
  if (result.status !== 0)
    return { available: false, changes: 0, output: result.stderr?.trim() ?? "" };
  const lines = result.stdout.split("\n").filter(Boolean);
  return {
    available: true,
    changes: lines.length,
    staged: lines.filter((line) => line[0] && line[0] !== " " && line[0] !== "?").length,
    untracked: lines.filter((line) => line.startsWith("??")).length,
  };
};

const dependencyState = async () => {
  try {
    await access(localAstro);
    return true;
  } catch {
    return false;
  }
};

const printContentSummary = (summary) => {
  console.log(
    `コンテンツ: ${summary.total}件（公開 ${summary.published} / 下書き ${summary.drafts}）`,
  );
  for (const [type, counts] of Object.entries(summary.byType)) {
    console.log(
      `  ${type.padEnd(7)} ${String(counts.total).padStart(2)}件（公開 ${counts.published} / 下書き ${counts.drafts}）`,
    );
  }
};

const showStatus = async ({ json = false, silent = false } = {}) => {
  const [summary, dependencies] = await Promise.all([contentSummary(), dependencyState()]);
  const git = gitSummary();
  const expectedNode = (await readFile(join(root, ".nvmrc"), "utf8")).trim();
  const devResult = dependencies
    ? run(localAstro, ["dev", "status"], { capture: true })
    : { status: 1, stdout: "", stderr: "" };
  const devMessage = readableAstroOutput(`${devResult.stdout ?? ""}${devResult.stderr ?? ""}`);
  const status = {
    node: { current: process.versions.node, expectedMajor: expectedNode },
    dependenciesInstalled: dependencies,
    git,
    content: summary,
    devServer: {
      running: /Dev server running at/.test(devMessage),
      message: devMessage || "確認できません。",
    },
  };
  if (json) {
    if (!silent) console.log(JSON.stringify(status, null, 2));
    return status;
  }

  console.log("\nFLYPEA.TECH / CURRENT STATUS\n");
  const currentMajor = process.versions.node.split(".")[0];
  console.log(
    `${currentMajor === expectedNode ? "[OK]" : "[注意]"} Node.js ${process.versions.node}（推奨 major: ${expectedNode}）`,
  );
  console.log(
    `${dependencies ? "[OK]" : "[要対応]"} 依存関係 ${dependencies ? "導入済み" : "未導入"}`,
  );
  if (git.available) {
    console.log(
      `${git.changes ? "[確認]" : "[OK]"} Git: ${git.changes ? `${git.changes}件の未コミット変更` : "変更なし"}${git.staged ? ` / staged ${git.staged}` : ""}${git.untracked ? ` / 未追跡 ${git.untracked}` : ""}`,
    );
  } else {
    console.log("[要対応] Gitの状態を取得できませんでした。");
  }
  console.log(
    `${status.devServer.running ? "[稼働中]" : "[停止]"} プレビュー: ${status.devServer.message}`,
  );
  printContentSummary(summary);
  console.log("\n次の操作:");
  console.log("  内容を更新  npm run manage -- content");
  console.log("  表示を確認  npm run manage -- preview start");
  console.log("  公開前確認  npm run manage -- release");
  return status;
};

const parseAudit = () => {
  const result = runNodeScript("audit-content.mjs", ["--json"], true);
  try {
    return {
      commandStatus: result.status,
      report: JSON.parse(result.stdout),
      error: result.stderr?.trim() || null,
    };
  } catch {
    return {
      commandStatus: result.status,
      report: null,
      error: result.stderr?.trim() || result.stdout?.trim() || "監査結果を解析できません。",
    };
  }
};

const runDoctor = async ({ json = false } = {}) => {
  const status = await showStatus({ json: true, silent: true });
  const audit = parseAudit();
  const redirects = runNodeScript("cloudflare-redirects.mjs", ["--check"], true);
  const checks = [
    {
      id: "dependencies",
      level: status.dependenciesInstalled ? "ok" : "error",
      message: status.dependenciesInstalled
        ? "依存関係は導入済みです。"
        : "依存関係がありません。npm ci を実行してください。",
    },
    {
      id: "node",
      level: process.versions.node.split(".")[0] === status.node.expectedMajor ? "ok" : "warning",
      message: `Node.js ${status.node.current}（推奨 major: ${status.node.expectedMajor}）`,
    },
    {
      id: "content",
      level: !audit.report || audit.report.summary.errors ? "error" : "ok",
      message: audit.report
        ? `コンテンツ監査: error ${audit.report.summary.errors} / warning ${audit.report.summary.warnings} / suggestion ${audit.report.summary.suggestions}`
        : audit.error,
    },
    {
      id: "redirects",
      level: redirects.status === 0 ? "ok" : "error",
      message:
        redirects.status === 0
          ? "Redirect台帳とCSVは同期しています。"
          : redirects.stderr?.trim() || "Redirect確認に失敗しました。",
    },
    {
      id: "git",
      level: status.git.changes ? "warning" : "ok",
      message: status.git.changes
        ? `未コミット変更が${status.git.changes}件あります。内容を確認してください。`
        : "Gitの未コミット変更はありません。",
    },
  ];
  const result = {
    ok: !checks.some(({ level }) => level === "error"),
    checks,
    status,
  };
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("\nFLYPEA.TECH / DOCTOR\n");
    for (const check of checks) {
      const marker =
        check.level === "ok" ? "[OK]" : check.level === "warning" ? "[注意]" : "[要対応]";
      console.log(`${marker} ${check.message}`);
    }
    console.log(
      result.ok
        ? "\n簡易診断は完了しました。公開前は npm run manage -- release を実行してください。"
        : "\n要対応の項目があります。修正後にdoctorを再実行してください。",
    );
  }
  if (!result.ok) process.exitCode = 1;
  return result;
};

const ensureAstro = async () => {
  if (await dependencyState()) return true;
  console.error("Error: Astroが見つかりません。最初に npm ci を実行してください。");
  process.exitCode = 1;
  return false;
};

const preview = async (action = "status") => {
  if (!(await ensureAstro())) return;
  const supported = ["start", "status", "logs", "stop"];
  if (!supported.includes(action))
    throw new Error(`preview は ${supported.join(", ")} から選んでください。`);
  const args =
    action === "start"
      ? ["dev", "--background"]
      : action === "status"
        ? ["dev", "status"]
        : action === "logs"
          ? ["dev", "logs"]
          : ["dev", "stop"];
  console.log(
    action === "start"
      ? "ローカルプレビューをバックグラウンドで起動します。"
      : `ローカルプレビュー: ${action}`,
  );
  const result = run(localAstro, args, { capture: true });
  const output = readableAstroOutput(`${result.stdout ?? ""}${result.stderr ?? ""}`);
  if (output) console.log(output);
  if (result.status) process.exitCode = result.status;
  if (action === "start" && result.status === 0) {
    const url = output.match(/https?:\/\/[^\s)]+/)?.[0] ?? "起動ログのURL";
    console.log(`\n確認URL: ${url}`);
    console.log("終了: npm run manage -- preview stop");
  }
};

const content = (args = []) => {
  const result = runNodeScript("content-manager.mjs", args);
  if (result.status) process.exitCode = result.status;
};

const verify = () => {
  console.log("サイト全体を検証します。数十秒かかることがあります。\n");
  const result = runNpm(["run", "verify"]);
  if (result.status) process.exitCode = result.status;
  else console.log("\n[OK] 全検証が成功しました。");
  return result.status === 0;
};

const release = () => {
  console.log("公開前確認を開始します。本番へのdeployは実行しません。\n");
  const ok = verify();
  if (!ok) {
    console.log("\n公開しないでください。最初に表示されたエラーを修正してください。");
    return;
  }
  console.log("\n公開準備ができました。次の順で進めます:");
  console.log("  1. git status と git diff で変更を確認");
  console.log("  2. docs/release-checklist.md を確認");
  console.log("  3. Pull Requestを作成し、CI成功後にmainへ反映");
  console.log("  4. GitHub ActionsのDeployと本番URLを確認");
  console.log("\nこのCLIは本番公開を自動実行していません。");
};

const showDocs = () => {
  console.log(`マニュアル:
  日常運用        docs/operations-manual.md
  コンテンツ編集  docs/editing-content.md
  公開チェック    docs/release-checklist.md
  基盤変更        docs/platform-change-manual.md
  Worker / D1     docs/cloudflare-reactions.md
  GARDEN          docs/garden-000.md
  デプロイ        docs/deployment.md

最初は docs/operations-manual.md の「やりたいことから探す」を確認してください。`);
};

const ask = (question) => terminal.question(`${question}: `).then((answer) => answer.trim());

const interactiveMenu = async () => {
  let running = true;
  while (running) {
    console.log(`
FLYPEA.TECH / SITE OPERATIONS

  1. 現在の状態を見る
  2. コンテンツを追加・編集する
  3. ローカルプレビューを起動する
  4. プレビューの状態・ログ・停止
  5. 簡易診断をする
  6. 公開前の全検証をする
  7. マニュアルの場所を見る
  0. 終了
`);
    const choice = await ask("番号を選んでください");
    if (choice === "1") await showStatus();
    else if (choice === "2") content([]);
    else if (choice === "3") await preview("start");
    else if (choice === "4") {
      const action = await ask("status / logs / stop");
      await preview(action);
    } else if (choice === "5") await runDoctor();
    else if (choice === "6") release();
    else if (choice === "7") showDocs();
    else if (choice === "0") running = false;
    else console.log("0〜7の番号を入力してください。");
    if (running) await ask("Enterでメニューへ戻ります");
  }
};

try {
  const [command, ...args] = positionals;
  if (values.help || command === "help") console.log(helpText);
  else if (!command && interactive) await interactiveMenu();
  else if (!command) console.log(helpText);
  else if (command === "status") await showStatus({ json: values.json });
  else if (command === "doctor") await runDoctor({ json: values.json });
  else if (command === "content") content(args);
  else if (command === "preview") await preview(args[0]);
  else if (command === "verify") verify();
  else if (command === "release") release();
  else if (command === "docs") showDocs();
  else throw new Error(`不明な操作です: ${command}\n\n${helpText}`);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
} finally {
  terminal.close();
}
