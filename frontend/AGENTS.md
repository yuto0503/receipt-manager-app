<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 画面と通信

- CIのfrontendジョブはNode.js 24で `npm ci`、`npm run format:check`、`npm run lint`、`npm run typecheck`、`node --test tests/*.test.mjs`、`npm run build`、`node tests/check-build.mjs`、`npx playwright install --with-deps chromium`、`npm run test:e2e` を順に実行します。これらの検査にはGo API・MySQL・実設定の.envは不要です。
- `npm run test:e2e` は本番ビルド後に実行します。Playwrightが専用モックAPI（127.0.0.1:18080）とNext.js（127.0.0.1:3100）を起動・待機・終了し、既存サーバーは再利用しません。共有データと障害状態があるため、8本のモック向けテストを1ワーカーで順番に実行し、失敗時は停止します。実Go API・MySQL向けの受け入れテストは含めないでください。
- E2EのHTMLレポート・ログ・取得できた画像は `playwright-report/` と `test-results/` に出力し、CIでは7日間保存します。生成物はGit・ESLint・Prettierの対象外です。
- 実Go API・専用MySQLを通す独立した `e2e` ジョブもあります。`receipt-acceptance.e2e.mjs` をNode.jsから順次実行する構成で、モック用の `npm run test:e2e` とは別です。画像は `artifactPath()` と `RECEIPT_E2E_OUTPUT_DIR` を使い、OS固有の一時ディレクトリを直書きしないでください。`playwright` と `@playwright/test` は同じ固定バージョンを保ちます。
- コード・テスト・設定の整形は `npm run format`、整形漏れの検査は `npm run format:check` を使います。生成物・lockfile・実設定・Markdown・静的アセットは `.prettierignore` で除外します。
- `npm run typecheck` は `next typegen && tsc --noEmit` です。クリーンな環境でもルート型を検査できるよう、型生成を省略しないでください。本番ビルド内の型検査も維持します。
- 一覧ページはAPI取得のtry/catchより前に `await connection()` を呼び、実行時に描画します。接続先未設定時のエラー画面を静的生成しないため、ビルド後に `node tests/check-build.mjs` で確認してください。

- ページの初期取得はServer Componentから `src/lib/receipts.ts` を使います。フォーム・削除確認はClient Componentです。
- 登録・更新・削除は `src/app/api/receipts/` のRoute Handlerを通します。Go APIの接続先はサーバー専用の `SERVER_API_BASE_URL` に集約してください。
- 中継先は `POST /receipts` と `PUT・DELETE /receipts/:id` に限定し、リダイレクトを追跡しないでください。中継の回帰テストはNode.js 24で `node --test tests/receipt-proxy.test.mjs`。
- Go API通信・`ApiError` は `src/lib/api.ts` に集約します。`server-only` を維持し、Client Componentや共有の型・入力検証から取り込まないでください。通信の回帰テストはNode.js 24で `node --test tests/api.test.mjs`。
- ブラウザの保存・削除は `src/lib/receipt-client.ts` に集約します。HTTPステータスと失敗種別を保持し、APIのmessageはテキスト表示、500系詳細は非表示にしてください。回帰テストは `node --test tests/receipt-client.test.mjs tests/receipts.test.mjs`。
- 実設定の `.env`・`.env.*` は追跡せず、共有する設定は `.env.example` のダミー値のみとします。
- 共通入力検証は `src/lib/receipt-input.ts`。購入日は暦日として扱い、表示時にタイムゾーン変換しないでください。
- 入力検証の回帰テストはNode.js 24で `node --test tests/receipt-input.test.mjs`。画面テストの起動手順は `README.md` を参照し、必ずテスト専用APIに接続してください。
- 実Go API・MySQLの受け入れ検証はルートの `ACCEPTANCE.md` に従い、独立した空DBで `node tests/receipt-acceptance.e2e.mjs <項目番号>` を実行してください。モックAPI向けテストと混同せず、作成したIDだけを削除してください。障害再現の `7-server-error`・`7-offline` は専用環境で実施し、記載の復旧手順まで行ってください。
