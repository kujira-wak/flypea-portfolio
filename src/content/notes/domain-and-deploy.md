---
type: note
title: Cloudflareとロリポップでflypea.techをHTTPS公開
description: flypea.techを、静的配信とCloudflareの小さな境界で公開するまで。
publishedAt: 2026-07-07
reactionId: domain-and-deploy
status: completed
topics:
  - deployment
  - web
technologies:
  - cloudflare
  - github-actions
  - lolipop
---

サイト本体は静的なままロリポップへ置き、ドメインとHTTPS、その外側の小さな機能をCloudflareへ任せています。

## 静的なページを中心にする

GitHub ActionsでビルドしたファイルをSFTPで送り、Cloudflareを経由してflypea.techへ配信します。
ページを読むこととAPIの状態を切り離しておけば、リアクションが使えない時間にも本文は残ります。

## 秘密をリポジトリへ置かない

接続情報はActions Secrets、Cookie署名鍵と管理トークンはWorker Secretsへ。
公開される設定と手元だけに置く値を分けたことで、更新時に確認する場所もはっきりしました。

URLを動かすときは、古い場所から新しい場所への301リダイレクトも同じ変更に含めます。
公開後のリンクを切らさないことも、サイトを続けるための一部です。
