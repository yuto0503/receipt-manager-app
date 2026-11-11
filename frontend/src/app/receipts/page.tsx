import Link from "next/link";
import { connection } from "next/server";
import ReceiptList from "@/components/ReceiptList";
import ReceiptError from "@/components/ReceiptError";
import { ApiError } from "@/lib/api";
import { getReceipts } from "@/lib/receipts";

export default async function ReceiptsPage() {
  // API接続先は実行時に評価し、設定不足の画面をビルド時に固定しない。
  await connection();
  let receipts;
  try {
    receipts = await getReceipts();
  } catch (error) {
    return (
      <ReceiptError
        status={error instanceof ApiError ? error.status : undefined}
        message={
          error instanceof ApiError
            ? error.message
            : "一覧の取得に失敗しました。"
        }
      />
    );
  }
  return (
    <>
      <div className="actions mb-6 justify-between">
        <h1>レシート一覧</h1>
        <Link className="button" href="/receipts/new">
          新規登録
        </Link>
      </div>
      <ReceiptList receipts={receipts} />
    </>
  );
}
