# Frontend foundation

このドキュメントは、トップページを本格的な1ページポートフォリオへ育てる前の土台をまとめます。

## 方針

- まずは `flypea.tech` を静的サイトとして公開できる状態に保つ。
- ページ固有の実装と、サイト全体の設定・レイアウトを分ける。
- 学習ログや制作物一覧は、後から増やしやすいデータ構造に寄せる。
- `npm run verify` が通る状態を常に維持してからcommit/pushする。

## 追加した土台

- `src/config/site.ts`: サイト名、説明文、URL、GitHub URLなどの一元管理。
- `src/layouts/BaseLayout.astro`: head要素、SEOメタ情報、OGP、canonical URL、スキップリンク。
- `src/components/Container.astro`: ページ幅と左右余白の共通化。
- `src/components/Section.astro`: セクション見出しと本文領域の共通化。
- `src/content.config.ts`: WorksとLearning Logの型付きcontent collection。
- `src/content/works/`: 制作物を1件1ファイルで管理するディレクトリ。
- `src/content/learningLog/`: Markdownログを置くためのディレクトリ。

## 次に作るトップページ

トップページは以下のセクションで構成します。

- Hero
- About
- Skills
- Works
- Learning Log
- Contact

制作物と学習ログはcontent collectionへ分離済みです。編集方法は[コンテンツ編集ガイド](editing-content.md)を参照してください。
