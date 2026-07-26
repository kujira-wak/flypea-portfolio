# サイト運用CLIガイド

`npm run manage` は、flypea.techを初めて触る人が安全に保守・運営するための入口です。
コマンドを覚えていなくても、対話メニューから目的を選べます。

```sh
npm run manage
```

このCLIは、次の危険な本番操作を自動実行しません。

- 本番サイトへのdeploy
- Workerのdeploy
- D1 migration
- CloudflareやDNSの変更
- Git commit、push、Pull Request作成

本番変更は、ローカル確認と検証が成功した後に、マニュアルとチェックリストに従って行います。

## 最初に使う3つ

### 現在の状態を見る

```sh
npm run manage -- status
```

Node.js、依存関係、Gitの未コミット変更、公開・下書きコンテンツ数を表示します。

### 簡易診断する

```sh
npm run manage -- doctor
```

次を変更せずに確認します。

- 依存関係が導入済みか
- 推奨Node.jsか
- コンテンツ監査にerrorがないか
- Redirect台帳とCSVが同期しているか
- Gitに未確認の変更がないか

`[注意]` は確認が必要ですが、必ずしも作業を止めるerrorではありません。`[要対応]` は修正後に
再実行してください。

### 使い方を見る

```sh
npm run manage -- --help
```

## 日常のコンテンツ更新

### 対話メニュー

```sh
npm run manage -- content
```

現在の公開・下書き件数を確認してから、作成、編集、公開状態変更、一覧、詳細、taxonomy、監査、
削除を選べます。

### 下書きを作る

```sh
npm run manage -- content new
```

質問へ順番に答えると、通常は `draft: true` の下書きが作られます。

### 一覧と詳細

```sh
npm run manage -- content list
npm run manage -- content list note
npm run manage -- content inspect note example-note
```

`inspect` は公開状態、Status、日付、分類、本文文字数、編集ファイルをまとめて表示します。

### 編集する

```sh
npm run manage -- content edit note example-note
```

対話式でタイトル、概要、Status、Topics、Technologiesを確認します。`VISUAL` または `EDITOR` が
設定されていれば本文ファイルも開きます。

### 公開対象へ変更する

```sh
npm run manage -- content publish note example-note
```

slugの再入力後、`draft: false` へ変更します。タイトル、概要、本文が空、または仮文が残っている場合は
拒否します。

これは本番公開ではありません。続けて表示確認と全検証が必要です。

### 下書きへ戻す

```sh
npm run manage -- content draft note example-note
```

`draft: true` へ戻します。次回buildから公開ページに含まれなくなりますが、すでにホスト上へある
古いHTMLは自動削除されないため、公開済みURLの扱いも確認します。

### 監査する

```sh
npm run manage -- content audit
```

必須項目、slug、taxonomy、URL、画像、重複ID、仮文などを確認します。

### 削除する

```sh
npm run manage -- content delete note example-note
```

削除前に対象情報を表示し、slugの再入力を求めます。公開済みURLの場合はredirectとホスト上の
古いファイルも確認します。

## ローカルプレビュー

AGENTS.mdの方針に従い、Astroはバックグラウンドで起動します。

```sh
npm run manage -- preview start
```

通常の確認URL:

```text
http://127.0.0.1:4321
```

4321番が使用中の場合、Astroは別のportで起動します。CLIが最後に表示した実際の「確認URL」を
使用してください。

管理:

```sh
npm run manage -- preview status
npm run manage -- preview logs
npm run manage -- preview stop
```

## 公開前確認

### 全検証だけを行う

```sh
npm run manage -- verify
```

`npm run verify` を実行し、型、Lint、content、redirect、Worker、GARDEN、build、生成ページを
まとめて確認します。

### 公開準備を確認する

```sh
npm run manage -- release
```

全検証を実行し、成功した場合だけ、差分確認、公開チェックリスト、Pull Request、GitHub Actions、
本番URL確認の順番を表示します。本番deployは行いません。

## マニュアルを探す

```sh
npm run manage -- docs
```

日常運用、コンテンツ、公開、基盤変更、Worker/D1、GARDEN、デプロイの文書一覧を表示します。

## 自動処理から使う

状態、コンテンツ概要、詳細、doctorはJSONでも取得できます。

```sh
npm run manage -- status --json
npm run manage -- doctor --json
npm run content -- summary --json
npm run content -- inspect note example-note --json
```

非対話でコンテンツを公開対象へ変更する場合は、意図確認として `--force` が必要です。

```sh
npm run content -- publish note example-note --force
```

## 困ったとき

1. エラー全文を消さずに確認する。
2. `npm run manage -- status` を実行する。
3. `npm run manage -- doctor` を実行する。
4. [保守・運用マニュアルの「検証が失敗したとき」](operations-manual.md#検証が失敗したとき)を確認する。
5. 原因が不明なまま `--force`、delete、deploy、migrationを実行しない。

CLIに不明な操作を指定すると、利用可能なコマンドと次の行動を表示して終了します。
