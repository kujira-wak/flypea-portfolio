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
featured: true
tags:
  - Astro
  - TypeScript
role: 設計・実装
period: 2026年7月〜
liveUrl: https://example.com/
repositoryUrl: https://github.com/example/project
draft: false
---

## 概要

この下が制作物詳細ページの本文になります。
```

- `order` が大きいものほど上に表示されます。
- `status` は `公開中`、`整備中`、`計画中` のいずれかです。
- `featured: true` はトップページなどで注目作品として扱うための項目です。
- `role`、`period`、`liveUrl`、`repositoryUrl` は省略できます。
- 同じフォルダに画像を置き、`cover: ./example.webp` と `coverAlt: 画像の説明` を指定するとカバー画像を表示できます。
- `draft: true` にするとサイトには表示されません。
- Markdown本文は `/works/ファイル名/` の詳細ページに表示されます。

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

`/log/` のタグ絞り込み候補は、各記事の `tags` から自動生成されます。
記事詳細の「参考になった」リアクションは、現在は閲覧者それぞれのブラウザ内に保存され、共有件数は集計しません。

## その他の文章を直す

- サイト名、URL、共通説明: `src/config/site.ts`
- プロフィール: `src/data/profile.ts`
- トップページの見出しやSkills: `src/pages/index.astro`

## 本文を書き換える場所

| 書き換えたい内容 | ファイル |
| --- | --- |
| 制作物の詳細本文 | `src/content/works/*.md` |
| Learning Logの本文 | `src/content/learningLog/*.md` |
| Profileの文章、リンク、Skills | `src/data/profile.ts` |
| トップページ固有の見出しや導線 | `src/pages/index.astro` |
| サイト名、URL、共通説明 | `src/config/site.ts` |

制作物とLearning Logは、`---`で囲まれたFrontmatterより下が本文です。
通常のMarkdown記法で見出し、段落、リスト、リンク、コードなどを書けます。

## 公開前の確認

```sh
npm run verify
```

記事slugを変更するとURLも変わります。変更前のURLは`cloudflare/redirects.json`へ追加し、`npm run redirects:build`でリダイレクトCSVを更新してください。詳しくは`docs/cloudflare-reactions.md`を参照してください。

Frontmatterの必須項目や日付・URLの形式が間違っている場合も、ビルド前に検出されます。
