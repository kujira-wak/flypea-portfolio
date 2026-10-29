# 基盤変更・サービス移行マニュアル

この文書は、通常のサイト更新ではなく、ホスティング、ドメイン、DNS、Cloudflare、データベース、
CI/CD、Astroなど、サイトを支える仕組みを変更するときに使います。

- 対象: 基盤変更を計画・実施・承認する人
- 現在の基準日: 2026-07-26
- 通常運用: [保守・運用マニュアル](operations-manual.md)
- 計画書: [基盤変更計画テンプレート](platform-change-plan-template.md)
- 公開確認: [公開チェックリスト](release-checklist.md)

サービスの画面名、料金、制限、CLIは変わります。実施時はこの文書だけを根拠にせず、変更日の
公式ドキュメントと公式告知を計画書へ記録してください。

## このマニュアルを使う変更

- ロリポップから別の静的ホスティングへ移す
- ドメイン管理事業者だけを変更する
- `flypea.tech` から別ドメインへ移す
- Cloudflare DNS、Proxy、Routes、Bulk Redirectsの構成を変更する
- Workers、Wrangler、compatibility dateの仕様変更へ対応する
- D1またはDurable Objectsを変更・移行する
- Cloudflareを別サービスへ置き換える
- GitHub Actionsまたは公開方式を変更する
- Node.js、Astro、Tailwind CSSのmajor versionを変更する
- 料金、提供終了、セキュリティ告知などにより構成変更が必要になる

記事追加、CSSの小変更、通常のWorkerコード公開は
[保守・運用マニュアル](operations-manual.md)を使います。

## 現在の基盤

変更前に、実際のDashboardと次の表が一致するか確認します。

| 層 | 現在の役割 | 現在のサービス | リポジトリ上の正本 |
| --- | --- | --- | --- |
| ドメイン | `flypea.tech` の登録 | 引き継ぎ台帳で管理 | `docs/operations-record-template.md` |
| DNS・HTTPS・Proxy | 名前解決、TLS、経路制御 | Cloudflare | Dashboard、`worker/wrangler.jsonc` |
| 静的ホスティング | `dist/` の配信 | ロリポップ | `.github/workflows/deploy.yml` |
| 静的サイト生成 | HTML、CSS、画像 | Astro | `astro.config.mjs`、`src/`、`public/` |
| CI/CD | 検証、SFTP公開 | GitHub Actions | `.github/workflows/` |
| API runtime | Reactions、GARDEN | Cloudflare Workers | `worker/` |
| 永続データ | 票、GARDEN状態 | Cloudflare D1 | D1本番、`worker/migrations/` |
| 操作直列化 | 同じ庭への同時操作制御 | Durable Objects | `GardenCoordinator` |
| リダイレクト | 旧URLの301 | Astro、Cloudflare Bulk Redirects | `astro.config.mjs`、`cloudflare/redirects.json` |
| Secrets | SFTP、Worker認証 | GitHub、Cloudflare | 値は非公開台帳 |

交換しやすさは同じではありません。

- 静的ホスティングは `npm run build` の出力 `dist/` を配信できれば置き換えやすい。
- DNSやドメインはサイト以外のMX、TXT、認証レコードにも影響する可能性がある。
- WorkerはAPI contract、Cookie、Origin制限を維持する必要がある。
- D1は本番データの正本であり、最も慎重な移行が必要。
- Durable ObjectsはGARDENの永続的な正本ではないが、操作の直列化を代替する設計が必要。

## 変更時の原則

1. **一度に1つの境界を変える。** ホスティング、DNS、ドメイン、API、DBを同時に切り替えない。
2. **新環境を先に作る。** 旧環境を止める前に、新環境を一時URLまたは限定経路で検証する。
3. **データ変更前に退避する。** D1、設定、DNS record、Secrets名、現在のdeploymentを記録する。
4. **切替条件と中止条件を先に決める。** 問題発生後に「どこまでなら続けるか」を考えない。
5. **戻せる期限を決める。** 旧サービス、旧deployment、旧DNSを観測期間中は維持する。
6. **公開URLとAPI contractを可能な限り維持する。** 内部構成の変更を閲覧者へ漏らさない。
7. **Secretsを移行ログへ書かない。** 値ではなく保管項目名と設定完了だけを記録する。
8. **公式情報を保存する。** 告知URL、確認日、対応期限、対象versionを計画書へ残す。
9. **無関係な変更を混ぜない。** 基盤移行中にデザインやコンテンツを同時変更しない。
10. **旧環境の削除を完了条件にしない。** 安定確認後、別作業として安全に廃止する。

## 変更の危険度

| Level | 例 | 必要な準備 |
| --- | --- | --- |
| 1: 互換変更 | Wrangler更新、compatibility date更新、SFTP鍵更新 | 通常のPull Request、テスト、Worker rollback確認 |
| 2: 経路変更 | 静的ホスト変更、GitHub Actions変更、DNS record変更 | 変更計画、並行環境、本番確認、旧経路維持 |
| 3: 識別子・状態変更 | ドメイン変更、D1移行、DO lifecycle変更、Cloudflare撤去 | データ退避、書き込み方針、段階移行、明示承認、復旧訓練 |

Level 2以上は[基盤変更計画テンプレート](platform-change-plan-template.md)を必ず作成します。
Level 3は、実施者とは別の人が計画、対象、ロールバック条件を確認できる状態を推奨します。

## 共通の変更手順

### Phase 1: 変更理由を確定する

次を一文で説明できるようにします。

- 何が変わるのか
- いつまでに必要か
- 変更しない場合に何が起こるか
- 公式情報はどこにあるか
- 緊急対応か、計画変更か

「新しい方が良さそう」だけでは本番基盤を変更しません。費用、提供終了、障害、セキュリティ、
必要機能など、判断基準を記録します。

### Phase 2: 依存箇所を洗い出す

サービス名やドメインはコード、テスト、文書へ分散しています。変更前に検索します。

```sh
rg -n "flypea\.tech|lolipop|LOLIPOP|Cloudflare|wrangler|D1|SITE_ORIGIN|SFTP" \
  --glob "!node_modules/**" --glob "!dist/**" --glob "!.git/**"
```

検索結果をそのまま全置換しません。表示用の文章、履歴として残す旧URL、設定値、テスト期待値を
分けて判断します。

### Phase 3: 現在の状態を記録する

- Git commitと直近の成功したGitHub Actions run
- 現在の静的ホストと公開先
- DNS record一式、Proxy状態、TTL、DNSSEC/DS
- Worker名、version、route、binding、compatibility date
- D1 database名、ID、migration適用状態、tableごとの件数
- Durable Object classとstorage backend
- Bulk Redirect ListとRule
- SecretsとVariablesの**名前**
- 本番確認URLと現在の応答

Dashboardのスクリーンショットにtoken、メールアドレス、請求情報が含まれないよう注意します。

### Phase 4: 成功条件とロールバック条件を決める

最低限の成功条件:

- 主要ページが200で表示される
- canonicalとOGPが正しい
- 旧URLが意図した301になる
- Reactionsの読み取り、投票、取消が動く
- GARDENのsession、操作、ランキング、復旧が動く
- 管理APIが認証され、無認証は拒否される
- D1の件数と重要な集計が移行前後で一致する
- Cookieの属性とOrigin制限が維持される
- GitHub Actionsから再現可能に公開できる

ロールバック条件の例:

- 主要ページの5xxまたはTLSエラーが継続する
- API書き込みの欠落、重複、認証不良が1件でも確認される
- D1件数またはGARDEN状態が説明なく不一致になる
- 新環境で戻し方が実行できない

数値と待ち時間は変更計画ごとに決めます。

### Phase 5: 新環境を並行構築する

