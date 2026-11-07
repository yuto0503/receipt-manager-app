<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 画面と通信

- ページの初期取得はServer Componentから `src/lib/receipts.ts` を使います。フォーム・削除確認はClient Componentです。
- 登録・更新・削除は `src/app/api/receipts/` のRoute Handlerを通します。Go APIの接続先はサーバー専用の `SERVER_API_BASE_URL` に集約してください。
- 中継先は `POST /receipts` と `PUT・DELETE /receipts/:id` に限定し、リダイレクトを追跡しないでください。中継の回帰テストはNode.js 24で `node --test tests/receipt-proxy.test.mjs`。
- Go API通信・`ApiError` は `src/lib/api.ts` に集約します。`server-only` を維持し、Client Componentや共有の型・入力検証から取り込まないでください。通信の回帰テストはNode.js 24で `node --test tests/api.test.mjs`。
- ブラウザの保存・削除は `src/lib/receipt-client.ts` に集約します。HTTPステータスと失敗種別を保持し、APIのmessageはテキスト表示、500系詳細は非表示にしてください。回帰テストは `node --test tests/receipt-client.test.mjs tests/receipts.test.mjs`。
- 実設定の `.env`・`.env.*` は追跡せず、共有する設定は `.env.example` のダミー値のみとします。
- 共通入力検証は `src/lib/receipt-input.ts`。購入日は暦日として扱い、表示時にタイムゾーン変換しないでください。
- 入力検証の回帰テストはNode.js 24で `node --test tests/receipt-input.test.mjs`。画面テストの起動手順は `README.md` を参照し、必ずテスト専用APIに接続してください。
