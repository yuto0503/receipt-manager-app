# 設定の管理

このフォルダは設定方針や補足資料を保管するためのプロジェクト独自のフォルダです。Codexが自動で読み込む設定ファイルではありません。

- Codexの実設定は `../config.toml` に記載します。現在はコメントのみで、設定値の上書きはありません。
- 共通の作業ルールは `../AGENTS.md`、再利用する作業手順は `../../.agents/skills/` に記載します。
- モデルなど個人ごとの選択は、プロジェクト共通にする必要がある場合のみ設定します。
- 設定を追加・変更するときは、利用中のCodexに対応した公式リファレンスで設定名と値を確認し、目的をコメントに残してください。
- 実装に伴い必要になった場合は、このフォルダと `config.toml` も更新してください。古い説明は修正し、未使用の設定は整理してください。
- 認証情報や端末固有の絶対パスを記載しないでください。

公式資料: https://learn.chatgpt.com/docs/config-file/config-basic

## ローカルコミットの承認

- `.codex/rules/local-commits.rules` は、信頼されたこのプロジェクトで `git add` と通常の `git commit -m` を追加確認なしで実行するためのルールです。
- `config.toml` のサンドボックスや承認モードを全面的に緩めず、対象コマンドだけを許可します。pushや履歴書き換えの許可は追加しません。
- 作業方針は `.codex/AGENTS.md` に記載します。AGENTS.mdへの記載だけではOSの書き込み制限は解除されません。
- ルールはCodexの起動時に読み込まれます。追加後はCodexを再起動してください。プロジェクトの信頼設定と、利用環境・管理者のポリシーが優先されます。
- 検証例: `codex execpolicy check --pretty --rules .codex/rules/local-commits.rules -- git commit -m update`。これはコマンドを実行せず許可判定だけを確認します。

公式資料: https://learn.chatgpt.com/docs/agent-configuration/rules
