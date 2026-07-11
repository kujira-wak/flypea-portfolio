# Frontend foundation

このドキュメントは、flypea.techのページ構成と、コンテンツを増やすための土台をまとめます。

## 方針

- `flypea.tech` を静的サイトとして公開できる状態に保つ。
- ページ固有の実装と、サイト全体の設定・レイアウトを分ける。
- 制作物と学習ログはMarkdownとGitで更新し、外部CMSは必要になってから検討する。
- `npm run verify` が通る状態を維持してからcommit/pushする。

## 現在のページ構成

- `/`: サイトの目的と主要ページへの入口。
- `/works/`: Markdownで管理する制作物一覧。
- `/log/`: Markdownで管理する学習ログ一覧。
- `/log/{記事名}/`: 学習ログ本文。
- `/profile/`: 自己紹介、使用技術、SNS・関連リンク。

全ページで共通ヘッダーとフッターを使い、ヘッダーにはWorks、Log、Profileだけを置きます。連絡先は内容が重複するため、Profileのリンクへ集約しています。

## コンテンツの編集場所

- 制作物: `src/content/works/*.md`
- 学習ログ: `src/content/learningLog/*.md`
- プロフィール: `src/data/profile.ts`

Markdownの書き方と公開前の確認は[コンテンツ編集ガイド](editing-content.md)を参照してください。
