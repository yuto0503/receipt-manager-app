# レシート管理フロントエンド

Next.js 16.2.10 / React 19.2.4 / Tailwind CSS 4。実装は `src/` 配下です。

## 起動

Go APIとMySQLを起動し、初回のみ `frontend/.env.example` を `frontend/.env.local` にコピーして接続先を設定します。既存の実設定は上書きしないでください。実設定・認証情報はコミットしません。

```dotenv
# ホスト上でNext.jsを動かす場合
SERVER_API_BASE_URL=http://localhost:8080
# Docker Compose内の場合は http://backend:8080
```

```sh
cd frontend
# 初回のみ（既存ファイルは上書きしない）
cp -n .env.example .env.local
npm ci
npm run dev
```

ホスト上では `http://localhost:8080`、Compose内では `http://backend:8080` を設定します。`backend` はCompose内部の名前なので、ブラウザの接続先には使いません。設定変更後はNext.jsを再起動してください。

`http://localhost:3000` を開きます。接続先はサーバー専用です。初期取得はServer ComponentからGo APIへ、登録・更新・削除は同一オリジンの `/api/receipts` 経由で通信します。外部フォントのダウンロードは不要です。

本番ビルドをローカルで確認する場合は `npm run build` の後に `npm run start` を実行します。Go APIの `DB_USER`・`DB_PASSWORD`・`DB_HOST`・`DB_PORT`・`DB_NAME` とMySQLの準備は [ルートREADME](../README.md) を参照してください。個人データを使わずに確認する場合は [専用検証環境](../ACCEPTANCE.md) を使います。

## 画面・遷移

Go APIへの通信は `src/lib/api.ts` の `apiRequest()` に集約しています。`SERVER_API_BASE_URL`、10秒のタイムアウト、キャッシュ無効化、HTTPステータスとJSONエラーの解析を共通化しています。204は本文なしとして扱い、エラー本文がJSONでなくてもHTTPステータスを保持します。500系の内部エラー詳細は利用者に公開しません。

`api.ts`・`receipts.ts`・`receipt-proxy.ts` は `server-only` で保護されています。Client Componentからは取り込まず、ブラウザの更新操作は `/api/receipts` を使用してください。共有の型・入力検証はサーバー専用モジュールに依存させません。

中継は `POST /api/receipts` → `POST /receipts`、`PUT・DELETE /api/receipts/:id` → 同じメソッドの `/receipts/:id` に限定します。IDは1以上の安全な整数を表す数字列のみ許可し、クエリ・本文・メソッド上書きヘッダーで転送先を変更できません。Go APIのリダイレクトも追跡しません。未対応メソッドは405、OPTIONSはNext.jsが応答し、Go APIへ転送しません。成功時は登録201・更新200・削除204（本文なし）を返します。

| URL | 内容 |
| --- | --- |
| `/` | `/receipts` へリダイレクト |
| `/receipts` | 一覧、新規登録・詳細へのリンク |
| `/receipts/new` | 登録。保存後は作成した詳細、キャンセルは一覧 |
| `/receipts/[id]` | 詳細・削除確認。編集・一覧へのリンク。削除後は一覧 |
| `/receipts/[id]/edit` | 編集。保存・キャンセル後は対象の詳細 |

各URLへの直接アクセス・再読み込みに対応します。対象なし、不正ID、通信失敗はエラー表示と一覧への導線を用意しています。保存・削除成功後はページを読み直し、最新データを取得します。バックエンドの契約・入力制約はルートのREADMEを参照してください。

## CIと同じ検証

Node.js 24系を使い、frontendディレクトリで次の順に実行します。

```sh
cd frontend
node --version
npm --version
npm ci
npm run format:check
npm run lint
npm run typecheck
node --test tests/*.test.mjs
npm run build
node tests/check-build.mjs
npx playwright install --with-deps chromium
npm run test:e2e
```

CIはnpmのダウンロードキャッシュだけを利用し、`node_modules`・`.next` は再利用しません。`npm ci` はlockfileとpackage.jsonが不整合なら失敗します。`npm test` スクリプトはありません。

