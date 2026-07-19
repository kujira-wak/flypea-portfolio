# コンテンツ編集ガイド

このサイトはAstro Content CollectionsとMarkdownを使用します。Frontmatterは `src/content.config.ts` で型検証されます。

## 新規ファイルを自動作成する

Project、Note、Shelfの新規作成は対話式スクリプトを使えます。タイトルなどを順番に入力すると、現在のschemaとtaxonomyに沿ったFrontmatterを持つMarkdownが作られます。

Mac:

```sh
./scripts/new-content.sh
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\new-content.ps1
```

OS共通のnpmコマンドも利用できます。

```sh
npm run content:new
```

生成直後は必ず `draft: true` です。本文を書き、公開準備ができてから `draft: false` に変更してください。既存slugへの上書きは拒否されます。

引数でまとめて指定することもできます。

```sh
npm run content:new -- --type note --slug example-note --title "記事タイトル" --description "短い説明" --topics ui,web --technologies astro,typescript
```

Projectでは役割、期間、公開URL、Repository URL、Shelfでは作者・メーカー、外部URLも続けて入力できます。URLは生成時に形式を検証します。

## 共通taxonomy

`topics`、`technologies`、`status`、Shelfの`kind`は [`src/data/taxonomy.json`](../src/data/taxonomy.json) だけで管理します。新しい分類は対象オブジェクトへID、表示名、説明を1件追加します。

- HomeのTopic Directoryは、公開コンテンツで使われているTopicだけを自動表示します。
- Technology Indexは、公開中のProjects、Notes、Shelfから件数を集計し、使われているTechnologyだけを自動表示します。
- Shelfは `src/content/shelf/` の公開項目を自動表示し、追加・削除に追従します。
- TopicやTechnologyを削除するときは、先にMarkdownからそのIDの参照を外します。参照が残っていればビルドがエラーになり、消し忘れを検出できます。

## Project

`src/content/projects/{slug}.md` を作成します。

```md
---
type: project
title: Project title
description: 一覧に表示する短い説明
startedAt: 2026-07-20
status: active
order: 30
featured: false
topics: [software, web]
technologies: [astro, typescript]
role: 設計・実装
period: 2026年7月〜
liveUrl: https://example.com/
repositoryUrl: https://github.com/example/project
draft: false
---

ここから詳細本文です。
```

`order` が大きいほど上に表示されます。画像を指定するときは `cover` と内容を説明する `coverAlt` を必ず一緒に指定します。

## Note

`src/content/notes/{slug}.md` を作成します。

```md
---
type: note
title: Note title
description: 一覧とメタ情報に使う概要
publishedAt: 2026-07-20
reactionId: permanent-note-id
status: completed
topics: [ui]
technologies: [tailwind-css]
draft: false
---

ここから本文です。
```

`reactionId` はD1の票数と結びつく不変IDです。URL slugを変更しても変更せず、他のNoteと重複させないでください。Note URLを変更する場合は旧URLをリダイレクト台帳へ追加します。

## Shelf

実際の項目だけを `src/content/shelf/{slug}.md` に追加します。現在の空状態を埋めるために架空の内容を作らないでください。

```md
---
type: shelf
title: Shelf item
description: 好きな理由や用途
kind: music
addedAt: 2026-07-20
status: active
topics: [music]
technologies: []
creator: Creator name
externalUrl: https://example.com/
draft: false
---
```

`kind` の選択肢も `taxonomy.json` の `shelfKinds` から読み込むため、分類を追加・削除した場合は生成スクリプトへ自動反映されます。

## その他

- Current Signal: `src/data/signals.ts`
- AboutのInterest DirectoryとExternal Links: `src/data/about.json`
- サイト名、URL、共通説明: `src/config/site.ts`

Aboutの項目追加・削除は `about.json` の `interests` または `links` の行を編集するだけです。External LinkのURL形式はビルド時に確認されます。

個人情報（居住地、年齢、学校、学年、住所、生年月日）は追加しません。

## 公開前

```sh
npm run verify
```

URL変更時はAstro redirectと `cloudflare/redirects.json` を同じ変更で更新し、`npm run redirects:build` を実行します。
