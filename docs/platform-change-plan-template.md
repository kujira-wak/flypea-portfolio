# 基盤変更計画テンプレート

ホスティング、ドメイン、DNS、Cloudflare、D1、CI/CD、major versionを変更するときに、
このファイルをPull Requestまたは非公開の作業記録へコピーして使います。

Secrets、token、password、本番databaseの内容は記載しません。
手順は[基盤変更・サービス移行マニュアル](platform-change-manual.md)を参照してください。

## 1. 基本情報

- 変更名:
- 危険度: Level 1 / Level 2 / Level 3
- 計画者:
- 実施者:
- 確認者:
- 実施予定日時:
- 対応期限:
- Pull Request / commit:
- 公式告知・仕様:
- 変更理由:
- 変更しない場合の影響:

## 2. 現在と変更後

| 層 | 現在 | 変更後 | 変更するか |
| --- | --- | --- | --- |
| Registrar |  |  |  |
| Domain |  |  |  |
| DNS / DNSSEC |  |  |  |
| HTTPS / Proxy |  |  |  |
| 静的host |  |  |  |
| CI/CD |  |  |  |
| API runtime |  |  |  |
| Database |  |  |  |
| 直列化 / Lock |  |  |  |
| Rate limit |  |  |  |
| Redirects |  |  |  |
| Secrets保管 |  |  |  |
| Observability |  |  |  |

変更しない境界:

## 3. 影響調査

- 検索に使った語:
- 影響するファイル:
- 影響するGitHub Secrets / Variables名:
- 影響するCloudflare resources:
- 影響するDNS records:
- 影響する公開URL:
- 影響するAPI:
- 影響するCookie:
- 影響する本番データ:
- 影響する管理画面:
- 影響する契約・請求:
- 利用者への案内:

## 4. 現在の証跡

- 現在のGit commit:
- 直近の成功したCI:
- 直近の成功した静的deploy:
- 現在のWorker version:
- 現在のcompatibility date:
- 現在のD1 migration:
- 現在のDurable Object lifecycle:
- DNS export / record一覧の保管場所:
- D1 backupの保管場所:
- Secrets一覧の確認日:
- 旧環境の保持期限:

値そのものではなく、安全な保管場所と確認日だけを書きます。

## 5. 成功条件

- [ ] 主要ページが200
- [ ] 旧URLが意図した301
- [ ] canonical、OGP、robotsが正しい
- [ ] Reactionsの読取・投票・取消が成功
- [ ] GARDENのsession・操作・ランキング・復旧が成功
- [ ] 管理APIの認証・拒否が正しい
- [ ] foreign Originが拒否される
- [ ] Data件数と重要な集計が一致
- [ ] GitHub Actionsから再公開可能
- [ ] Logsとdeployment履歴を確認可能
- [ ] 担当者と予備担当者が操作可能

追加の成功条件:

## 6. 中止・ロールバック条件

- 中止する症状:
- 判断する数値:
- 判断期限:
- 判断者:
- 切替を続けてよい条件:
- その場で修正せず戻す条件:

## 7. Test計画

| No. | 確認対象 | 操作 | 期待結果 | 実施環境 | 結果 |
| --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |

確認する画面幅・browser:

確認するHTTP status・headers:

確認するData件数・query:

## 8. Data移行

- Data正本:
- 移行対象table:
- 移行対象外:
- backup方法:
- backup時刻:
- 書き込み停止方法:
- 差分同期またはdual-write方法:
- 件数比較方法:
- 整合性確認:
- 切替後の旧database:
- 復元方法:
- 復元に必要な権限:

Data変更がない場合の根拠:

## 9. DNS・Domain

- 現在のRegistrar:
- 現在のnameserver:
- 現在のDNSSEC / DS:
- 変更するrecords:
- 変更しないMX / TXT等:
- TTL方針:
- 新nameserverの事前確認:
- TLS certificateの確認:
- 伝播確認に使うresolver:
- 旧domain / zoneの保持期限:

変更がない場合の根拠:

## 10. Secrets・権限

- 移行するSecret名:
- 新環境でのscope:
- 設定者:
- 旧Secretを無効化する日:
- 新旧担当者の権限:
- 2要素認証と復旧手段の確認日:

値そのものは書きません。

## 11. 実施手順

各手順に証跡と中止条件を付けます。

| No. | 予定時刻 | 担当 | 操作 | 成功の証跡 | 中止条件 | 完了 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  | [ ] |

## 12. ロールバック手順

| No. | 担当 | 操作 | 戻ったことの証跡 | 完了 |
| --- | --- | --- | --- | --- |
| 1 |  |  |  | [ ] |

ロールバック後に失われる可能性があるData:

ロールバック不能になる境界:

旧環境を維持する期限:

## 13. 公開後の監視

- 直後:
- 15分後:
- 1時間後:
- 翌日:
- 観測期間終了時:
- 見るlogs / metrics:
- 問題時の連絡順:

## 14. 後処理

- [ ] READMEを更新
- [ ] 保守・運用マニュアルを更新
- [ ] 基盤変更マニュアルを更新
- [ ] deployment文書を更新
- [ ] 引き継ぎ台帳を更新
- [ ] 不要なSecretsと権限を無効化
- [ ] 旧serviceの保持期限を記録
- [ ] 二重請求を確認
- [ ] 旧serviceを安全に解約
- [ ] 変更結果と問題点を記録

## 15. 実施結果

- 実施日時:
- 結果: 成功 / ロールバック / 一部延期
- 最終commit:
- 最終静的deploy:
- 最終Worker version:
- Data確認:
- 残作業:
- 次回への改善:
