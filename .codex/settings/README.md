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

## Git操作の担当

- `git add`・`git commit`・`git push` はユーザー自身が行います。Codexはファイルの変更と必要な検証まで行い、未ステージの状態で引き渡します。
- 作業方針は `.codex/AGENTS.md` に記載します。特定のGit操作を明示的に依頼された場合のみ、その範囲で実行します。
- `git add` と `git commit -m` の専用自動許可設定 `.codex/rules/local-commits.rules` は削除しました。
- 現在のセッションに読み込まれた許可や、他の設定層にある許可を取り消すものではありません。許可が残っていても、上記の作業方針に従って自動実行しません。

## GitHubの読み取り操作の承認

- `.codex/rules/github-readonly.rules` は、`gh auth status`、`gh repo view`、PRのview/list/checks/diff/status、CI実行のview/list/watch、workflowのview/list、issueのview/list/statusを追加確認なしで許可します。
- リポジトリ指定の有無にかかわらず、上記サブコマンドに適用します。GitHubで認証済みのアカウントがアクセスできる範囲を読み取れます。
- PRの作成・マージ・クローズ、設定変更、CI再実行などの変更操作は、このルールでは許可しません。既存のネットワーク制限と承認方針は維持します。
- `gh api` は読み取りにも使用できますが、このルールの対象外です。GET指定の後に別のメソッドを追加でき、GraphQLにも更新操作があるため、コマンドの先頭だけで読み取り専用と保証できません。保護ルール等をAPIで調査するときは承認が残ります。
- 信頼済みプロジェクトでCodexを再起動すると読み込まれます。現在のセッションや管理ポリシーの権限は、このファイルを編集しても変わりません。他の場所に広い許可ルールがある場合、それを取り消す設定ではありません。
- 検証例: `codex execpolicy check --pretty --rules .codex/rules/github-readonly.rules -- gh pr checks 21 --required`。変更操作は同じ方法で `gh pr merge 21` 等に置き換え、allowにならないことを確認します。

## GitHubのPR作成・マージの承認

- `.codex/rules/github-pr-write.rules` は、`gh pr create` と `gh pr merge` を追加確認なしで許可します。ユーザーの依頼に含まれるPR作成・マージで、実行環境の承認待ちを減らすための設定です。
- 自動許可は実行環境の確認を省くもので、依頼されていない公開・マージを行う許可ではありません。作業範囲は引き続きユーザーの指示と `.codex/AGENTS.md` に従います。
- コマンドの先頭で判定するため、マージオプションや `--repo` の指定先は制限しません。このルールが読み込まれたセッションでは、認証アカウントが操作できる他リポジトリへの同コマンドにも適用されます。
- この追加ルールは `gh api`、PRクローズ、リポジトリ削除、`git push` を自動許可しません。GitHub API全体を許可すると、読み取りに加えて設定変更・削除にも及ぶため、一括許可は追加していません。
- CIログ取得は既存の `gh run view --log` が許可対象です。`>` などのシェル構文を組み合わせると、その単純なコマンド許可が適用されず、承認が残る場合があります。
- プロジェクトが信頼されている状態でCodexを再起動すると読み込まれます。現在のセッションや管理ポリシー、他の設定層にあるルールの効果は、この追加だけでは変わりません。
- 検証は `codex execpolicy check --rules .codex/rules/github-pr-write.rules -- gh pr merge 22 --merge` 等で行います。実際のPR作成やマージは実行せず、許可判定だけを確認できます。

公式資料: https://learn.chatgpt.com/docs/agent-configuration/rules
