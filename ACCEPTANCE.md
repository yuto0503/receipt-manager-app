# 10. 動作確認と完了判定

確認日: 2026-11-07。開発用の架空データのみ使用する。削除対象は検証で作成したIDに限定する。
既存の個人データ・DBボリュームは使用しない。

- [x] 1. フロント・API・MySQLを起動し、ブラウザから一覧→登録→詳細→編集→削除→一覧の一連の操作を確認する。
- [x] 2. 再読み込み・URL直接入力・ブラウザの戻る／進むでも画面を表示でき、保存・削除後に古いデータが残らないことを確認する。
- [x] 3. 一覧0件・1件・複数件、長い店名・カテゴリ、空メモ・複数行メモを確認する。
- [x] 4. 登録・編集の両方で必須項目の空欄・空白のみ、金額0・上限・負数・小数・上限超過を確認する。
- [x] 5. 文字数の上限ちょうど・超過、日本語・絵文字を確認する。
- [x] 6. 購入日の月末・年末・うるう日・年の上下限・不正日付と、タイムゾーンによる日付ずれを確認する。
- [x] 7. 不正IDの400、対象なしの404、APIの500、API停止時の通信失敗、送信中の二重操作を確認する。
- [ ] 8. スマートフォン幅・PC幅、キーボードのみの操作、ラベル・エラー・フォーカス・文字の読みやすさを確認する。
- [ ] 9. 入力検証や日付変換など回帰リスクのある処理には必要な自動テストを追加する。新たにテスト手段を導入した場合は実行コマンドを記録する。
- [ ] 10. `cd frontend && npm run lint` を実行し、成功することを確認する。
- [ ] 11. `cd frontend && npm run build` を実行し、成功することを確認する。
- [ ] 12. ブラウザのコンソール・ネットワークで、Reactの警告・未処理エラー・CORSエラーがないことを確認する。
- [ ] 13. 起動手順・環境変数・実装済み画面を関連READMEへ反映する。既存の誤ったフロント構成例も、実装に合わせて `frontend/src/` 配下へ修正する。
- [ ] 14. 本書に確認日・実行コマンド・結果・未実施事項を記録する。未実施の項目はチェックせず、理由を残す。

## 検証環境とコマンド

Node.js 24.11.0 / Next.js 16.2.10 / Go 1.26.3 / MySQL 8.4 / Playwright + Chrome。
以下はローカル専用のダミー認証情報。既存の `.env` は変更しない。

```sh
docker run -d --name receipt-acceptance-mysql -p 127.0.0.1:13306:3306 --tmpfs /var/lib/mysql -e MYSQL_ROOT_PASSWORD=verification -e MYSQL_DATABASE=receipt_acceptance mysql:8.4
cat backend/migrations/000001_create_receipts.up.sql backend/migrations/000002_receipts_id_auto_increment.up.sql backend/migrations/000003_receipts_timestamps.up.sql | docker exec -i -e MYSQL_PWD=verification receipt-acceptance-mysql mysql -uroot receipt_acceptance
# backend/ で別ターミナルから起動
DB_USER=root DB_PASSWORD=verification DB_HOST=127.0.0.1 DB_PORT=13306 DB_NAME=receipt_acceptance go run ./cmd/api
# frontend/ でビルドし、別ターミナルから起動
npm run build
SERVER_API_BASE_URL=http://127.0.0.1:8080 npm run start -- --hostname 127.0.0.1 --port 3100
```

画面検証は `frontend/` で実行する。`PLAYWRIGHT_MODULE` は既存Playwrightの `index.mjs` の絶対パスを指定（通常インストール済みなら不要）。

```sh
export PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs
export PLAYWRIGHT_CHANNEL=chrome
export RECEIPT_UI_TEST_URL=http://127.0.0.1:3100
export RECEIPT_TEST_API_URL=http://127.0.0.1:8080
export RECEIPT_ACCEPTANCE_ISOLATED=1
node tests/receipt-acceptance.e2e.mjs 1
```

## 項目別の結果

未実行の項目は上のチェックを未完了のまま維持する。

### 1. 実DBでの一連の操作

`node tests/receipt-acceptance.e2e.mjs 1` 成功。一覧→登録→詳細→編集→削除→一覧をChromeで操作し、Go API経由でMySQLへの保存・更新・削除と削除後404を確認。テスト終了後のDBは0件。

### 2. URL・再読み込み・履歴

`node tests/receipt-acceptance.e2e.mjs 2` 成功。一覧・登録・詳細・編集への直接アクセスと再読み込み、戻る／進む、更新後の編集値・一覧、削除後の履歴で対象なし表示を確認。初回はテスト側の遷移待ち不足で失敗し、待機を追加して再実行成功。

### 3. 件数・長文・メモ

`node tests/receipt-acceptance.e2e.mjs 3` 成功。実DBの0件・1件・2件、255文字の店名・100文字のカテゴリ、空メモ・3行の日本語と絵文字メモを確認。320px・1280pxの一覧で横方向にはみ出さず、詳細は改行を保持。

### 4. 必須項目・金額

`node tests/receipt-acceptance.e2e.mjs 4` 成功。登録・編集の双方で必須空欄、店名・カテゴリ・金額の空白、負数・小数・上限超過を拒否し、最初のエラーへフォーカス。リクエスト未送信・DB不変を確認。0円・2,147,483,647円は保存成功。日付の空白はdate入力が空欄に正規化するため、空欄として確認。

### 5. 文字数・日本語・絵文字

`node tests/receipt-acceptance.e2e.mjs 5` 成功。登録・編集で日本語／絵文字の店名255・カテゴリ100・メモ2000文字を保存し、実DBからの取得と編集欄で一致。各上限+1文字は拒否しDB不変。Unicodeコードポイント単位の制約とutf8mb4保存を確認。

### 6. 日付境界・タイムゾーン

`node tests/receipt-acceptance.e2e.mjs 6` 成功。東京・UTC・米国西海岸で登録／編集し、月末・年末・うるう日・1000年・9999年の保存・再読込・編集値が一致。999年・10000年・平年2月29日・4月31日を拒否しDB不変。不正日付はChromeのdate要素が値を受け付けないため、テスト内でtext要素に切り替えてアプリ検証にも渡した。

### 7. HTTPエラー・API停止・二重操作

`node tests/receipt-acceptance.e2e.mjs 7` / `7-server-error` / `7-offline` 成功。GET・PUT・DELETEで不正ID400／対象なし404。登録・編集・削除の二重操作は各1リクエスト。500は専用DBの空テーブルを一時改名して実際のGo APIで発生させ、一覧のエラー表示・登録失敗時の入力保持・内部詳細非表示を確認。APIプロセスを停止し、一覧の通信エラーと登録中継の503を確認後に再起動。

500の再現（ルートから実行、必ず最後に復元）:

```sh
docker exec -e MYSQL_PWD=verification receipt-acceptance-mysql mysql -uroot receipt_acceptance -e 'RENAME TABLE receipts TO receipts_verification_unavailable'
# frontend/: node tests/receipt-acceptance.e2e.mjs 7-server-error
docker exec -e MYSQL_PWD=verification receipt-acceptance-mysql mysql -uroot receipt_acceptance -e 'RENAME TABLE receipts_verification_unavailable TO receipts'
```

停止検証: この検証で起動したAPIを停止し `node tests/receipt-acceptance.e2e.mjs 7-offline` を実行。検証時は `lsof -nP -iTCP:8080 -sTCP:LISTEN` で起動したプロセスを確認して `kill -TERM`、上記起動コマンドで復帰した。既存の別用途APIには実行しない。