整形にはPrettierを使用します。`npm run format` でコード・テスト・設定を自動整形し、`npm run format:check` で整形漏れだけを検出します。CIではファイルを書き換えず、整形漏れがあれば失敗します。生成物・lockfile・実設定・Markdown・静的アセットは `.prettierignore` で除外します。ESLintには `eslint-config-prettier` を適用し、整形ルールの競合を防ぎます。

`npm run typecheck` は `next typegen && tsc --noEmit` を実行します。Next.jsのルート型と `next-env.d.ts` を先に生成するため、`.next` のない環境でもビルド前に型検査できます。`strict` と本番ビルド内の型検査も維持しています。生成された型ファイルはGit管理対象外です。

各検査を独立したステップで実行し、非0の終了コードをそのままCIの失敗にします。`continue-on-error` や `|| true` で失敗を無視しません。Actionsのfrontendジョブで、失敗したステップ名とログを確認してください。

これらの検証に `.env`・`.env.local`・`SERVER_API_BASE_URL`・Go API・MySQLは不要です。設定なしでの確認は実設定を消さず、Git管理対象ファイルだけを別ディレクトリへコピーして行ってください。一覧ページは `connection()` でリクエスト時に描画し、接続先未設定のエラー画面をビルド結果に固定しません。`check-build.mjs` が一覧の静的生成を検出した場合は非0終了します。

最後の `npm run test:e2e` はPlaywrightが専用モックAPIと本番ビルドのNext.jsを起動し、Chromiumで画面を操作します。CIはubuntu-24.04上のNode.js 24を使用します。既存DockerfileのNode.js 22との整合は後続課題です。

### CIで実行するE2E

`playwright.config.mjs` と `tests/ci-e2e.spec.mjs` で、既存のnavigation・layout・list・form・create・detail・edit・deleteの8本を実行します。登録・編集・削除、入力検証、直接アクセス・再読み込み、404・API異常、モバイル表示などを検査します。対象はブラウザ → Next.js → 専用モックAPIであり、実Go API・MySQLの受け入れ検証は含みません。

モックAPIは `127.0.0.1:18080`、Next.jsは `127.0.0.1:3100` を使います。Playwrightが応答待ちと終了処理を担当し、使用中のポートがあれば失敗します。ローカルでも既存サーバーを再利用しません。Next.jsの接続先とテスト用URLは専用モック環境に固定し、実DBには接続しません。外部の `PLAYWRIGHT_MODULE`・`PLAYWRIGHT_CHANNEL` はこの一括実行では使わず、lockfileに固定したPlaywrightと対応するChromiumを使用します。

テスト間でモックのデータと障害状態を共有するため、1ワーカー・並列実行なし・リトライなしで順番に実行し、最初の失敗で停止します。各スクリプトは150秒、サーバー起動はモック30秒・Next.js60秒でタイムアウトします。スクリプトの非0終了はPlaywright経由でCIを失敗させます。

HTMLレポートは `playwright-report/`、テストのログと取得できたスクリーンショットは `test-results/` に保存します。既存スクリプトが個別にブラウザを起動するため、自動トレース・失敗時の自動スクリーンショットはありません。CIではE2E成功・失敗のどちらでも `frontend-e2e-results` artifactに7日間保存し、サーバーログはActionsの実行ログで確認できます。これらの生成物はGit・ESLint・Prettierの対象外です。

ローカルでブラウザだけを取得する場合は `npx playwright install chromium`、レポートの表示は `npx playwright show-report` を使います。個別スクリプトを手動実行する手順は以下に残しています。

### 実Go API・MySQLのCI検証

独立した `e2e` ジョブでは、専用MySQL 8.4の空DBにupマイグレーションを適用し、実Go APIと本番Next.jsを起動します。`playwright` を直接の開発依存として `@playwright/test` と同じバージョンに固定し、既存の `node tests/receipt-acceptance.e2e.mjs <項目>` というライブラリAPI方式を維持しています。`npm run test:e2e` は引き続きモック専用です。

