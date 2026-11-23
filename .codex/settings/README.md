# 設定の管理

このフォルダは設定方針や補足資料を保管するためのプロジェクト独自のフォルダです。Codexが自動で読み込む設定ファイルではありません。

- Codexの実設定は `../config.toml` に記載します。承認方針・Sandbox・シェル環境変数の設定を明示しています。
- 共通の作業ルールは `../AGENTS.md`、再利用する作業手順は `../../.agents/skills/` に記載します。
- モデルなど個人ごとの選択は、プロジェクト共通にする必要がある場合のみ設定します。
- 設定を追加・変更するときは、利用中のCodexに対応した公式リファレンスで設定名と値を確認し、目的をコメントに残してください。
- 実装に伴い必要になった場合は、このフォルダと `config.toml` も更新してください。古い説明は修正し、未使用の設定は整理してください。
- 認証情報や端末固有の絶対パスを記載しないでください。

公式資料: https://learn.chatgpt.com/docs/config-file/config-basic

## Permissionsの設定方針

- `approval_policy = "on-request"`: Sandboxの範囲を超える操作など、必要な場合に承認を求めます。
- `sandbox_mode = "workspace-write"`: 作業領域内での編集を許可します。`.git`・`.codex`・`.agents` などの保護対象には別途制限があります。
- `sandbox_workspace_write.network_access = false`: Sandbox内のコマンドからのネットワークアクセスを許可しません。Web検索や接続済みツール全体を停止する設定ではありません。
- `shell_environment_policy.ignore_default_excludes = false`: `KEY`・`SECRET`・`TOKEN` を名前に含む環境変数の既定除外を有効にします。環境変数名によるフィルタであり、ファイル内の秘密情報を検査する機能ではありません。

信頼されたプロジェクトで設定が読み込まれます。変更後は新しいセッションで有効なPermissionsを確認してください。起動時の上書きや管理環境の制約が優先されるため、このファイルの編集だけで現在のセッションの権限が変わったとは判断しません。承認の担当者は別設定の `approvals_reviewer` にも依存します（このプロジェクトでは未指定）。

設定キーの参照: https://learn.chatgpt.com/docs/config-file/config-reference

## ローカルコミットの承認

- `.codex/rules/local-commits.rules` は、信頼されたこのプロジェクトで `git add` と通常の `git commit -m` を追加確認なしで実行するためのルールです。
- `config.toml` のサンドボックスや承認モードを全面的に緩めず、対象コマンドだけを許可します。pushや履歴書き換えの許可は追加しません。
- 作業方針は `.codex/AGENTS.md` に記載します。AGENTS.mdへの記載だけではOSの書き込み制限は解除されません。
- ルールはCodexの起動時に読み込まれます。追加後はCodexを再起動してください。プロジェクトの信頼設定と、利用環境・管理者のポリシーが優先されます。
- 検証例: `codex execpolicy check --pretty --rules .codex/rules/local-commits.rules -- git commit -m update`。これはコマンドを実行せず許可判定だけを確認します。

公式資料: https://learn.chatgpt.com/docs/agent-configuration/rules