- 一時URL、preview deployment、限定DNSなどで旧環境と並行して作る。
- 本番Secretsは必要最小限だけ設定する。
- 新環境から本番D1へ接続する場合、意図しない書き込みを防ぐ。
- 可能なら読み取り専用、別database、テスト用IDで検証する。
- 自動公開は動作確認が終わるまで無効にする。

### Phase 6: 検証する

```sh
npm ci
npm run verify
npm run build
```

`dist/` の主要ページ、headers、404、末尾slash、画像、fontを新環境で確認します。Worker変更時は
ローカルテスト、dry-run、binding一覧も確認します。

### Phase 7: 切り替える

1. 無関係な公開を止める。
2. D1変更がある場合は最終backupと書き込み方針を実施する。
3. 新しい下流から順に有効化する。
4. DNSまたは公開経路を最後に切り替える。
5. 直後の確認を行う。
6. ロールバック判定時刻まで監視する。

### Phase 8: 完了またはロールバックする

成功条件を満たさない場合、追加修正を本番へ重ねる前に計画済みのロールバックを実施します。
成功した場合も旧サービスを即時解約せず、合意した観測期間を経てから廃止します。

### Phase 9: 後処理する

- 旧Secretsと不要な権限を無効化する
- 旧deployment、DNS、host、databaseの保持期限を記録する
- 請求の二重発生を確認する
- README、運用マニュアル、引き継ぎ台帳、図を更新する
- 変更理由、結果、問題、次回の改善点を残す

## Runbook A: 静的ホスティングを変更する

Cloudflare DNSとWorkerを維持し、ロリポップだけを別の静的ホストへ移すケースです。

### 変更しないもの

- `flypea.tech` の公開URL
- Astroの静的出力
- `/api/reactions/*`、`/api/garden/*`、`/terminal*` のWorker Route
- D1、Durable Objects、Cookie
- contentとページ構成

### 新ホストに必要な条件

- Node.js 24で `npm ci` と `npm run build` を実行できる、または `dist/` を配置できる
- build command: `npm run build`
- publish directory: `dist`
- 独自ドメインとHTTPS
- 末尾slashと `index.html` の配信
- custom 404または同等のエラー応答
- HTMLへ `Cache-Control: no-cache, must-revalidate` 相当を設定できる
- 静的ファイルの削除・同期方法が明確
- preview URLまたは本番前確認方法がある
- GitHub ActionsまたはGit連携から再現可能に公開できる

`public/.htaccess` はApache向けです。新ホストでは無視される可能性があるため、同じcache方針を
新サービスのheaders設定へ移します。

### 準備

1. 新ホストにRepositoryを接続するか、専用のdeploy workflowを作る。
2. 一時URLで `dist/` を公開する。
3. 主要ページ、asset、headers、404、redirect fallbackを確認する。
4. 新ホストへ `flypea.tech` を追加するが、DNSはまだ切り替えない。
5. 新旧ホストの公開方法をそれぞれ手動実行できるようにする。
6. 新しいSecret名、Environment、公開先を文書化する。

### リポジトリの変更箇所

- `.github/workflows/deploy.yml`
- GitHub Actions Secrets / Variables / Environment
- `public/.htaccess` または新ホスト固有のheaders/redirect設定
- `docs/deployment.md`
- `README.md`
- `docs/operations-manual.md`
- `docs/operations-record-template.md`

ホスト変更だけなら `astro.config.mjs` の `site` と `src/config/site.ts` のURLは変えません。

### 切り替え

1. 新ホストへ最終commitを公開する。
2. 新ホストの一時URLで最終確認する。
3. Cloudflareの現在のWeb向けDNS recordを保存する。
4. Web向けrecordだけを新originへ変更する。
5. `/api/reactions/*`、`/api/garden/*`、`/terminal*` が引き続きWorkerへ進むことを確認する。
6. 本番URLとGitHub Actionsの再公開を確認する。

MX、TXT、DKIM、DMARCなどWeb以外のDNS recordをホスト変更に巻き込まないでください。

### ロールバック

