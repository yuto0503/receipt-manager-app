import Link from "next/link";
import ReceiptList from "@/components/ReceiptList";
import ReceiptError from "@/components/ReceiptError";
import { ApiError, getReceipts } from "@/lib/receipts";

export default async function ReceiptsPage() {
  let receipts;
  try {
    receipts = await getReceipts();
  } catch (error) {
    return (
      <ReceiptError
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
