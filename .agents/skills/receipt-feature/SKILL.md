---
name: receipt-feature
description: receipt-manager-appでレシート項目、CRUD、検索などを追加・修正するときに、DB・Go API・Next.js画面の変更箇所と回帰検証を整理する。文書だけの編集やレシート機能と無関係な環境設定には使わない。
---

# レシート機能の追加・修正

このSkill内のコードパス・コマンドはリポジトリルートを基準とする。共通ルールは [作業ガイド](../../../.codex/AGENTS.md)、API契約は [README](../../../README.md) を参照する。フロントエンドを変更する場合は [追加指示](../../../frontend/AGENTS.md) と対象機能のNext.js同梱ドキュメントも読む。

## 変更の入口を決める

依頼された振る舞いについて、入力・保存値・応答・画面表示のどこが変わるかを整理する。以下から該当するコードとテストだけを読み、影響する層を選ぶ。単一層の修正のために全層を書き換える必要はない。

| 変更内容 | 調査・変更の入口 |
| --- | --- |
| 項目・入力制約 | `backend/internal/model/receipt.go`・`receipt_validation.go`、`backend/internal/handler/receipt_request.go`、`frontend/src/types/receipt.ts`、`frontend/src/lib/receipt-input.ts`、`frontend/src/components/ReceiptForm.tsx` |
| 保存・取得条件 | `backend/migrations/`、`backend/internal/repository/receipt_repository.go`、`backend/internal/service/receipt_service.go` |
| エンドポイント・応答 | `backend/internal/router/router.go`、`backend/internal/handler/receipt_handler.go` |
| 一覧・詳細の取得と表示 | `frontend/src/lib/receipts.ts`、`frontend/src/lib/api.ts`、`frontend/src/app/receipts/`、`frontend/src/components/ReceiptList.tsx` |
| 登録・更新・削除の通信 | `frontend/src/lib/receipt-client.ts`、`frontend/src/app/api/receipts/`、`frontend/src/lib/receipt-proxy.ts`、`frontend/src/lib/api.ts` |

## 契約を実装へ通す

- 項目を追加する場合は、既存行の扱い（既定値・NULL可否）、JSONの省略時の扱い、入力制約を先に決める。DB変更が必要なら新しいmigrationを追加し、SQLの取得列・Scan先・書き込み列、Goの型、フロントの型と実行時検証 `isReceipt`、フォームの変換を照合する。型宣言だけを変更すると正常なAPI応答がフロントの実行時検証に拒否されることがある。
- 初期取得はServer Component → `receipts.ts` → `api.ts` → Go API、更新操作はClient Component → `receipt-client.ts` → Route Handler → `receipt-proxy.ts` → `api.ts` → Go APIの経路で追う。通信仕様の修正時は両経路に影響するか確認する。
- 検索・一覧条件の追加時は、現在 `getReceipts()` が購入日降順・同日ID降順へ並べ直す点を確認する。サーバーでソートやページ分割を導入するなら、ページ内だけの並べ替えで順序が不整合にならないよう責務を決める。
- 日付・文字列・金額の変更では、フォーム入力 → JSON → Goの検証 → SQL保存 → 再取得 → 表示の往復で値を照合する。具体的な制約はREADMEと既存テストを基準にする。
- 保存・削除後の表示に関わる変更では、`receipt-proxy.ts` のキャッシュ無効化と画面側の遷移・再読込まで追い、成功応答だけで完了と判断しない。

## 影響に合わせて検証する

共通のlint・build・Go検査は作業ガイドに従う。回帰テストは次の入口から変更に関係するものを選び、振る舞いを変更した場合は必要なケースを補う。

| 変更対象 | テストの入口 |
| --- | --- |
| Goの入力・HTTP契約 | `backend/internal/model/receipt_validation_test.go`、`backend/internal/handler/` と `backend/internal/router/` の該当テスト。`cd backend && go test ./...` |
| SQL・永続化 | `backend/internal/handler/receipt_mysql_integration_test.go`。ルートREADMEのDSN設定手順に従う。未設定によるスキップは実DB検証の成功に含めない |
| フロントの入力・通信・応答検証 | Node.js 24で `cd frontend && node --test tests/*.test.mjs`。小さな変更では該当テストファイルだけを指定できる |
| 画面・フォーム・遷移 | [frontend/README.md](../../../frontend/README.md) のモックAPI起動手順と該当する `tests/receipt-*.e2e.mjs`。共有データを使うため順次実行する |
| DBから画面までの受け入れ確認 | [ACCEPTANCE.md](../../../ACCEPTANCE.md) の独立した検証DBと項目別コマンド。モック画面テストとは区別する |

仕様変更に関係するREADMEを更新する。完了報告では変更した振る舞い、実施した検証、スキップ・未実施を区別し、依頼に対応するチェックリストがあれば検証済みの項目を更新する。