- Web向けDNS recordを保存済みの旧originへ戻す。
- 旧ホストへ直近の安定commitを再公開する。
- 新deploy workflowの自動実行を止める。
- DNS、TLS、主要ページ、APIを再確認する。

旧ホストは観測期間終了まで削除・解約しません。

## Runbook B: ドメイン管理事業者だけを変更する

`flypea.tech` は維持し、Registrarだけを変更するケースです。サイトコードのURLは通常変更しません。

### 原則

- Registrar移管とDNS provider変更を同じ日に行わない。
- 現在のnameserver、DNSSEC/DS、登録者連絡先、移管lock、有効期限を先に確認する。
- 移管中もCloudflare nameserverを維持できることを新Registrarで確認する。
- 有効期限直前、連絡先変更直後、lock期間中などの移管制限を確認する。
- 移管完了後もnameserverとDNSSEC/DSが変わっていないことを確認する。

Cloudflare Registrarで取得したdomainから別DNS providerへnameserverを変更する場合、先にRegistrar移管が
必要になることがあります。実施時の公式Registrar手順を確認します。

### 確認

```sh
dig NS flypea.tech
dig A flypea.tech
dig AAAA flypea.tech
dig CNAME www.flypea.tech
```

メールを使う場合はMX、TXT、DKIM、DMARCも確認します。コード変更がなくても、引き継ぎ台帳の
Registrar、更新日、2要素認証、復旧手段を更新します。

### ロールバック

Registrar移管は即時に戻せない場合があります。移管前に取り消し期限とsupport窓口を確認し、
DNSを変えないことでサイト影響を分離します。

## Runbook C: 公開ドメイン名を変更する

例: `flypea.tech` から新しいdomainへ移るケースです。単なる文字列置換ではありません。

### 特に重要な影響

- ReactionsとGARDENのCookieはhost単位です。新domainへ自動移行しません。
- Reactionsの総数はD1に残りますが、同じ閲覧者の投票済み状態は新Cookieと結びつきません。
- GARDENの既存sessionは新domainで使えません。利用者は復旧コードによる移行が必要です。
- `COOKIE_SECRET` を同時変更すると、旧sessionとGARDEN復旧コードの検証にも影響します。
- `SITE_ORIGIN` は現在1つのOriginだけを許可します。移行中に新旧domainから書き込ませる場合、
  許可Originの設計とテストが必要です。
- canonical、OGP、検索結果、外部リンク、Cloudflare Routes、Redirectsが変わります。

### 推奨する段階

1. 新domainを取得し、更新・復旧情報を台帳へ追加する。
2. 新domainのDNS zone、Web host、TLSを用意する。
3. 新domainでも同じ静的サイトを一時公開する。
4. Workerに新domain用routeを追加する。
5. Origin許可を新旧domainの移行方針に合わせて実装・テストする。
6. canonicalを変える前に新domainの主要ページとAPIを確認する。
7. GARDEN利用者へ復旧コード確認の猶予を設ける。
8. 新domainをcanonicalにした静的サイトを公開する。
9. 旧domainの通常ページを同じpathの新domainへ301転送する。
10. 旧APIの扱いを確認し、POSTを無条件redirectしない。
11. 検索・外部サービス・プロフィールURLを順次更新する。
12. 旧domainを長期維持し、301と更新契約を継続する。

### 主な変更箇所

- `astro.config.mjs` の `site`
- `src/config/site.ts` の `name`、`title`、`url`
- `src/layouts/` の固定表示やcanonical
- `worker/wrangler.jsonc` の `routes`、`zone_name`、`SITE_ORIGIN`
- `worker/src/` のOrigin許可ロジック
- `cloudflare/redirects.json`
- `scripts/validate-built-site.mjs`
- `src/data/about.json`
- `src/data/signals.ts`
- `src/content/` 内の現行URL
- テスト内のOriginと期待URL
- GitHub Actions Secrets、公開先、host設定
- READMEと全運用文書

変更漏れの確認:

```sh
rg -n "flypea\.tech" --glob "!node_modules/**" --glob "!dist/**" --glob "!.git/**"
```

旧domainを参照するredirect台帳や移行履歴は、意図的に残します。

### ロールバック

新旧domainを並行稼働させ、旧domainを直ちに解約しないことが最大の安全策です。問題時は、
canonicalと主要導線を旧domainへ戻し、新domainから旧domainへの一時転送を検討します。
DNS伝播だけに依存した即時rollbackは保証できません。

## Runbook D: Cloudflareの仕様変更へ対応する

### 1. 公式通知を分類する

| 種類 | 最初に見るもの | 対応 |
| --- | --- | --- |
| Workers runtime | compatibility date / flags | 対象日以降の変更を確認して別PRで更新 |
| Wrangler CLI / config | Wrangler release、config schema | CLIとtypesを更新しdry-run |
| DNS / Proxy / TLS | Cloudflare DNS・SSL告知 | zoneとcertificateへの影響を確認 |
| Worker Routes | Routes仕様 | `/api/reactions/*`、`/api/garden/*`、`/terminal*` を確認 |
| D1 | D1 changelog、migration、backup | export、SQL互換性、件数を確認 |
| Durable Objects | lifecycle/migration docs | storage、rollback境界、data lossを確認 |
| Rate Limiting | binding仕様とlimit | 429、key、periodをテスト |
| Bulk Redirects | CSV schema、Rule仕様 | generatorとDashboard投入手順を更新 |

公式告知のURL、公開日、対応期限、対象versionを計画書へ記録します。ブログやSNSだけで判断せず、
最終的な仕様を公式referenceで確認します。

### 2. compatibility dateを更新する

現在の値は `worker/wrangler.jsonc` の `2026-07-19` です。

1. 現在日から目標日までに有効になるcompatibility flagsを確認する。
2. Wrangler更新とは別のcommitまたはPull Requestにする。
3. `worker:check`、全Workerテスト、ローカルAPIを確認する。
4. dry-runのbinding一覧が変わっていないことを確認する。
5. Workerを公開してエラー率と主要APIを確認する。

Cloudflareのcompatibility dateは、互換性のないruntime変更へ明示的にopt-inする境界です。
期限がない更新を無検証で現在日に合わせません。一方、長期間固定する場合も、現行documentと
過去挙動の差を継続管理します。

```sh
npm run worker:check
npm run worker:test
npm run garden:test
```

### 3. WranglerとWorkers typesを更新する

対象:

- `package.json` の `wrangler`
- `package.json` の `@cloudflare/workers-types`
- `package-lock.json`
- 必要なら `worker/tsconfig.json`
- 必要なら `worker/wrangler.jsonc`

major update、config変換、compatibility date、D1 migration、Durable Object lifecycle変更を
同じPull Requestへまとめません。

更新後:

```sh
npm ci
npx wrangler --version
npm run worker:check
npm run worker:test
npm run garden:test
npm run verify
```

dry-run出力のWorker名、Routes、D1、Durable Object、Rate Limit、Variablesを変更前と比較します。

### 4. Durable Objectsの仕様変更へ対応する

現在の `GardenCoordinator` はSQLite-backed Durable Objectで、`worker/wrangler.jsonc` の
legacy `migrations` 配列により作成されています。

Cloudflareの現行documentには、class lifecycleを宣言する `exports` 方式もあります。移行が必要に
なった場合は次を守ります。

- `migrations` と `exports` を同時に設定しない。
- 既存classのstorage backendが `sqlite` であることを履歴から確認する。
- `exports` へ移行した後、legacy `migrations` へ戻せない前提で承認する。
- classのdelete、rename、transferは破壊的変更として扱う。
- lifecycle変更をまたぐWorker rollbackはできない前提で計画する。
- storage backendは既存namespace上で変更できない。
- `wrangler deploy` のreconciliation出力を保存し、想定外のdeleteやtransferがないことを確認する。

