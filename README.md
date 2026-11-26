# receipt-manager-app

レシートを手入力で登録・閲覧・編集・削除できるWebアプリです。画像アップロード・OCRによる家計簿の自動生成は今後の拡張です。

2026-11-07の実DBを使った受け入れ検証結果と再実行手順は [動作確認と完了判定](ACCEPTANCE.md) を参照してください。

## 起動・停止コマンド（Docker Compose）

Docker Desktopを起動し、以下はすべてプロジェクトのルート（`receipt-manager-app/`）で実行します。

### 接続設定

初回はダミー値の設定例から `backend/.env` と `frontend/.env.local` を作成します。既存の実設定を上書きしないでください。

```bash
cp -n backend/.env.example backend/.env
cp -n frontend/.env.example frontend/.env.local
```

Composeで動かす場合は `frontend/.env.local` の `SERVER_API_BASE_URL` を `http://backend:8080` に変更します。ホスト上のNext.jsでは `http://localhost:8080` を使います。

実設定の `.env`・`.env.*` はGitの追跡対象外です。共有する `.env.example` と以下の例には、ローカル開発専用のダミー値だけを記載します。

```bash
# 実設定が無視されていることを確認（内容は表示しない）
git check-ignore backend/.env backend/.env.local frontend/.env.local
# 設定例だけが表示されることを確認
git ls-files '*env*'
```

以下は `docker-compose.yml` のローカル開発用設定に対応する例です。

`backend/.env`:

```dotenv
DB_USER=root
DB_PASSWORD=password
DB_HOST=mysql
DB_PORT=3306
DB_NAME=receipt_app
```

`frontend/.env.local`:

```dotenv
SERVER_API_BASE_URL=http://backend:8080
```

### バックエンド・フロントエンドを同時に起動

```bash
docker compose up -d --build mysql backend frontend
```

`-d` はバックグラウンド起動、`--build` は起動前のイメージビルドです。

### 個別に起動

バックエンドとMySQL:

```bash
docker compose up -d --build mysql backend
```

フロントエンド:

```bash
docker compose up -d --build frontend
```

フロントエンドの起動時も、依存するバックエンド・MySQLが停止していれば一緒に起動します。

### 初回のDB準備

MySQLが接続を受け付ける状態になった後、テーブル作成・未適用のマイグレーション適用を行います。接続先はCompose内のローカル開発用MySQLです。

```bash
make migrate-up
```

### アクセス・ログ確認

