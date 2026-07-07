# Lolipop deployment

このプロジェクトはAstroで静的ファイルを生成し、GitHub ActionsからロリポップへSFTPでアップロードします。

## 使うGitHub Secrets

GitHubリポジトリの `Settings > Secrets and variables > Actions > Secrets` に以下を登録します。

| Name | 内容 |
| --- | --- |
| `LOLIPOP_SFTP_HOST` | ロリポップのSFTP/SSHホスト名 |
| `LOLIPOP_SFTP_USER` | ロリポップのSFTP/SSHユーザー名 |
| `LOLIPOP_SFTP_PASSWORD` | ロリポップのSFTP/SSHパスワード |
| `LOLIPOP_SFTP_PORT` | SFTP/SSHポート番号 |
| `LOLIPOP_DEPLOY_PATH` | 公開先ディレクトリ |

`LOLIPOP_DEPLOY_PATH` は `dist/` の中身を置く場所です。
独自ドメイン `flypea.tech` に割り当てた公開フォルダを指定します。

例:

```text
/home/users/0/example.jp-example/web/flypea.tech
```

実際のパスはロリポップのユーザー専用ページで確認してください。

## 自動デプロイを有効にする

誤った公開先へアップロードする事故を避けるため、`main` へのpush時デプロイはリポジトリ変数で明示的に有効化します。

GitHubリポジトリの `Settings > Secrets and variables > Actions > Variables` に以下を登録します。

| Name | Value |
| --- | --- |
| `LOLIPOP_DEPLOY_ENABLED` | `true` |

この変数がない場合、`main` へのpushではデプロイジョブはスキップされます。

## 手動デプロイ

GitHubの `Actions > Deploy to Lolipop > Run workflow` から手動実行できます。
手動実行は `LOLIPOP_DEPLOY_ENABLED` がなくても動きます。

## ローカルで確認すること

デプロイ前に以下が通る状態にします。

```sh
npm run verify
```

ビルド成果物は `dist/` に生成されます。

## 注意

現在のデプロイ設定は、ロリポップ側の既存ファイル削除を行いません。
不要になった古いファイルが残るようになったら、公開先ディレクトリが正しいことを確認してから削除同期を検討します。
