# コンテンツ編集ガイド

このサイトは、管理画面を持つCMSではなく、Astro標準の Content Collections と Markdown を使います。
追加サービスやデータベースが不要なので軽く、変更内容をGitで確認・復元できます。

## 制作物を追加・編集する

`src/content/works/` にある `.md` ファイルを編集します。1制作物につき1ファイルです。

```md
---
title: 制作物の名前
description: 一覧に表示する短い説明
status: 公開中
order: 30
tags:
  - Astro
  - TypeScript
url: https://example.com/
draft: false
---

必要なら、この下に詳しい説明を書けます。
```

- `order` が大きいものほど上に表示されます。
- `url` は省略できます。
- `draft: true` にするとサイトには表示されません。

## 学習ログを書く

`src/content/learningLog/` に `.md` ファイルを作ります。ファイル名がURLになるため、半角英数字とハイフンを推奨します。

```md
---
title: 記事タイトル
description: 一覧と検索結果に表示する概要
publishedAt: 2026-07-11
tags:
  - Astro
draft: false
---

ここから本文です。一般的なMarkdown記法で書けます。
```

保存すると、トップページの「最近の学習ログ」、`/log/` の一覧、`/log/ファイル名/` の記事ページへ自動反映されます。

## その他の文章を直す

- サイト名、URL、共通説明: `src/config/site.ts`
- プロフィール: `src/data/profile.ts`
- トップページの見出しやSkills: `src/pages/index.astro`

## 公開前の確認

```sh
npm run verify
```

Frontmatterの必須項目や日付・URLの形式が間違っている場合も、ビルド前に検出されます。
