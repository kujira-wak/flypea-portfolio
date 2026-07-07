# flypea.tech development setup

## 必要なもの

- Node.js 24 LTS推奨
- npm 11以上
- Git
- GitHub CLI

この環境では以下を確認済みです。

- Git: `2.53.0`
- Node.js: `v26.3.0`
- npm: `11.16.0`
- GitHub CLI: `2.81.0`

## 初回セットアップ

```sh
npm install
cp .env.example .env
```

## 開発

```sh
npm run dev
```

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

## GitHubへ置く流れ

```sh
git init
git add .
git commit -m "chore: initialize astro portfolio"
gh repo create flypea-portfolio --private --source=. --remote=origin --push
```

公開リポジトリにする場合は `--private` を `--public` に変えます。

## ロリポップ公開の考え方

Astroは `npm run build` で `dist/` に静的ファイルを生成します。
ロリポップへは `dist/` の中身だけをSFTP/FTPでアップロードします。

自動デプロイは、ロリポップのSFTP情報をGitHub Actions Secretsに登録してから追加します。
