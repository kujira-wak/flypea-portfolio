# 開発環境のセットアップ

## 必要なもの

- Node.js 24（`.nvmrc` に指定）
- npm 11以上
- Git

GitHubリポジトリをCLIから作成する場合だけ、GitHub CLIも必要です。

## 初回セットアップ

```sh
npm install
```

`.env.example` はAstroのテレメトリー設定用です。通常のローカル開発ではコピー不要です。Workerもローカルで動かす場合は、[Cloudflare Worker / D1 / リダイレクト](cloudflare-reactions.md)の手順に従って `worker/.dev.vars` を作成してください。

## 開発

```sh
astro dev --background
```

ブラウザで `http://127.0.0.1:4321` を開きます。終了・確認には `astro dev stop`、`astro dev status`、`astro dev logs` を使います。

## 品質チェック

```sh
npm run check
npm run lint
npm run build
```

まとめて実行する場合:

```sh
npm run verify
```

## GitHubリポジトリを作成する（任意）

```sh
git init
git add .
git commit -m "chore: initialize astro portfolio"
gh repo create flypea-portfolio --private --source=. --remote=origin --push
```

公開リポジトリにする場合は `--private` を `--public` に変えます。

## 本番公開

Astroは `npm run build` で `dist/` に静的ファイルを生成します。
ロリポップへは `dist/` の中身をSFTPでアップロードします。

自動デプロイは `.github/workflows/deploy.yml` で準備済みです。
詳しい手順は [deployment.md](deployment.md) を確認してください。
