# flypea.tech

音楽、ゲーム、デバイス、ソフトウェア、制作、OSS、Notesを横断する個人アーカイブです。デザインシステムは「Framed Signal」。

## Stack

- Astro 7 / TypeScript / Tailwind CSS v4
- Astro Content Collections / Markdown
- Cloudflare Worker + D1（Notesリアクション）
- GitHub Actions / Lolipop SFTP deployment

## Commands

```sh
npm install
npm run dev
npm run content:new
npm run verify
```

ローカルURLは `http://127.0.0.1:4321`。Astro CLIを直接起動する場合は `npx astro dev --background` を使用します。

## Documentation

- [フロントエンド構成](docs/frontend-foundation.md)
- [コンテンツ編集](docs/editing-content.md)
- [Cloudflare Worker / D1 / redirects](docs/cloudflare-reactions.md)
- [デプロイ](docs/deployment.md)
- [セットアップ](docs/setup.md)
- [自前配信フォントのライセンス](licenses/fonts/NOTICE.md)

静的ビルドは `dist/` に生成され、GitHub ActionsからロリポップへSFTP配信します。`/api/reactions/*`だけをCloudflare Workerへルーティングします。
