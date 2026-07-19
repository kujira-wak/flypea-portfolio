---
type: note
title: Astro + Tailwind CSS v4で静的ポートフォリオの土台を作成
description: 書く、確認する、公開する。その流れを止めないための最初の土台。
publishedAt: 2026-07-07
reactionId: astro-portfolio-foundation
status: completed
topics:
  - web
  - ui
  - learning
technologies:
  - astro
  - tailwind-css
---

最初に決めたのは、ページを増やすたびに仕組みを考え直さなくていいこと。
文章はMarkdownに置き、一覧や詳細ページはAstroで静的に組み立てる形にしました。

## 書く場所を決める

制作物と短い記録をContent Collectionsへ分け、Frontmatterの項目を型で確認します。
タイトルや日付だけでなく、公開状態や関連する技術も同じ場所に残るので、あとから索引を作り直しやすくなりました。

## 公開までを短くする

見た目はTailwind CSS、コードの確認はAstro CheckとBiome、配信はGitHub ActionsからSFTP。
変更から公開までの手順が短いほど、内容そのものへ戻りやすいと感じています。
