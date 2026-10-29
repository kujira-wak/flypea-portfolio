# 公開チェックリスト

このファイルは、flypea.techを公開するときの確認票です。Pull Requestまたは非公開の作業記録へ
コピーして使います。詳しい判断基準は[保守・運用マニュアル](operations-manual.md)を参照してください。

## 公開情報

- 公開予定日時:
- 担当者:
- Pull Request / commit:
- 変更概要:
- 影響範囲: 静的サイト / Worker / D1 / Durable Objects / Redirects / Secrets
- 戻す対象と手順:

## 公開前

- [ ] `git status` で意図しない変更がない
- [ ] パスワード、token、秘密鍵、復旧コード、本番バックアップが差分にない
- [ ] `draft: false` にする内容を読み直した
- [ ] タイトル、概要、日付、Topic、Technology、Statusが正しい
- [ ] 個人情報や公開してはいけない情報がない
- [ ] URL変更には旧URLからのリダイレクトがある
- [ ] 画像の権利、形式、代替テキストを確認した
- [ ] 狭い画面とデスクトップで表示を確認した
- [ ] キーボード操作とリンク先を確認した
- [ ] `npm run verify` が成功した
- [ ] Pull Requestの `CI / verify` が成功した
- [ ] マニュアルへの影響を確認し、必要な文書を更新した

## 静的サイトを公開する場合

- [ ] `main` へ反映した
- [ ] `Actions > Deploy to Lolipop` が開始された
- [ ] `Verify and build` が成功した
- [ ] `Upload dist to Lolipop` が成功した
- [ ] 削除・slug変更がある場合、古いサーバーファイルの扱いを決めた

## Workerを公開する場合

- [ ] `npm run worker:check` が成功した
- [ ] `npm run worker:test` が成功した
- [ ] 現在の安定したWorker deploymentを記録した
- [ ] binding、route、secretへの影響を確認した
- [ ] `npx wrangler deploy --config worker/wrangler.jsonc` が成功した
- [ ] 変更したWorker Routeの応答を確認した（`/terminal/`はUser-AgentとJST時刻を表示）
- [ ] Worker rollbackだけではD1/DOが戻らないことを確認した

## D1 migrationを行う場合

- [ ] migration SQLをレビューした
- [ ] 旧Workerと新schemaの互換性を確認した
- [ ] 本番D1をリポジトリ外へexportし、暗号化された場所へ保管した
- [ ] migration → Worker → API確認 → 静的サイトの順序を確認した
- [ ] `npm run worker:migrate:remote` の対象databaseとconfigを再確認した
- [ ] migration結果を記録した

## Redirectsを公開する場合

- [ ] `cloudflare/redirects.json` を更新した
- [ ] `npm run redirects:build` を実行した
- [ ] 生成された `cloudflare/redirects.csv` の旧URLと新URLを確認した
- [ ] Cloudflare Bulk Redirectsへ反映した
- [ ] 対象のBulk Redirect Ruleが有効である

## 基盤を変更する場合

- [ ] [基盤変更計画](platform-change-plan-template.md)を作成した
- [ ] 変更しない境界を明示した
- [ ] 現在のDNS、deployment、binding、Data件数を記録した
- [ ] 新環境を旧環境と並行して確認した
- [ ] 成功条件、中止条件、判断者、判断期限を決めた
- [ ] Data、Cookie、Origin、Redirectへの影響を確認した
- [ ] 旧環境を観測期間中維持できる
- [ ] ロールバックを実行できることを確認した
- [ ] 変更日の公式仕様を再確認した

## 公開後

- [ ] `https://flypea.tech/` が200で表示される
- [ ] 変更したURLが200で表示される
- [ ] Index、Projects、Notes、Shelf、Aboutの主要導線が動く
- [ ] title、description、canonical、OGPが意図どおり
- [ ] CSSと画像が読み込まれている
- [ ] URL変更時、旧URLが301で新URLへ進む
- [ ] リアクション変更時、件数の読み取りと投票・取消が動く
- [ ] GARDEN変更時、session、操作、ランキング、管理画面を確認した
- [ ] ブラウザconsoleに新しいエラーがない
- [ ] Cloudflare Workersに新しい継続的エラーがない
- [ ] 公開完了時刻と確認結果を記録した

## 問題があった場合

- [ ] 追加公開を止めた
- [ ] 発生時刻、URL、HTTP status、画面、Actions run、Worker deploymentを記録した
- [ ] 静的サイト、Worker、D1のどこが原因か切り分けた
- [ ] [障害時の初動](operations-manual.md#障害時の初動)に従った
- [ ] 復旧後に原因と再発防止を記録した
