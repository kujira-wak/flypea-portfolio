# ロリポップへのデプロイ

このプロジェクトはAstroで静的ファイルを生成し、GitHub ActionsからロリポップへSFTPでアップロードします。

## 使うGitHub Secrets

GitHubリポジトリの `Settings > Secrets and variables > Actions > Secrets` に以下を登録します。

| Name | 内容 |
| --- | --- |
| `LOLIPOP_SFTP_HOST` | ロリポップのSFTP/SSHホスト名 |
| `LOLIPOP_SFTP_USER` | ロリポップのSFTP/SSHユーザー名 |
| `LOLIPOP_SFTP_PASSWORD` | ロリポップのSFTP/SSHパスワード |
| `LOLIPOP_SFTP_PORT` | SFTP/SSHポート番号 |
| `LOLIPOP_SFTP_KNOWN_HOSTS` | SFTP接続先を確認するためのknown_hosts行 |
| `LOLIPOP_DEPLOY_PATH` | 公開先ディレクトリ |

`LOLIPOP_DEPLOY_PATH` は `dist/` の中身を置く場所です。
独自ドメイン `flypea.tech` に割り当てた公開フォルダを指定します。

例:

```text
/home/users/0/example.jp-example/web/flypea.tech
```

実際のパスはロリポップのユーザー専用ページで確認してください。

`LOLIPOP_SFTP_KNOWN_HOSTS` には、ロリポップのSFTP/SSHサーバーの公開ホスト鍵を `known_hosts` 形式で登録します。
ポートが `2222` の場合は、ホスト名を `[host]:2222` 形式にします。

例:

```text
[ssh.lolipop.jp]:2222 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA...
```

ホスト鍵は接続前に信頼できる経路で確認してください。
一時的な確認コマンドとしては以下を使えますが、取得した値をそのまま信頼せず、ロリポップ側の表示や初回接続時のfingerprintと照合してからSecretへ登録します。

```sh
ssh-keyscan -p 2222 ssh.lolipop.jp
```

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