新しい方式が存在することは、今すぐ移行すべきという意味ではありません。公式の移行要件、利点、
期限が明確になってから独立したLevel 3変更として実施します。

### 5. 仕様変更後のロールバック

コードまたはcompatibility dateだけなら、Cloudflareのdeployment履歴から安定versionへ戻せます。
ただしD1 schema、binding、Durable Object lifecycle変更はWorker rollbackで元に戻りません。
ロールバック可能範囲を変更前に公式documentで再確認します。

## Runbook E: D1を変更・別databaseへ移行する

### 現在の正本

- Reactions: `reactions`
- GARDENの永続状態: `garden_players`
- GARDENのcommand冪等性: `garden_commands`
- migration履歴: D1のmigration管理と `worker/migrations/`

GardenCoordinatorは操作を直列化しますが、永続状態の移行元はD1です。

### schema変更はexpand-contractで行う

可能な限り次の順にします。

1. 旧コードでも壊れないtable、column、indexを追加する。
2. 新旧schemaを扱えるWorkerを公開する。
3. 必要なbackfillを小さく実行し、件数を確認する。
4. 新schemaを使うコードへ切り替える。
5. 観測期間後、古いcolumnや処理を別変更で削除する。

column rename、型変更、table置換を一度に行わず、旧Workerへ戻れる期間を残します。

### 別databaseまたは別サービスへ移す

1. 現行D1をexportする。
2. table、index、constraint、件数、最大・最小時刻を記録する。
3. 新databaseへschemaを作る。
4. test dataでSQL、transaction、同時実行、整数精度を確認する。
5. WorkerのDB access境界を新backendへ対応させる。
6. 最終移行時の書き込み停止、queue、dual-writeのどれを使うか決める。
7. 最終exportまたは差分同期を行う。
8. tableごとの件数と重要な集計を比較する。
9. Workerだけを新databaseへ切り替える。
10. APIを確認し、旧databaseをread-onlyで保持する。

backup例:

```sh
npx wrangler d1 export flypea-portfolio --remote \
  --config worker/wrangler.jsonc \
  --output /tmp/flypea-portfolio-backup.sql
```

export fileをリポジトリへ置きません。暗号化された保管先へ移し、保持期限を記録します。

### 必ず確認する性質

- `reactions` の重複防止
- GARDENの整数費用とtick端数
- command IDの冪等性
- 同じplayerへの操作直列化
- recovery codeの一度限りの利用
- session generationによる旧Cookie無効化
- rankingの未精算成長
- hide/unhide
- timestampとtimezone
- transaction失敗時の全体rollback

新databaseがSQLを使えても、D1と同じtransaction・同時実行・型変換になるとは限りません。

### ロールバック

新databaseへ書き込みを始めた後の単純な接続先復帰は、旧database側に差分を失います。
切替後の書き込みをどう旧databaseへ戻すか決めていない場合、DB rollbackは未完成です。

## Runbook F: Cloudflare全体を別サービスへ置き換える

Cloudflareは1つの役割ではありません。次を個別に代替します。

| 現在の役割 | 代替先で必要な機能 |
| --- | --- |
| Authoritative DNS | A/AAAA/CNAME、MX/TXT、DNSSEC、zone export/import |
| HTTPS / Proxy | certificate、origin接続、headers、cache |
| Worker Routes | path単位でAPI runtimeへ転送 |
| Workers runtime | Web Crypto、Cookie、fetch、環境変数、logging |
| D1 binding | SQL database、transaction、backup |
| Durable Objects | player単位の直列化またはlock |
| Rate Limit binding | visitor/player単位のrate limit |
| Bulk Redirects | query/pathを保つ301 rule |
| Secrets | runtimeへ安全に注入 |
| Observability | error、request、deployment履歴 |

### 移行順

