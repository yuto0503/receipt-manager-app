# GitHub Actionsの作業ルール

- `.github/workflows/ci.yml` のワークフロー名は `CI`、ジョブID・表示名は `frontend` と `backend` に固定する。他ワークフローで同名チェックを追加しない。必須チェックを設定する際の識別名になるため、変更時は影響を確認する。
- PRでチェックが報告されるよう、CIに `paths`・`paths-ignore` による実行省略を追加しない。
- 外部Actionは公式リリースを確認して完全なコミットSHAで固定し、コメントにバージョンを残す。
- ワークフロー変更時は `git diff --check` と、利用可能なら `actionlint .github/workflows/ci.yml` を実行する。GitHub上の動作確認とローカル構文検証は区別して報告する。
- backendジョブは専用MySQL 8.4とダミー認証情報を使い、ランナーから `127.0.0.1:3306` に接続する。DSNの空チェックと認証を含むhealth checkを維持し、統合テストのSKIPを成功確認として扱わない。
- backendの検査は `go mod download`、整形検査、`go vet ./...`、`go test -v ./... -count=1`、`go build ./...`。Go APIの起動や別途のマイグレーション適用は不要。障害検証には専用環境を使い、開発DBを停止しない。
