# 引き継ぎ台帳テンプレート

このテンプレートは、サイト運営に必要な権限、契約、復旧手段を引き継ぐためのものです。
**記入済みの台帳を公開リポジトリへ保存しないでください。** 非公開のパスワードマネージャー、
暗号化された社内文書、または同等のアクセス制御された場所へコピーして使います。

パスワード、token、秘密鍵、2要素認証の復旧コードは、この台帳へ値を直接貼らず、
パスワードマネージャー内の項目名だけを記録します。

## 文書情報

- 台帳の保管場所:
- 最終確認日:
- 主担当:
- 予備担当:
- 次回確認日:
- 緊急時の連絡順:

## GitHub

- Repository: `https://github.com/kujira-wak/flypea-portfolio`
- Organization / owner:
- 主担当の権限:
- 予備担当の権限:
- 2要素認証の確認日:
- 復旧手段の保管項目名:
- Branch protection:
- `LOLIPOP_DEPLOY_ENABLED` の現在値:
- Actions Secretsの最終確認日:
  - `LOLIPOP_SFTP_HOST`
  - `LOLIPOP_SFTP_USER`
  - `LOLIPOP_SFTP_PASSWORD`
  - `LOLIPOP_SFTP_PORT`
  - `LOLIPOP_SFTP_KNOWN_HOSTS`
  - `LOLIPOP_DEPLOY_PATH`

## Cloudflare

- Account名:
- Zone: `flypea.tech`
- Worker: `flypea-reactions`
- D1 database: `flypea-portfolio`
- Durable Object: `GardenCoordinator`
- 主担当の権限:
- 予備担当の権限:
- 2要素認証の確認日:
- 復旧手段の保管項目名:
- Worker Secretsの保管項目名:
  - `ADMIN_TOKEN`
  - `COOKIE_SECRET`
- Bulk Redirect List名:
- Bulk Redirect Rule名:
- D1バックアップの保管場所:
- バックアップ最終確認日:
- Worker rollback確認日:

## ロリポップ

- 契約アカウント:
- 契約プラン:
- 契約更新日:
- 自動更新:
- 支払い失敗時の連絡先:
- 公開先ディレクトリ:
- SFTP情報の保管項目名:
- 既知のhost key確認日:
- 容量確認日:
- サポート窓口:

## ドメイン

- Domain: `flypea.tech`
- Registrar:
- 契約アカウント:
- 有効期限:
- 自動更新:
- 支払い失敗時の連絡先:
- 2要素認証の確認日:
- 復旧手段の保管項目名:
- Cloudflareへのnameserver委任確認日:

## 運用確認

- [ ] 新しい端末でRepositoryを取得できる
- [ ] Node.js 24とnpmを用意できる
- [ ] `npm ci` が成功する
- [ ] `npm run verify` が成功する
- [ ] ローカルサイトを `astro dev --background` で起動できる
- [ ] GitHub ActionsのCIとDeployを確認できる
- [ ] CloudflareでWorker、D1、Deployments、Routesを確認できる
- [ ] ロリポップの公開先を確認できる
- [ ] 静的サイトのrollback手順を説明できる
- [ ] Workerのrollback手順とD1が戻らない点を説明できる
- [ ] D1のexportと保管場所を確認できる
- [ ] ドメインと各契約の更新日を確認できる

## 秘密情報の変更履歴

値そのものは書きません。

| 日付 | 対象 | 理由 | 実施者 | 影響 | 確認結果 |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## 公開・障害記録へのリンク

| 日付 | 種別 | 概要 | Pull Request / Actions / Incident |
| --- | --- | --- | --- |
|  |  |  |  |
