import Link from "next/link";
import { notFound } from "next/navigation";
import DeleteReceipt from "@/components/DeleteReceipt";
import ReceiptError from "@/components/ReceiptError";
import { ApiError, getReceipt } from "@/lib/receipts";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let receipt;
  try {
    receipt = await getReceipt(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <ReceiptError
        message={
          error instanceof ApiError ? error.message : "取得に失敗しました。"
        }
      />
    );
  }
  return (
    <>
      <h1 className="mb-6">レシート詳細</h1>
      <dl className="panel space-y-4">
        <div>
          <dt>店名</dt>
          <dd className="text-xl font-bold">{receipt.store_name}</dd>
        </div>
        <div>
          <dt>金額</dt>
          <dd>{receipt.price.toLocaleString("ja-JP")}円</dd>
        </div>
        <div>
          <dt>購入日</dt>
          <dd>{receipt.purchase_date.slice(0, 10)}</dd>
        </div>
        <div>
          <dt>カテゴリ</dt>
          <dd>{receipt.category}</dd>
        </div>
        <div>
          <dt>メモ</dt>
          <dd className="whitespace-pre-wrap">{receipt.memo || "メモなし"}</dd>
        </div>
      </dl>
      <div className="actions my-6">
        <Link href="/receipts">一覧へ戻る</Link>
        <Link className="button" href={`/receipts/${receipt.id}/edit`}>
          編集する
        </Link>
      </div>
      <DeleteReceipt receipt={receipt} />
    </>
  );
}
