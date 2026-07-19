---
title: flypea.tech
description: ポートフォリオ兼Web開発学習ログ。静的サイトとして速く安全に公開し、ここから制作物を増やしていきます。
status: 公開中
order: 30
featured: true
tags:
  - Astro
  - Tailwind CSS
  - GitHub Actions
  - Cloudflare
role: 設計・実装・公開環境の整備
period: 2026年7月〜
liveUrl: https://flypea.tech/
repositoryUrl: https://github.com/kujira-wak/flypea-portfolio
---

## 概要

flypea.techは、Web制作の成果と学習の過程を同じ場所に蓄積するポートフォリオです。
完成した制作物だけでなく、設計・実装・公開で判断したこともLearning Logとして残し、
制作を重ねるほど内容が育つ構成を目指しました。

## 背景と目的

制作物を並べるだけでは、どこで迷い、何を選び、どう公開まで進めたのかが伝わりません。
そこで、次の3点を満たす自分用の発信基盤を作りました。

- 制作物と学習記録を一つのサイトで管理できる
- 小さく公開し、動く状態を保ちながら改善できる
- 特別な管理画面なしで、GitとMarkdownを使って更新できる

## 技術選定

ページの中心は文章と制作物の紹介なので、Astroの静的サイト生成を採用しました。
必要なHTMLをビルド時に生成し、閲覧時のJavaScriptを必要最小限に抑えられることが理由です。

スタイルにはTailwind CSS v4、品質確認にはTypeScript、Astro Check、Biomeを使用しています。
制作物とLearning LogはAstro Content Collectionsで管理し、Frontmatterをスキーマ検証することで、
日付やURL、公開状態の入力ミスをビルド時に見つけられるようにしました。

## コンテンツを更新しやすくする工夫

制作物は`src/content/works/`、学習ログは`src/content/learningLog/`にMarkdownとして保存します。
一覧やトップページを直接書き換えなくても、Markdownを追加すれば自動的に反映されます。

また、`draft`、`order`、`featured`などの項目をFrontmatterに持たせ、
公開前の記事を隠したり、注目してほしい制作物の順番を調整したりできるようにしています。

## 公開の仕組み

`main`ブランチへの更新をきっかけにGitHub Actionsで型チェック、Lint、本番ビルドを実行します。
検証を通過した`dist/`の静的ファイルをロリポップへSFTPで送り、
独自ドメインのHTTPS化とリダイレクトはCloudflareで管理しています。

ローカルとCIの確認手順は`npm run verify`にまとめ、公開前に同じ検証を再現できるようにしました。

## 現在できていること

- レスポンシブなトップ、Works、Learning Log、Profileページ
- Markdownから生成する制作物・学習ログの一覧と詳細ページ
- canonical URLやOG情報などの基本的なメタデータ
- GitHub Actionsからロリポップへの自動デプロイ
- 型チェック、Lint、ビルドをまとめた品質確認

## 今後の改善

制作物ごとのスクリーンショットや、実装前後の比較を増やす予定です。
Learning Logが増えた段階では、タグごとの回遊、関連記事、RSSなども追加し、
制作と学習のつながりをさらに辿りやすくしていきます。
