# receipt-manager-app

レシートの画像をアップロードして家計簿を自動生成するWebアプリ

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

- [ ] DELETE /receipts/:id

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
├── app/
├── components/
├── lib/
├── types/
└── public/
```

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

## 登録・更新APIの入力ルール

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
