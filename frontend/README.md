# レシート管理フロントエンド

Next.js 16.2.10 / React 19.2.4 / Tailwind CSS 4。実装は `src/` 配下です。

## 起動

Go APIとMySQLを起動し、`frontend/.env.local` に接続先を設定します。実設定・認証情報はコミットしないでください。

```dotenv
# ホスト上でNext.jsを動かす場合
SERVER_API_BASE_URL=http://localhost:8080
# Docker Compose内の場合は http://backend:8080
```

```sh
cd frontend
npm ci
npm run dev
```

`http://localhost:3000` を開きます。接続先はサーバー専用です。初期取得はServer ComponentからGo APIへ、登録・更新・削除は同一オリジンの `/api/receipts` 経由で通信します。外部フォントのダウンロードは不要です。

## 画面・遷移

| URL | 内容 |
| --- | --- |
| `/` | `/receipts` へリダイレクト |
| `/receipts` | 一覧、新規登録・詳細へのリンク |
| `/receipts/new` | 登録。保存後は作成した詳細、キャンセルは一覧 |
| `/receipts/[id]` | 詳細・削除確認。編集・一覧へのリンク。削除後は一覧 |
| `/receipts/[id]/edit` | 編集。保存・キャンセル後は対象の詳細 |

各URLへの直接アクセス・再読み込みに対応します。対象なし、不正ID、通信失敗はエラー表示と一覧への導線を用意しています。保存・削除成功後はページを読み直し、最新データを取得します。バックエンドの契約・入力制約はルートのREADMEを参照してください。

## 検証

```sh
cd frontend
npm run lint
npm run build
# Node.js 24で実行。追加パッケージ不要
node --test tests/receipt-input.test.mjs
```

画面の自動テストは実データに接続しないテスト専用APIで実行します。以下を別々のターミナルで起動します。

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
```

直接アクセス・再読み込み・登録・編集・削除・キャンセル・入力エラー・404・不正ID・API異常・モバイル幅を検証します。これは画面とAPI中継のテストです。Go API・MySQLを使う結合確認は別途必要です。