LinuxでCIと同じ起動管理を再現するには、[ACCEPTANCE.md](../ACCEPTANCE.md) に従って専用の空DBとマイグレーションを用意し、次をリポジトリルートから実行します。Node.js 24・Go・curl・`setsid`・GNU `timeout` が必要です。DBはこの実行専用とし、以下の値はその接続先に合わせてください。

```sh
cd frontend
npm ci
npx playwright install --with-deps chromium
npm run build
cd ../backend
go build -o /tmp/receipt-e2e-api ./cmd/api
cd ..
DB_USER=root DB_PASSWORD=verification DB_HOST=127.0.0.1 DB_PORT=13306 DB_NAME=receipt_acceptance \
SERVER_API_BASE_URL=http://127.0.0.1:8080 \
RECEIPT_UI_TEST_URL=http://127.0.0.1:3100 RECEIPT_TEST_API_URL=http://127.0.0.1:8080 \
RECEIPT_ACCEPTANCE_ISOLATED=1 E2E_API_BINARY=/tmp/receipt-e2e-api \
E2E_STEPS='1' bash .github/scripts/run-e2e.sh
```

まず項目1でCRUDを確認し、`E2E_STEPS='1 2 3 4 5 6 7 8 12'` で全通常項目へ広げます。通常のpush・PRのCIは初期段階として項目1だけを実行し、Actionsの手動実行で `extended_e2e` を有効にすると全通常項目をこの順序で実行します。共有DBなので並列実行はしません。`7-server-error`・`7-offline` はこの起動スクリプトでは拒否し、手動の障害・復旧手順で別途検証します。macOSでは従来の個別起動手順を利用できます。

`RECEIPT_E2E_OUTPUT_DIR` でログ・画像の保存先を変更でき、起動スクリプトの既定値は `frontend/test-results/acceptance/` です。テスト失敗時は可能な範囲で画面画像を取得し、終了時には作成したIDだけを削除してブラウザを閉じます。スクリプトは起動したプロセスグループを終了し、CIはMySQLサービスも破棄します。Actionsの `e2e-results` artifactには実際に出力したログと画像だけを保存します。Linuxのブラウザ検証は実機スマートフォンの検証を兼ねません。

## 検証

実際のGo API・MySQLを使う受け入れ検証は [ACCEPTANCE.md](../ACCEPTANCE.md) を参照してください。専用の空DBで実行し、既存の個人データに接続しないでください。`tests/receipt-acceptance.e2e.mjs` はインストール済みのPlaywrightを使い、項目番号を指定して順番に実行します。

```sh
# ACCEPTANCE.mdの専用環境・環境変数を準備して実行（項目1〜8）
node tests/receipt-acceptance.e2e.mjs 1
# 通常の単体テスト一式（Node.js 24）
node --test tests/*.test.mjs
```

`7-server-error` と `7-offline` は専用環境での障害再現が必要です。通常の項目と一括実行せず、ACCEPTANCE.mdの復旧手順まで実施してください。

```sh
cd frontend
npm run lint
npm run build
# Node.js 24で実行。追加パッケージ不要
node --test tests/receipt-input.test.mjs
node --test tests/api.test.mjs
node --test tests/receipt-proxy.test.mjs
node --test tests/receipt-client.test.mjs
node --test tests/receipts.test.mjs
```

以下の既存画面テストは、実データに接続しないモックAPIで実行します。実DB受け入れテストとは接続先が異なります。以下を別々のターミナルで起動します。

```sh
# frontendディレクトリで実行。データはメモリ内のみ
node tests/mock-api.mjs
```

```sh
SERVER_API_BASE_URL=http://127.0.0.1:18080 npm run start -- --hostname 127.0.0.1 --port 3100
```

```sh
# PlaywrightとChromiumが利用可能な環境で実行
# 外部にインストール済みの場合、PLAYWRIGHT_MODULEにそのindex.mjsの絶対パスを指定
RECEIPT_UI_TEST_URL=http://127.0.0.1:3100 node tests/receipt-navigation.e2e.mjs
# 共通レイアウト・画面状態・モバイル幅・配色
RECEIPT_UI_TEST_URL=http://127.0.0.1:3100 node tests/receipt-layout.e2e.mjs
```

