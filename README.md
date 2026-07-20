# flypea.tech

音楽、ゲーム、デバイス、ソフトウェア、制作、OSS、Notesを横断する個人アーカイブです。デザインシステムは「Framed Signal」です。

## Stack

- Astro 7 / TypeScript / Tailwind CSS v4
- Astro Content Collections / Markdown
- Cloudflare Worker + D1（Notesリアクション）
- GitHub Actions / Lolipop SFTP deployment

## はじめに

```sh
npm install
npm run verify
astro dev --background
```

ローカルURLは `http://127.0.0.1:4321` です。開発サーバーはバックグラウンドで起動し、状態確認・停止には次を使います。

```sh
astro dev status
astro dev logs
astro dev stop
```

コンテンツを追加する場合は `npm run content:new`、一括管理する場合は `npm run content` を使います。詳細は[コンテンツ編集ガイド](docs/editing-content.md)を参照してください。

## Documentation

- [開発環境のセットアップ](docs/setup.md) — 必要な環境、品質チェック、GitHubリポジトリの作成
- [フロントエンド構成](docs/frontend-foundation.md) — 公開ルート、データの責務、設計方針
- [コンテンツ編集](docs/editing-content.md) — Markdown、taxonomy、公開前の確認
- [Cloudflare Worker / D1 / リダイレクト](docs/cloudflare-reactions.md) — リアクションAPIとURL移行の運用
- [ロリポップへのデプロイ](docs/deployment.md) — GitHub ActionsとSFTPの設定
- [自前配信フォントのライセンス](licenses/fonts/NOTICE.md)

静的ビルドは `dist/` に生成され、GitHub ActionsからロリポップへSFTP配信します。`/api/reactions/*`だけをCloudflare Workerへルーティングします。
