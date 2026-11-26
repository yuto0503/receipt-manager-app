# GitHub Actionsの作業ルール

- `.github/workflows/ci.yml` のワークフロー名は `CI`、ジョブID・表示名は `frontend`・`backend`・`e2e` に固定する。他ワークフローで同名チェックを追加しない。必須チェックを設定する際の識別名になるため、変更時は影響を確認する。
- PRでチェックが報告されるよう、CIに `paths`・`paths-ignore` による実行省略を追加しない。
- developとmainはGitHub Rulesetでfrontend/backend（GitHub Actions由来）を必須化し、マージ先の最新変更への追従とPRを要求する。管理者バイパスはない。`.github/rulesets/develop.json` と `.github/rulesets/main.json` は適用した設定の記録で、自動反映されない。保護設定を変更する場合はGitHubの現状を先に取得し、既存制約を保持して記録も更新する。
- 外部Actionは公式リリースを確認して完全なコミットSHAで固定し、コメントにバージョンを残す。
- ワークフロー変更時は `git diff --check` と、利用可能なら `actionlint .github/workflows/ci.yml` を実行する。GitHub上の動作確認とローカル構文検証は区別して報告する。
- frontendジョブでは本番ビルド後にChromiumをインストールし、`npm run test:e2e` でモックAPI向けの画面テストを実行する。E2Eの失敗もfrontendチェックを失敗させる。実Go API・MySQLの受け入れテストとは区別し、ビルド時のAPI接続先未設定チェックを維持する。
- 独立した `e2e` ジョブは専用MySQL 8.4の空DB `receipt_e2e` にupマイグレーションを順に適用し、実Go APIと本番Next.jsを起動する。`.github/scripts/run-e2e.sh` が応答待ち・各項目180秒の上限・プロセスグループの終了を担当する。既存のライブラリAPI形式で通常は受け入れ項目1を実行し、手動実行の `extended_e2e=true` で1〜8・12を順次実行する。モックの `/__test/state` や障害注入の `7-server-error`・`7-offline` は混ぜない。
- `e2e` は当面任意チェックとする。GitHub上で複数回の安定成功を確認してから必須化を判断し、失敗を `continue-on-error` で隠さない。成功・失敗時のログと取得できた画像は `e2e-results` artifactとして7日間保存する。
- backendジョブは専用MySQL 8.4とダミー認証情報を使い、ランナーから `127.0.0.1:3306` に接続する。DSNの空チェックと認証を含むhealth checkを維持し、統合テストのSKIPを成功確認として扱わない。
- backendの検査は `go mod download`、整形検査、`go vet ./...`、`go test -v ./... -count=1`、`go build ./...`。Go APIの起動や別途のマイグレーション適用は不要。障害検証には専用環境を使い、開発DBを停止しない。
