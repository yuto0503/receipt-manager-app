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

## 検証

実際のGo API・MySQLを使う受け入れ検証は [ACCEPTANCE.md](../ACCEPTANCE.md) を参照してください。専用の空DBで実行し、既存の個人データに接続しないでください。`tests/receipt-acceptance.e2e.mjs` は既存のPlaywright実行環境を使い、項目番号を指定して順番に実行します。

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