直接アクセス・再読み込み・登録・編集・削除・キャンセル・入力エラー・404・不正ID・API異常・モバイル幅を検証します。これは画面とAPI中継のテストです。Go API・MySQLを使う結合確認は別途必要です。

共通レイアウトのテストは、テスト専用APIの `/__test/state` で応答遅延・500・通信断・空一覧を再現し、最後に通常状態へ戻します。APIの既定URLは `http://127.0.0.1:18080`（`RECEIPT_TEST_API_URL` で変更可）。専用Chromiumがない場合は、インストール済みChromeを `PLAYWRIGHT_CHANNEL=chrome` で利用できます。

画面はライト配色に統一しています。OSがダーク設定でも、背景・文字・日付入力などの標準部品が混在しないよう `color-scheme: light` を指定しています。テーマ切替UIは後続です。

ブラウザの保存処理は `src/lib/receipt-client.ts` に集約し、JSONオブジェクトを送信します。失敗時は `ReceiptClientError.status` にHTTPステータスを保持します。

クライアントの通信失敗は `ReceiptClientError.kind`（http / network / timeout / invalid-response）で区別します。HTTPエラーは本文が不正でもステータスを保持し、通信例外の詳細は表示しません。ブラウザの待機上限は15秒、Go APIへの待機上限は10秒です。

APIのエラー文はReactのテキストとして表示します。空・欠落したメッセージは「保存に失敗しました。」「削除に失敗しました。」で補い、500系の詳細はブラウザ側でも隠します。

一覧・詳細は毎回Go APIを `cache: "no-store"` で取得します。保存・削除成功時には `/receipts` 配下のキャッシュを無効化し、画面を再読込して最新状態に遷移します。

接続先のハードコードや既定値へのフォールバックはありません。`SERVER_API_BASE_URL` の未設定・空白・不正なURLは通信前に503として扱い、設定不足を初期取得画面に表示します。HTTP(S)のURLを指定し、認証情報・クエリ・フラグメントを含めないでください。実際の設定値はエラー表示に含めません。

実設定の `.env`・`.env.*` はリポジトリ共通の `.gitignore` で除外し、設定例の `.env.example` のみ共有します。追跡確認はルートから `git ls-files '*env*'`、除外確認は `git check-ignore frontend/.env.local` で行えます。追跡解除は作業ディレクトリの実設定を削除しません。

## 一覧・フォーム・登録・詳細・編集・削除の回帰確認

上記のテスト専用APIとNext.jsを起動して、以下を順に実行します（同じテストデータを共有するため並列実行しません）。各テストで作成した架空のレシートは終了時に削除します。

```sh
RECEIPT_UI_TEST_URL=http://127.0.0.1:3100 node tests/receipt-list.e2e.mjs
RECEIPT_UI_TEST_URL=http://127.0.0.1:3100 node tests/receipt-form.e2e.mjs
RECEIPT_UI_TEST_URL=http://127.0.0.1:3100 node tests/receipt-create.e2e.mjs
RECEIPT_UI_TEST_URL=http://127.0.0.1:3100 node tests/receipt-detail.e2e.mjs
RECEIPT_UI_TEST_URL=http://127.0.0.1:3100 node tests/receipt-edit.e2e.mjs
RECEIPT_UI_TEST_URL=http://127.0.0.1:3100 node tests/receipt-delete.e2e.mjs
```

`PLAYWRIGHT_MODULE`・`PLAYWRIGHT_CHANNEL` は既存の画面テストと同じ指定方法です。共通フォームでは日本・UTC・米国西海岸のタイムゾーンを検証します。これはモックAPIでの表示・送信確認であり、MySQLの日付保存の結合確認を代替しません。

保存後は詳細URLに `?saved=1` を付け、保存完了の案内を表示します。編集・削除中に対象がなくなった場合は一覧へのリンクを表示します。削除確認はモーダルではなく画面内に展開し、Tabで実行ボタンへ進み、Escapeまたはキャンセルで閉じられます。
