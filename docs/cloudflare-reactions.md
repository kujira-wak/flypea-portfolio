# Cloudflare Worker + D1 高評価機能

静的サイトは引き続きロリポップから配信し、`/api/reactions/*`だけをCloudflare Workerへ送ります。WorkerやD1に障害が起きた場合も、記事ページ自体は影響を受けません。

## 実装済みの機能

- 記事ごとの「参考になった」の同期と件数表示
- Learning Logの高評価順、タグとの組み合わせ
- 自分が高評価した記事だけを表示
- トップページの「人気のLearning Log」
- `/admin/reactions/` の簡易集計（累計、7日、30日、最終日時）
- 旧localStorageリアクションのD1への自動移行
- 1ブラウザ・1記事につき1票、取り消し可能

ブラウザ識別子は署名付きのHttpOnly Cookieに保存し、D1にはそのSHA-256ハッシュだけを記録します。IPアドレスや個人情報は保存しません。

## Cloudflareへ初回設定する

以下はCloudflareにログイン済みの端末で実行します。

```sh
npx wrangler login
npx wrangler d1 create flypea-portfolio
```

表示された`database_id`を`worker/wrangler.jsonc`の仮IDと置き換えます。その後、D1とWorkerのSecretを設定します。

```sh
npm run worker:migrate:remote
npx wrangler secret put COOKIE_SECRET --config worker/wrangler.jsonc
npx wrangler secret put ADMIN_TOKEN --config worker/wrangler.jsonc
npx wrangler deploy --config worker/wrangler.jsonc
```

`COOKIE_SECRET`と`ADMIN_TOKEN`には、それぞれ別の長いランダム文字列を設定します。値はGitへ保存しません。Worker Routeは設定ファイルに定義済みで、`flypea.tech/api/reactions/*`だけに適用されます。

書き込み元は`SITE_ORIGIN`（本番は`https://flypea.tech`）と一致するOriginだけに制限しています。

ローカルでAPIも確認する場合は`worker/.dev.vars.example`を`worker/.dev.vars`へコピーして値を変更し、WorkerとAstroを別々のターミナルで起動します。Astroの`/api/reactions`はローカルWorkerへプロキシされます。

```sh
npm run worker:migrate:local
npm run worker:dev
npx astro dev --background
```

## 管理画面

`https://flypea.tech/admin/reactions/`で、Workerへ設定した`ADMIN_TOKEN`を入力します。トークンはタブを閉じるまで`sessionStorage`にだけ保持され、HTMLやD1には保存されません。

さらにアクセス元を限定したい場合は、Cloudflare Accessを`/admin/reactions/*`だけに追加できます。集計API自体はAccessの有無にかかわらずBearer Tokenで保護されています。

## URL変更対策

記事slugやページURLを変更する前に、`cloudflare/redirects.json`へ旧URLと新URLを追加します。

```json
[
  {
    "source": "https://flypea.tech/log/old-slug/",
    "target": "https://flypea.tech/log/new-slug/",
    "status": 301,
    "preserveQuery": true
  }
]
```

次のコマンドでCloudflare Bulk Redirects用CSVを生成します。CSVにはヘッダー行を付けません。

```sh
npm run redirects:build
npm run verify
```

Cloudflare Dashboardの「Rules > Redirect Rules > Bulk Redirects」でリストを作り、`cloudflare/redirects.csv`をインポートして、そのリストを有効にするBulk Redirect Ruleを1つ作成します。現在は変更済みURLがないため台帳は空です。URL変更と同じPRで台帳を更新すると、リンク切れを防げます。

## 日常の確認

```sh
npm run verify
```

Astroの型検査・Lint・静的ビルドに加え、リダイレクトCSVの同期とWorkerのドライランも実行します。
