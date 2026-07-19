---
type: project
title: flypea.tech
description: 好きなものと制作の記録が、ひとつの索引でつながる個人サイト。
startedAt: 2026-07-01
status: active
order: 30
featured: true
topics:
  - web
  - ui
  - software
technologies:
  - astro
  - typescript
  - tailwind-css
  - github-actions
  - cloudflare
role: 設計・実装・公開環境の整備
period: 2026年7月〜
liveUrl: https://flypea.tech/
repositoryUrl: https://github.com/kujira-wak/flypea-portfolio
---

## 好きなものが、同じ場所にある

音楽を聴くこと、ゲームで遊ぶこと、道具を触ること、ソフトウェアを作ること。
どれかひとつをプロフィールの中心に決めず、同じ場所に並べたかった。

flypea.techは、興味から制作へ、制作から短いNoteへとつながる個人目録です。
完成品だけでなく、途中の実験や考えた跡も残します。

## 軽いまま、長く続ける

ページの中心は文章と索引。Astroで静的に組み立て、Tailwind CSSで誌面のようなグリッドを作っています。
Projects、Notes、ShelfはMarkdownで管理し、必要な操作だけを小さなJavaScriptで補います。

## Framed Signal

太い文字、細い罫線、大きな余白、ライム色のSignal。
静かな目録の中で、いま見てほしい場所だけが少し強く光るデザインです。

公開前の検証と配信はGitHub Actionsへまとめ、リアクションはCloudflare WorkerとD1へ分離しました。
読むためのページは、外側のサービスが止まっても残ります。
