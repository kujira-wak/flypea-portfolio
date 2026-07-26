# GARDEN / 000 運用ガイド

`/garden-000/` は、Cloudflare Worker・D1・プレイヤー単位のDurable Objectを使う
サーバー正本のクリッカーゲームです。ゲーム画面はAstroの静的ページですが、成長量や設備を
ブラウザ側で確定・永続化しません。

## 正本とブラウザ保存

- D1の`garden_players`が成長、CARE、設備、精算時刻、操作トークン、revision、
  ランキング掲載状態の永続的な正本です。
- `garden_commands`にはプレイヤーごとの直近64コマンドだけを残し、再送を冪等に処理します。
- `GardenCoordinator`はプレイヤーIDから決まるSQLite-backed Durable Objectです。同じ庭への
  操作を直列化するためだけに使い、ゲーム状態の永続的な正本にはしません。
- ブラウザに永続保存するゲーム情報は、署名付き`HttpOnly` Cookieだけです。Cookieには
  プレイヤーIDとセッション世代を署名した資格情報が入り、JavaScriptからは読めません。
- `localStorage`と`sessionStorage`には、成長量、CARE、設備、未送信操作、復旧コードを保存しません。
  通信不能になった時点で未送信CAREを破棄し、再接続時にサーバー時刻から受動成長だけを精算します。

## API

| Method | Path | 用途 |
| --- | --- | --- |
| `POST` | `/api/garden/players` | 新規登録、Cookie発行、復旧コードの一度限りの表示 |
| `POST` | `/api/garden/session` | Cookie確認と最大24時間の受動成長精算 |
| `POST` | `/api/garden/actions` | `commandId`付きCARE／購入コマンドの処理 |
| `PATCH` | `/api/garden/me` | 公開ニックネーム変更 |
| `DELETE` | `/api/garden/me` | 庭、ランキング掲載、コマンド履歴の削除 |
| `GET` | `/api/garden/leaderboard?limit=20` | サーバー時刻で算出した上位記録と自分の順位 |
| `POST` | `/api/garden/card-snapshot` | ARCHIVE PLATE用の最新認定スナップショット |
| `POST` | `/api/garden/recover` | 復旧コードによる新ブラウザへの移行 |
| `POST` | `/api/garden/me/recovery-code/rotate` | 復旧コード再発行 |

管理画面`/admin/garden/`は、既存の`ADMIN_TOKEN`を使ってランキングのhide/unhideを行います。
ニックネームの自動NG判定はありません。

## 復旧

復旧コードは128bitの乱数を4文字ずつに分割して表示します。D1に保存するのは
`COOKIE_SECRET`を鍵にしたHMACだけです。

復旧またはコード再発行が成功すると、それまでのコードは即座に無効になります。復旧時には
セッション世代も更新するため、旧ブラウザのCookieでは以後アクセスできません。新しい復旧コードは
応答時に一度だけ表示されます。Cookieと復旧コードを両方失った庭はv1では復旧できません。

## ARCHIVE PLATE

認定全長6,000mmで永久解放します。作成画面を開いた時と、PNG保存または共有の直前に
`card-snapshot`を取り直します。1200×1500pxの不透明PNGはブラウザ内で生成し、画像、履歴、
公開URLをサーバーへ保存しません。

カードは記念画像であり、改変検知用の証明書ではありません。順位は常にランキングAPIを正とします。

## ローカル開発

最初にローカルD1へmigrationを適用します。

```sh
npm run worker:migrate:local
```

最初にローカル専用の秘密値を作ります。サンプルをコピーし、`COOKIE_SECRET`と
`ADMIN_TOKEN`へそれぞれ異なる長いランダム文字列を設定してください。

```sh
cp worker/.dev.vars.example worker/.dev.vars
openssl rand -hex 32
```

`worker/.dev.vars`はGit管理外です。管理画面`/admin/garden/`では、このファイルへ設定した
`ADMIN_TOKEN`と同じ値を入力します。Worker起動ログでは値そのものは`(hidden)`と表示されます。

その後、別々のターミナルでWorkerとAstroを起動します。

```sh
npm run worker:dev
astro dev --background
```

Astroは`/api/garden`をローカルWorkerへプロキシします。ゲームへの初回導線はトップページの
CURRENT SIGNALにある橙色の小点を3回操作し、Aboutの肖像を選びます。

## 本番反映順

1. D1 migration `0002_garden.sql`をremoteへ適用する。
2. `GardenCoordinator`のSQLite class migrationと`GARDEN_COORDINATOR` bindingを含むWorkerを
   dry-runで確認してから公開する。
3. Garden APIが応答することを確認する。
4. 最後にAstroの静的成果物を公開する。

```sh
npm run worker:migrate:remote
npm run worker:check
npx wrangler deploy --config worker/wrangler.jsonc
npm run build
```

Durable Objectのstorage backendは作成後に変更できないため、初回公開前に
`new_sqlite_classes`であることを必ず確認します。

## 検証

通常の`npm run verify`に加え、GardenのWorkerテストでは整数費用列、tick端数、25操作/秒、
24時間上限、冪等コマンド、復旧、カード解放、hide/unhide、未精算分を含むランキングを確認します。
ブラウザ側のテストではゲーム状態をWeb Storageへ書かないこと、カードの寸法と最新snapshot取得、
Canvas代替DOM、Web Shareのフォールバックを確認します。
