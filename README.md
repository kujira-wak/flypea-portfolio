# flypea.tech

音楽、ゲーム、デバイス、ソフトウェア、制作、OSS、Notesを横断する個人アーカイブです。デザインシステムは「Framed Signal」です。

## Stack

- Astro 7 / TypeScript / Tailwind CSS v4
- Astro Content Collections / Markdown
- Cloudflare Worker + D1 + Durable Objects（Notesリアクション / GARDEN 000）
- GitHub Actions / Lolipop SFTP deployment

## はじめに

```sh
npm ci
npm run verify
npm run manage
```

`npm run manage` は、状態確認、コンテンツ更新、プレビュー、検証、マニュアル案内をまとめた初心者向け運用CLIです。直接操作する場合は次を使います。

```sh
npm run manage -- status
npm run manage -- content
npm run manage -- preview start
npm run manage -- release
```

通常のローカルURLは `http://127.0.0.1:4321` です。使用中の場合はCLIが実際のURLを表示します。詳細は[サイト運用CLIガイド](docs/cli-guide.md)を参照してください。

## Documentation

- [保守・運用マニュアル](docs/operations-manual.md) — 初めて触る人向けの更新、公開、定期保守、障害対応、引き継ぎ
- [サイト運用CLIガイド](docs/cli-guide.md) — 状態確認、コンテンツ管理、プレビュー、公開前確認
- [基盤変更・サービス移行マニュアル](docs/platform-change-manual.md) — ホスティング、ドメイン、Cloudflare、D1、CI/CDの変更手順
- [基盤変更計画テンプレート](docs/platform-change-plan-template.md) — 切替条件、Data移行、rollbackを事前に定義する雛形
- [公開チェックリスト](docs/release-checklist.md) — 公開前後の確認票
- [引き継ぎ台帳テンプレート](docs/operations-record-template.md) — 権限、契約、復旧手段を非公開で管理するための雛形
- [開発環境のセットアップ](docs/setup.md) — 必要な環境、品質チェック、GitHubリポジトリの作成
- [フロントエンド構成](docs/frontend-foundation.md) — 公開ルート、データの責務、設計方針
- [コンテンツ編集](docs/editing-content.md) — Markdown、taxonomy、公開前の確認
- [Cloudflare Worker / D1 / リダイレクト](docs/cloudflare-reactions.md) — リアクションAPIとURL移行の運用
- [GARDEN / 000 運用ガイド](docs/garden-000.md) — サーバー正本のゲーム、復旧、標本カード、公開順
- [ロリポップへのデプロイ](docs/deployment.md) — GitHub ActionsとSFTPの設定
- [自前配信フォントのライセンス](licenses/fonts/NOTICE.md)

静的ビルドは `dist/` に生成され、GitHub ActionsからロリポップへSFTP配信します。`/api/reactions/*`と`/api/garden/*`をCloudflare Workerへルーティングします。