- フロントエンド: [http://localhost:3000](http://localhost:3000)
- バックエンドの起動確認: [http://localhost:8080/health](http://localhost:8080/health)

```bash
# コンテナの起動状態
docker compose ps

# フロントエンド・バックエンドのログ（Ctrl+Cでログ表示を終了）
docker compose logs -f frontend backend
```

### 停止・再開

```bash
# フロントエンド・バックエンド・MySQLを停止
docker compose stop

# 個別に停止する場合
docker compose stop frontend
docker compose stop backend

# 停止した既存コンテナを再開
docker compose start mysql backend frontend
```

`stop` ではDBのデータは残ります。設定や依存関係を変更した場合は、再度 `docker compose up -d --build mysql backend frontend` を実行してください。

## CI

[CIワークフロー](.github/workflows/ci.yml) のfrontendジョブは、依存インストール・Prettier整形検査・lint・独立した型検査（`next typegen && tsc --noEmit`）・単体テスト・本番ビルド（TypeScript検査を含む）・一覧ページの動的描画検査・ChromiumによるモックAPI向けE2Eを順に実行する設定です。backendジョブは専用MySQL 8.4を起動し、Goの整形検査・静的検査・単体／MySQL統合テスト・ビルドを実行する設定です。独立したe2eジョブでは、実Go API・専用MySQLを通すブラウザテストも実行します。既存frontend/backendのGitHub上の成功は下記の検証記録を参照してください。新しい実DB e2eジョブのGitHub上での確認は、次回push時に行ってください。

全ブランチへのpush（タグpushは対象外）と、`develop`・`main` 向けPRの作成・更新・再オープン時に実行します。`pull_request.branches` は変更元ブランチではなく、マージ先ブランチの条件です。

`workflow_dispatch` による手動起動も定義しています。2026-11-12にPR #17をデフォルトブランチ `develop` へ取り込み、手動起動の成功を確認しました（下記の検証記録を参照）。

変更ファイルのパスによる実行省略は行いません。文書だけを変更したPRでもチェックを報告し、必須チェックが実行されず待機し続ける事態を防ぎます。

同じワークフロー・イベント・ブランチ／PRの古い実行は、新しい更新でキャンセルします。PRを開いたブランチへのpushでは、pushとPRの両イベントで実行されます。イベントをまたいだキャンセルは行わず、変更コミットとマージ予定の状態をそれぞれ確認できる構成です。

ジョブID・表示名は `frontend`・`backend`・`e2e` に固定し、他ワークフローで同名チェックを作りません。各ジョブは `ubuntu-24.04` 上で独立して実行し、タイムアウトはfrontend/backendが15分、e2eが20分です。権限は `contents: read` のみに限定し、checkout後に認証情報を保持しません。

Actionは公式リリースの完全なコミットSHAで固定しています。Node.js 24と `backend/go.mod` 指定のGoを準備します。frontendはlockfileをキーにnpmのダウンロードキャッシュを使い、毎回 `npm ci` を実行します。backendは `backend/go.sum` をキーにGoの依存とビルドキャッシュを利用し、毎回 `go mod download` を実行します。backendもGitHub上で実行成功を確認済みです。developの必須チェックは下記のマージ保護で設定しています。

検証記録（実装コミット `0cacb7ad`）: [pushの成功](https://github.com/yuto0503/receipt-manager-app/actions/runs/42716208448)、[PRの成功](https://github.com/yuto0503/receipt-manager-app/actions/runs/42716216868)。lint・単体テスト・ビルドの失敗は終了コードでジョブへ伝え、成功扱いにしません。

frontendの検証は `.env`・Go API・MySQLなしで実行できます。画面を利用する際にはAPIの接続設定が必要です。[ローカルでの検証手順](frontend/README.md#ciと同じ検証)を参照してください。

### frontendのformatter・typecheck導入検証（2026-11-24）

- [x] Prettierの整形チェック・ESLint・単体テスト34件が成功。コード・テスト25ファイルの変更は、変更前にPrettierを適用した結果と一致することを確認。
- [x] 実設定・生成物を含まない一時コピーで `npm ci`、独立した型検査、本番ビルド、一覧ページの動的描画検査が成功。ビルドはサンドボックス内で進行しなかったため、同じ一時コピーで制限外に再実行して成功。
- [x] 別の一時コピーに未整形コード・型不一致を入れ、各チェックの非0終了と修正後の成功を確認。
- [x] ワークフローのYAML読み込みと `git diff --check` が成功。`actionlint` は環境にないため未実施。
- [x] 追加後のGitHub Actionsのfrontendジョブ成功を確認。[PR実行](https://github.com/yuto0503/receipt-manager-app/actions/runs/45718736589)で整形・型検査を含む全ステップ成功。

### frontendのE2E導入検証（2026-11-24）

既存の8本の画面テストを `npm run test:e2e` にまとめ、frontendジョブの本番ビルド後に実行します。対象はChromium → Next.js → 専用モックAPIです。実Go API・MySQLを通す受け入れ検証は含みません。共有状態の競合を避けるため1ワーカーで順番に実行し、失敗はfrontendチェックへ伝えます。[実行手順・レポート](frontend/README.md#ciで実行するe2e)を参照してください。

- [x] 実設定・生成物を含まない一時コピーで `npm ci`、型検査、単体テスト34件、本番ビルド、動的描画検査が成功。整形チェック・lintも成功。
- [x] macOS / Node.js 24.11.0 / Playwright 1.65.1のChromiumで、`CI=true npm run test:e2e` が8本すべて成功（29.1秒）。HTMLレポートと画像4枚の出力を確認。
- [x] 既存テストの描画待ち不足と遷移後のレスポンス本文取得で非0終了・失敗ログ保存を確認。テストを修正し、全件成功へ復旧。
- [x] ワークフローのYAML読み込み、frontend/backendのジョブ名維持、`git diff --check` を確認。`actionlint` は環境にないため未実施。
- [x] 2026-11-26に現在のコードから一時環境を作り直して再検証。整形・lint・型検査・単体テスト34件・本番ビルド・動的描画検査・E2E全8本（27.9秒）が成功。検証環境と作業中のコード・テスト・設定50ファイルの一致も確認。
- [x] GitHub ActionsのUbuntu上でモックE2E全8本成功と `frontend-e2e-results` artifact保存を確認。[push](https://github.com/yuto0503/receipt-manager-app/actions/runs/45718728698)・[PR](https://github.com/yuto0503/receipt-manager-app/actions/runs/45718736589)、実装コミット `7e5ed805`。2026-11-27に実行ログと成果物情報を確認。

### 実Go API・MySQLを通すe2eジョブ

`frontend` のモックテストとは別に、`e2e` がジョブ専用MySQL 8.4の空DB `receipt_e2e`、Go API、本番ビルドしたNext.js、Chromiumを準備します。空DBを確認して `backend/migrations/*.up.sql` をファイル名順に適用し、MySQLの認証付きhealth check、APIの `/health` と `/receipts`、フロントの `/receipts` の応答を待ちます。Go単体テスト用の一時テーブルや他ジョブのプロセスは共有しません。

既存のライブラリAPI方式を保ち、`node tests/receipt-acceptance.e2e.mjs 1` で実DBのCRUDを検査します。初期は項目1だけを通常のpush・PRで実行し、Actionsの手動実行で `extended_e2e` を有効にすると1〜8・12を順次実行します。拡張項目では文字数と日付境界・フォーカス・キーボード操作・画面幅・コンソール／通信も検査します。通常CIへの拡張はLinux上の安定性を確認してから行います。モック専用の `/__test/state` は使用せず、障害発生と復旧の管理が必要な `7-server-error`・`7-offline` は通常実行に含めません。

`.github/scripts/run-e2e.sh` がAPIとフロントの起動、各応答の60秒上限、各テストの180秒上限、成功・失敗・中断時の終了処理を担当します。作成したIDだけを削除する既存方針を維持します。API・フロント・MySQL・各テストのログと取得できた画像は `frontend/test-results/acceptance/` に保存し、`e2e-results` artifactとして成功・失敗時とも7日間保存します。ライブラリAPI方式なのでHTMLレポートやtraceを自動生成する設定ではありません。

必須チェックは引き続き `frontend`・`backend` です。新しい `e2e` の失敗はActions上でfailureになりますが、当面マージの必須条件には追加しません。push後にUbuntu上での複数回の成功、成果物保存、実行時間と不安定な失敗の有無を確認してから追加を判断します。既存モックE2Eの成功を、新しい実DBジョブの成功と扱わないでください。[ローカル手順](frontend/README.md#実go-apimysqlのci検証)も参照してください。

導入検証（2026-11-27）:

- [x] 実設定を含まない一時コピーのLinux arm64 / Debian 12 / Node.js 24.22.3 / Go 1.26.3 / MySQL 8.4 / Playwright 1.65.1で、依存とChromiumのインストール、整形・lint・型検査、単体34件、API／フロント本番ビルド、動的描画検査が成功。
- [x] 専用の空DBへのマイグレーション適用後、CRUDの項目1を確認し、拡張の1〜8・12も全件成功。日本語・日付入力・フォーカス・キーボード操作を検査し、320pxの画像も確認。
- [x] 一時コンテナ内の意図的なassertion失敗で非0終了・失敗画像・ログ保存を確認。成功時・失敗時・API起動失敗時にサーバーポートが解放されることを確認。プローブ復元後のCRUDと既存モックE2E全8本も成功。DBが0件・対象プロセスが残っていないことを確認し、専用コンテナを停止。
- [x] `actionlint` 1.7.12、`bash -n`、`git diff --check` が成功。
- [ ] push後、新しい `e2e` のUbuntu amd64での実行と `e2e-results` artifact保存を確認し、複数回の結果から通常CIへの項目拡張・必須化を判断する。

初回の拡張実行では項目6で編集画面の日付欄待ちが15秒タイムアウトしました。日付ケースのログと、別ブラウザcontextの失敗画面撮影を追加し、項目6単独・全項目の再実行は成功しましたが、初回失敗の原因は未特定です。このため通常CIは項目1から開始し、拡張実行の安定性は継続確認します。Linuxの画面幅検証は実機スマートフォンの検証ではありません。

### backendの検証

backendジョブは `backend/` で、DSNの空チェック → `go mod download` → `gofmt -l .` の結果が空であることの検査 → `go vet ./...` → `go test -v ./... -count=1` → `go build ./...` を順に実行します。整形は検査のみで、自動修正しません。検査の非0終了はそのままジョブの失敗になります。

MySQL 8.4はジョブ専用のサービスコンテナです。DBは `receipt_ci`、接続先はランナーから `127.0.0.1:3306`。CI専用のダミー認証情報を使用し、開発DBや実設定の.envは使いません。TCP接続・認証・対象DBへの `SELECT 1` をhealth checkで確認します（間隔10秒、タイムアウト5秒、12回、起動猶予30秒）。サービスが起動しない、またはhealthyにならない場合はジョブを開始できず失敗します。

`RECEIPT_TEST_MYSQL_DSN` はジョブで明示し、未設定による統合テストのスキップを防ぎます。統合テストは単一接続の一時テーブルにマイグレーションを適用するため、別途 `make migrate-up` は不要です。Actionsログの `TestReceiptMySQLIntegration` のPASSを確認してください。Go APIプロセスは起動しません。

2026-11-11のローカル検証（Go 1.26.3、専用MySQL 8.4.11）:

- 依存取得・整形検査・静的検査・全テスト・ビルドが成功。`TestReceiptMySQLIntegration` はSKIPせずPASS。
- 誤ったダミーパスワードと専用DB停止の両方で、CIと同じ `go test -v ./... -count=1` が終了コード1。
- 別の一時コンテナに無効なMySQL起動オプションを渡すと終了コード1。これはローカルの起動失敗確認であり、GitHubランナーでのサービス起動失敗検証は未実施。
- CIから取り出したコマンドで、空DSNと未整形Goファイルを終了コード1として検出。
- `actionlint` 1.7.12、Ruby/PsychのYAML読み込み、`git diff --check` が成功。
- ローカルのビルドはPATH上のGitの実行形式エラーを避けるため `/usr/bin/git` を使用。CIのコマンドは変更していません。

backendのGitHub Actions上での成功に加え、2026-11-13に故意のテスト失敗の検出と修正後の復旧も確認しました。下記の実行記録を参照してください。

### ローカル確認・GitHub上の動作確認（2026-11-12）

検証対象は `84648784`、PR #17のマージコミットは `32f164e5` です。ローカル文書 `local_docs/ci-tasks.md` 第5節は、2026-11-13の失敗・復旧検証を含めて全10項目にチェック済みです。

- [x] 実設定を含まない一時コピーでfrontendの `npm ci`・lint・単体テスト34件・本番ビルド・動的描画検査が成功。Node.js 24.11.0、npm 11.6.1。
- [x] Goの依存取得・整形検査・静的検査・全テスト・ビルドが成功。専用MySQLで `TestReceiptMySQLIntegration` がSKIPせずPASS。検証用コンテナは停止済み。
- [x] YAML構文読み込みと `git diff --check` が成功。
- [x] 同じ対象コミットの[push](https://github.com/yuto0503/receipt-manager-app/actions/runs/42919425262)・[PR](https://github.com/yuto0503/receipt-manager-app/actions/runs/42919628129)のCI成功を確認。
- [x] [PR #17](https://github.com/yuto0503/receipt-manager-app/pull/17)を `develop` へマージし、[導入後のpush CI](https://github.com/yuto0503/receipt-manager-app/actions/runs/43115419486)の成功を確認。
- [x] デフォルトブランチへ導入後、[手動起動](https://github.com/yuto0503/receipt-manager-app/actions/runs/43115473320)も成功することを確認する。

`npm ci` は成功しましたが、依存監査は17件（moderate 8、high 8、critical 1）を報告しました。依存の修正は今回の検証に含めていません。

設定仕様: [setup-goのキャッシュ](https://github.com/actions/setup-go#caching-dependency-files-and-build-outputs)、[GitHubのサービスコンテナ](https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers)。

### CIの失敗・復旧検証（2026-11-13）

検証ブランチ `verify/ci-failure-recovery-20261113` と [Draft PR #19](https://github.com/yuto0503/receipt-manager-app/pull/19) を使用しました。CI設定は変更せず、次の2つのテストを一時追加しました。

- frontend: `frontend/tests/ci-failure-probe.test.mjs` の `assert.fail()`。`Unit tests` で `CI_FAILURE_PROBE_FRONTEND` と終了コード1を確認（既存34件は成功、検証用1件だけ失敗）。
- backend: `backend/internal/handler/ci_failure_probe_test.go` の `TestCIFailureProbe` に `t.Fatal()`。`Unit and MySQL integration tests` で `CI_FAILURE_PROBE_BACKEND` と終了コード1を確認。MySQL統合テスト自体はPASS。

| 対象コミット | push実行 | PR実行 | frontend / backend |
| --- | --- | --- | --- |
| 失敗用 `b90037b3` | [実行記録](https://github.com/yuto0503/receipt-manager-app/actions/runs/43323420325) | [実行記録](https://github.com/yuto0503/receipt-manager-app/actions/runs/43323478031) | 両方failure。失敗後のBuildはskip |
| 修正後 `ad2ac3d7` | [実行記録](https://github.com/yuto0503/receipt-manager-app/actions/runs/43323739081) | [実行記録](https://github.com/yuto0503/receipt-manager-app/actions/runs/43323746277) | 両方success。frontend 34件成功、MySQL統合テストPASS、ビルド成功 |

修正は通常の追加コミットで検証用2ファイルを削除し、同じブランチへ再pushしました。`git diff --exit-code 32f164e551a2676f30ca41993ad94660b9da64f1 HEAD` が終了コード0となり、修正後のファイル内容が検証開始前のdevelopと一致することを確認済みです。PR #19は `closed`・`merged: false` を確認し、失敗用変更はdevelopへ取り込んでいません。CIがテストの非0終了を検出することと、修正コミットで正常に戻ることをそれぞれ検証しました。lint・ビルド自体の故意の失敗やマージ保護ルールの検証は今回の範囲外です。

### CI成功をマージ条件にする（2026-11-18）

GitHubの [develop - required CI](https://github.com/yuto0503/receipt-manager-app/rules/27504634) をActiveで設定しています。CIのYAMLは検査を実行する設定、Rulesetは検査が通るまでマージを禁止する設定です。[設定の記録](.github/rulesets/develop.json) はGitHubへ送信したJSONであり、ファイルの編集だけではGitHubの設定は更新されません。

| 設定 | 内容 |
| --- | --- |
| 対象 | `refs/heads/develop` |
| 必須チェック | `frontend` と `backend`。実行元はGitHub Actions（App ID `15368`）に限定 |
| 最新変更への追従 | 必須。developが進んだ場合は作業ブランチに取り込み、CIを再実行する |
| PR | 必須。承認レビューは0件（自分のPRを自分で承認できないため） |
| バイパス | なし。管理者も適用対象。設定自体を編集する管理権限は別 |
| 履歴の保護 | force pushとブランチ削除を禁止 |

設定前にREST/GraphQL APIで既存のRulesetとブランチ保護がともに0件、リポジトリがpublic、操作アカウントにadmin権限があることを確認しました。契約プラン名はAPIで取得できませんでしたが、公開リポジトリではFreeでも保護機能が利用でき、実際にActiveルールの作成・取得が成功しています。[GitHubの利用条件](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)

2026-11-18時点の `main` は初期コミット `851d14fa`（READMEのみ）でCIがなく、保護対象外でした。2026-11-24にCIとアプリコードをPRで取り込み、main向けPRとmainのpushで両チェックが成功してから、同様の保護を有効にしました。詳細は下記「mainへのCI導入と保護」を参照してください。チェックが存在しない状態で必須化するとマージが待機し続けるため、CI導入と成功確認を先に行います。

検証には [PR #21](https://github.com/yuto0503/receipt-manager-app/pull/21) を使用し、以前の失敗・復旧コミットを専用ブランチ `verify/merge-protection-20261118` で再利用しました。

| 状態 | push CI | PR CI | PRの判定 |
| --- | --- | --- | --- |
| 故意の失敗 `b90037b3` | [両ジョブfailure](https://github.com/yuto0503/receipt-manager-app/actions/runs/44196057775) | [両ジョブfailure](https://github.com/yuto0503/receipt-manager-app/actions/runs/44196078250) | `BLOCKED` |
| 修正後 `ad2ac3d7` | [両ジョブsuccess](https://github.com/yuto0503/receipt-manager-app/actions/runs/44197246892) | [両ジョブsuccess](https://github.com/yuto0503/receipt-manager-app/actions/runs/44197255253) | `CLEAN` |

PRはDraftではなく、両時点とも競合なし（`mergeable: MERGEABLE`）。`gh pr checks --required` でfrontend/backendが必須として認識されていることと、失敗ログの `CI_FAILURE_PROBE_FRONTEND` / `CI_FAILURE_PROBE_BACKEND` を確認しました。修正後はfrontend 34テストとMySQL統合テストがPASS。マージAPIは呼び出さず、GitHubのマージ可否判定で確認しました。PRはマージせずクローズ済みで、developは `32f164e5` のままです。設定JSONとGitHubから再取得した値の一致、および `git diff --check` も確認しました。

### mainへのCI導入と保護（2026-11-24）

[PR #22](https://github.com/yuto0503/receipt-manager-app/pull/22) で、CI成功済みのdevelop `32f164e5` をmainへ取り込みました。マージコミットは `28a98680ad573598fe7d0e0c403cb463de8e2f9b` です。

- [main向けPRのCI](https://github.com/yuto0503/receipt-manager-app/actions/runs/45283817156) と [mainへのpush CI](https://github.com/yuto0503/receipt-manager-app/actions/runs/45284456249) のfrontend/backendがともに成功。両実行でfrontend 34件、MySQL統合テストのPASS、ビルド成功を確認しました。
- 成功確認後、[main - required CI](https://github.com/yuto0503/receipt-manager-app/rules/27944544) をActiveで作成しました。対象は `refs/heads/main` のみで、[設定記録](.github/rulesets/main.json) は既存developルールの実際の設定を基にしています。
- GitHub Actions（App ID `15368`）のfrontend/backend成功、最新mainへの追従、PR経由を必須とし、force pushと削除を禁止しています。レビュー承認は0件、管理者を含むバイパスはありません。
- GitHubから再取得した設定とJSONの一致、mainの `protected: true`、mainに適用される4ルール、操作アカウントの `current_user_can_bypass: never` を確認しました。既存developルールは変更されていません。main用の故意のCI失敗によるマージ拒否検証は今回再実施していません。

今後は作業PRをdevelopへ取り込み、リリース対象をdevelopからmainへのPRで反映します。両ブランチとも必須CI成功後にマージします。mainが先に進んだ場合はマージ先の変更を取り込み、CIを再実行してください。デフォルトブランチはdevelopです。設定JSONは適用内容の記録であり、編集だけではGitHubに反映されません。

## 技術スタック

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- Go
- Echo
- mySQL

### Infrastructure

- Docker
- Docker Compose

---

# 開発方針

小さな機能から実装し、動作確認をしながら段階的に機能を追加していきます。

各機能は以下の流れで開発します。

1. DB設計
2. API設計
3. Backend実装
4. Frontend実装
5. 動作確認
6. リファクタリング
7. テスト

---

# 開発ロードマップ

## Phase 1 環境構築

- [ ] Docker環境構築
- [ ] Frontend構築
- [ ] Backend構築
- [ ] PostgreSQL接続
- [ ] Docker Compose設定

---

## Phase 2 レシート一覧取得

### Database

- [ ] receiptsテーブル作成

### Backend

- [ ] GET /receipts API
- [ ] Repository実装
- [ ] Service実装
- [ ] Handler実装

### Frontend

- [ ] API呼び出し
- [ ] レシート一覧画面
- [ ] レシートカードコンポーネント

---

## Phase 3 レシート登録

### Backend

- [ ] POST /receipts API
- [ ] バリデーション

### Frontend

- [ ] 登録画面
- [ ] フォーム作成
- [ ] API送信

---

## Phase 4 レシート詳細

### Backend

- [ ] GET /receipts/:id

### Frontend

- [ ] 詳細画面

---

## Phase 5 レシート編集

### Backend

- [ ] PUT /receipts/:id

### Frontend

- [ ] 編集画面
- [ ] 更新フォーム

---

## Phase 6 レシート削除

### Backend

- [x] DELETE /receipts/:id

### Frontend

- [ ] 削除ボタン
- [ ] 削除確認ダイアログ

---

## Phase 7 検索機能

### Backend

- [ ] 店名検索
- [ ] カテゴリ検索
- [ ] 日付検索

### Frontend

- [ ] 検索フォーム
- [ ] フィルター

---

## Phase 8 ページネーション

### Backend

- [ ] limit
- [ ] offset

### Frontend

- [ ] ページネーション

---

## Phase 9 グラフ表示

### Backend

- [ ] 集計API

### Frontend

- [ ] 月別支出
- [ ] カテゴリ別円グラフ

---

## Phase 10 OCR

### Backend

- [ ] 画像アップロード
- [ ] OCR連携

### Frontend

- [ ] アップロード画面

---

## Phase 11 AI分析

- [ ] 支出分析
- [ ] 節約アドバイス
- [ ] 月次レポート

---

# ディレクトリ構成

## Frontend

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # / → /receipts
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── receipts/
│   │   │   ├── page.tsx             # 一覧
│   │   │   ├── new/page.tsx         # 登録
│   │   │   ├── [id]/page.tsx        # 詳細・削除
│   │   │   ├── [id]/edit/page.tsx   # 編集
│   │   │   ├── loading.tsx
│   │   │   ├── error.tsx
│   │   │   └── not-found.tsx
│   │   └── api/receipts/
│   │       ├── route.ts             # POSTの中継
│   │       └── [id]/route.ts        # PUT・DELETEの中継
│   ├── components/                 # 共通フォーム・一覧・削除確認・エラー
│   ├── lib/                        # API通信・入力検証
│   └── types/                      # レシートの型
├── tests/                          # 単体・モック画面・実DB受け入れテスト
└── public/
```

フロントエンドの一覧・登録・詳細・編集・削除画面を実装しています。画面URL、接続設定、起動・確認手順は [frontend/README.md](frontend/README.md) を参照してください。上記ロードマップのチェック状態は過去の記録を含みます。

## Backend

```
backend/
├── cmd/
├── internal/
│   ├── handler/
│   ├── service/
│   ├── repository/
│   ├── model/
│   ├── router/
│   └── database/
└── migrations/
```

---

# API一覧

| Method | Endpoint      | 内容     |
| ------ | ------------- | -------- |
| GET    | /receipts     | 一覧取得 |
| GET    | /receipts/:id | 詳細取得 |
| POST   | /receipts     | 登録     |
| PUT    | /receipts/:id | 更新     |
| DELETE | /receipts/:id | 削除     |

---

## 一覧取得APIのレスポンス

`GET /receipts` は正常時にHTTP 200とJSON配列を返します。0件の場合は `[]`、1件以上の場合はレシートの配列です。MySQL統合テストで0件・1件・複数件のステータスとレスポンス内容を確認しています。

## 削除APIのレスポンス

`DELETE /receipts/:id` は指定したレシートを物理削除し、成功時にHTTP 204（レスポンスボディなし）を返します。不正なID・0・負数は400、存在しないIDは404、内部エラーは500です。削除後の1件取得と同じIDへの再削除も404を返します。

MySQL統合テストでは対象行だけが削除され、他の行が変わらないことと、削除後の一覧・1件取得・再削除を確認します。

## 登録・更新APIの入力ルール

`PUT /receipts/:id` の更新対象は必ずURLの `id` で決定します。JSON本文の `id` は省略可能で、URLと異なる整数（別の実在するレシートのIDを含む）でも無視します。0・負数・nullも更新対象に影響しません。URLのIDが存在しなければ404を返し、本文のIDへの更新は行いません。本文の `id` が文字列・小数など整数として読み取れない型・値の場合は、従来どおり400を返します。

`POST /receipts` と `PUT /receipts/:id` に共通で適用します。

| 項目 | 文字数上限 |
| --- | --- |
| 店名（`store_name`） | 255文字 |
| カテゴリ（`category`） | 100文字 |
| メモ（`memo`） | 2,000文字 |

店名・カテゴリはDBのVARCHAR定義に合わせ、メモは詳細な補足を記載できる長さとしています。Unicodeコードポイント単位で数え、日本語も1文字として扱います。結合文字や複数のコードポイントで構成される絵文字は、見た目の1文字が複数文字として数えられる場合があります。空白・改行も文字数に含めます。

上限を超える入力はDB処理前に400で拒否し、`{"message":"店名は255文字以内で入力してください。"}` のように理由を返します。

店名は必須です。未指定・null・空文字・空白のみ（半角／全角スペース、タブ、改行など）の入力は、登録・更新ともDB処理前に400と `{"message":"店名を入力してください。空白のみの入力はできません。"}` を返します。空白判定には `strings.TrimSpace` を使い、入力された店名自体は変更しません。

金額（`price`）は登録・更新とも必須で、**0〜2,147,483,647円の整数**を受け付けます。0円は許可します。上限はDBの符号付きINT型に合わせています。JSONの数値で指定し、未指定・null・負数・上限超過・小数・文字列・真偽値などはDB処理前に400と金額のエラーメッセージを返します。更新時も省略はできません。

購入日（`purchase_date`）は登録・更新とも必須です。JSON文字列で **`YYYY-MM-DDTHH:mm:ssZ` または `YYYY-MM-DDTHH:mm:ss±HH:mm`** を指定します（RFC 3339形式。例：`2026-09-21T00:00:00+09:00`、`2026-09-21T00:00:00Z`）。秒の後にはドットと1〜9桁の小数秒も指定できます。年はDBのDATE型に合わせて1000〜9999年とします。

未指定・null・空文字・空白のみは400と `{"message":"購入日を指定してください。"}` を返します。存在しない日付、日付だけの `2026-09-21`、スラッシュ区切り、タイムゾーンなし、前後の空白、文字列以外の値はDB処理前に400と形式を説明するエラーメッセージを返します。更新時も省略できません。保存先はDATE型のため、時刻は保存されません。

カテゴリ（`category`）は登録・更新とも必須の文字列で、100文字以内の自由入力です。未指定・null・空文字・空白のみはDB処理前に400と `{"message":"カテゴリを入力してください。空白のみの入力はできません。"}` を返します。店名と同様に `strings.TrimSpace` で空白を判定し、入力値自体は変更しません。固定のカテゴリ一覧による制限はありません。

メモ（`memo`）は登録・更新とも任意の文字列で、2,000文字以内です。未指定・nullは空文字として扱います。空文字・空白のみ・改行も許可し、入力文字列をそのまま保持します。更新時に省略またはnullを指定すると、既存のメモは空文字に置き換わります。

店名・カテゴリ・メモに数値・真偽値・配列・オブジェクトを指定すると、400と `{"message":"カテゴリは文字列で入力してください。"}` のような項目別メッセージを返します。金額・購入日は文字数制限の対象外です。

登録・更新は共通の `bindReceipt()` と `Receipt.Validate()` を通して、上記ルールをDB処理前に適用します。

### 不正なリクエストの応答

登録・更新の本文は、`Content-Type: application/json`（`charset=utf-8`付きも可）で、JSONオブジェクトを1つ送信します。不正な入力は共通してHTTP 400と `{"message":"理由"}` を返します。複数の不備がある場合は、最初に検出した理由を1件返します。

| 不備 | メッセージ例 |
| --- | --- |
| 本文が空・空白のみ | リクエスト本文にJSONオブジェクトを指定してください。 |
| JSONの構文不正 | JSONの形式が不正です。括弧・カンマ・引用符を確認してください。 |
| 本文がnull・配列・文字列・数値・真偽値 | リクエスト本文はJSONオブジェクト（{...}）で指定してください。 |
| 複数のJSONや末尾の余分なデータ | リクエスト本文にはJSONオブジェクトを1つだけ指定してください。末尾の余分なデータを削除してください。 |
| Content-Typeの未指定・不正 | Content-Typeをapplication/jsonにして送信してください。 |
| 各項目の必須・型・範囲・文字数・日付形式の違反 | 上記の項目別メッセージ |

JSONの前後の空白・改行は許可します。不正な入力はService・DB処理へ渡しません。DB処理で発生する内部エラーは引き続き500として区別します。


---

# 今後追加予定

- ユーザー認証
- CSV出力
- OCR
- AI分析
- グラフ表示
- ダークモード
- レスポンシブ対応

---

# 開発ルール

- Commitは機能単位で行う
- Featureブランチで開発する
- API実装後にFrontendを実装する
- 実装後は必ず動作確認する
- リファクタリング後にCommitする

## 登録・更新の実DB統合テスト

通常の `cd backend && go test ./...` では単体テストを実行します。MySQL統合テストは `RECEIPT_TEST_MYSQL_DSN` を指定した場合に実行し、未指定時はスキップします。

```sh
docker compose up -d mysql
cd backend
# ローカル開発用MySQLの接続情報を指定
RECEIPT_TEST_MYSQL_DSN='root:password@tcp(127.0.0.1:3306)/receipt_app' go test ./... -count=1
```

`TestReceiptMySQLIntegration` は接続専用の一時 `receipts` テーブルにmigrationを適用し、実際のRouter・Handler・Service・Repositoryを通して検証します。既存テーブルのデータは変更せず、一時テーブルは接続終了時に削除されます。接続先には一時テーブル作成とmigration適用に必要な権限が必要です。

- 正常な登録201・更新200、保存内容・件数・他のレシートへの影響を確認。金額・文字数の境界値、メモの省略／null、空白・改行の保持も含みます。
- 不正入力は登録・更新それぞれで400とエラーメッセージを確認し、処理前後の全行（作成・更新日時を含む）が一致することを検証します。

更新テストでは本文の `id` の省略・一致・不一致（別の実在するレシート／存在しないID）・0・負数・nullを検証し、URLで指定した行だけが更新されることを確認します。URLのIDが存在せず、本文のIDだけが実在する場合も、404となり全行が変わらないことを確認します。内容変更の更新と同一内容の更新はともに200、対象なしは404になることも検証します。同一内容の更新では保存内容と作成・更新日時が変わらないことを確認します。MySQLの `clientFoundRows` は無効にして検証しています。