1. 新しいDBとAPI runtimeを本番外で構築する。
2. API contract testを新runtimeへ向けて通す。
3. Cookie署名、Origin制限、rate limit、admin認証を確認する。
4. D1データ移行と書き込み切替方法を確定する。
5. 新APIを限定hostnameで確認する。
6. 静的hostから同じ `/api/...` で到達できる経路を作る。
7. API経路を切り替える。
8. 安定後にWeb ProxyまたはDNSを切り替える。
9. RedirectsとTLSを移行する。
10. Cloudflareを外す前に、全DNS recordとDNSSEC/DSを確認する。

`COOKIE_SECRET` を安全に新runtimeへ移せて同じdomainを維持する場合、既存署名を継続できる可能性が
あります。ただしCookie属性、HMAC実装、session generation、保存形式の互換性をtestで証明します。

GARDENの直列化を省略してD1だけを別DBへ移すと、同時購入、recovery、command replayで競合する
可能性があります。DB transaction、advisory lock、queueなどで同じplayerへの操作を直列化します。

### DNS providerをCloudflareから外す

- 新providerへWeb以外も含む全recordを作る。
- DNSSEC/DSの切替順を両providerとRegistrarの公式手順で確認する。
- 新nameserverが正しく応答することを委任前に確認する。
- Registrarまたは親zoneでnameserverを変更する。
- 複数resolverでNS、A/AAAA/CNAME、MX、TXTを確認する。
- Cloudflare zoneをすぐ削除しない。

nameserver変更はDNS cacheとRegistrar処理により即時rollbackできない場合があります。Web origin変更より
大きいLevel 3変更として扱います。

## Runbook G: GitHub Actions・公開方式を変更する

例:

- SFTPからhostの公式deploy actionへ変更
- Git連携による自動buildへ変更
- GitHub Actions Environmentを導入
- `main` 自動公開から承認付き公開へ変更

### 維持する条件

- `npm ci` を使いlockfileどおりにbuildする
- `.nvmrc` のNode.jsを使う
- 公開前に `npm run verify` を通す
- `dist/` を公開対象にする
- production SecretsはPull Requestから参照できない
- 同時公開を制御する
- deployment履歴と対象commitを追跡できる
- 手動再公開とrollbackの手段がある

GitHub Actions Environmentを使う場合、production approval、branch制限、Environment Secretsを
利用できます。導入時はworkflow jobの `environment` とSecretsのscopeを同じ変更で確認します。

### 並行確認

旧workflowを削除せず、新workflowを手動実行だけで追加します。同じcommitを両方でbuildし、
生成結果と本番確認が一致してから自動triggerを切り替えます。

## Runbook H: Node.js・Astro・Tailwind CSSをmajor更新する

### 原則

- Node.js、Astro、Tailwind CSSを同時にmajor更新しない。
- 公式upgrade guideとrelease notesを確認する。
- framework adapterを追加するときは、静的出力を維持できるか先に判断する。
- 現在はAstroのstatic outputであり、server runtimeは必要ない。
- package更新だけでなく、build成果物とブラウザ動作を比較する。

### Node.js

変更箇所:

- `.nvmrc`
- `package.json` の `engines.node`
- GitHub Actionsは `.nvmrc` を読むため、その動作確認
- `docs/setup.md`
- `docs/operations-manual.md`

### Astro

確認箇所:

- `astro.config.mjs`
- Content Collectionsと `src/content.config.ts`
- `getStaticPaths()` と動的route
- Asset/Image処理
- Redirects
- generated canonical、OGP、hidden pageのrobots
- `scripts/validate-built-site.mjs`

### Tailwind CSS

確認箇所:

- `astro.config.mjs` のVite plugin
- `src/styles/global.css` のthemeとutility
- build後CSS
- focus、breakpoint、font、色

### ロールバック

package更新commitをrevertし、`package.json` と `package-lock.json` を必ず同じ時点へ戻します。
Node.js変更では `.nvmrc` と `engines.node` も同時に戻します。

## 定期的な仕様変更の確認

### 毎月

- Cloudflare Workers Changelog
- Workers compatibility dates / flags
- D1とDurable ObjectsのChangelog
- WranglerとAstroのrelease notes
- GitHub Actionsで使う公式actionのmajor version
- npmの更新候補とsecurity advisory
- 各サービスから届く提供終了、料金、契約、certificateの通知

### 通知を見つけたら

1. 公式URLと確認日を記録する。
2. 対応期限と影響するresourceを確認する。
3. 現在のversionと設定が対象か調べる。
4. 対象外なら根拠を記録して終了する。
5. 対象ならLevelを決め、変更計画を作る。
6. 緊急性がなければ依存更新と機能変更を分ける。

Cloudflare Workersのchangelogは、compatibility flagsで選択する変更とは別に、全体へ適用される変更も
記録します。両方を確認します。

## 変更後の受け入れ確認

### 静的サイト

- `/`
- `/index/`
- `/projects/`
- `/notes/`
- `/shelf/`
- `/about/`
- `/garden-000/`
- `/admin/reactions/`
- `/admin/garden/`
- 代表的な旧URL

### HTTPとmetadata

- 主要ページ: 200
- 存在しないページ: 意図した404
- 旧URL: 301
- canonical: 新しい正本URL
- OGP image: 絶対URLで取得可能
- hidden page: `noindex, nofollow`
- HTML cache: 意図した再検証方針
- asset: 長期cacheしてもfingerprintにより更新可能

### API

- Reactions batch GET
- Reactions PUT / DELETE
- Reactions adminの401と成功
- Garden registration / session
- Garden actionsとcommand replay
- Garden recovery
- Garden leaderboard
- Garden adminの401とhide/unhide
- foreign Originの拒否
- rate limitの429

### Data

- tableごとの件数
- reaction集計
- Garden player数
- hidden player数
- command履歴上限
- representative playerのstate
- 最新timestamp
- backupからの復元手順

### 運用

- GitHub Actionsから再公開できる
- production Secretsの保管場所が更新されている
- 旧環境へのrollbackを実行できる
- logsとdeployment履歴を確認できる
- 担当者と予備担当者が新Dashboardへ入れる

## ロールバック早見表

| 変更 | 主な戻し方 | 戻らないもの |
| --- | --- | --- |
| 静的host | DNSを旧originへ戻し旧hostを再公開 | 新hostでのみ発生した設定 |
| Registrar | supportと移管規則に従う | 即時に戻せない場合がある |
| 公開domain | 旧domainをcanonicalへ戻す | 新domainで作られたhost-only Cookie |
| Worker code | Cloudflare deployment rollback | D1、DO、binding lifecycle |
| compatibility date | 旧Worker versionへrollback | 同時に行ったstate変更 |
| D1 schema | forward fixまたは計画済み復元 | 切替後の未同期書き込み |
| Durable Object lifecycle | 公式制約に従う | lifecycle境界をまたいで戻せない場合がある |
| DNS provider | Registrar/親zoneのNSを戻す | cache中のresolverは即時に戻らない |
| GitHub Actions | workflow commitをrevertし旧手動公開 | 新Secretのscopeや外部host状態 |
| framework major | packageとlockfileを同時revert | 新versionで生成・保存した外部state |

## 公式リファレンス

実施時に最新内容を再確認します。

- [Astro: Deploy your Astro Site](https://docs.astro.build/en/guides/deploy/)
- [Cloudflare Workers: Compatibility dates](https://developers.cloudflare.com/workers/configuration/compatibility-dates/)
- [Cloudflare Workers: Compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/)
- [Cloudflare Workers: Changelog](https://developers.cloudflare.com/workers/platform/changelog/)
- [Cloudflare Workers: Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
- [Cloudflare D1: Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Cloudflare D1: Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Cloudflare Durable Objects: Class lifecycle](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
- [Cloudflare DNS: Update nameservers](https://developers.cloudflare.com/dns/nameservers/update-nameservers/)
- [Cloudflare DNS: Full setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/)
- [GitHub Actions: Deployment environments](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments)
