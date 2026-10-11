import Link from "next/link";
import type { Receipt } from "@/types/receipt";

export default function ReceiptList({ receipts }: { receipts: Receipt[] }) {
  if (receipts.length === 0)
    return (
      <p className="panel">
        まだレシートがありません。新規登録から追加してください。
      </p>
    );
  return (
    <ul className="grid gap-4">
      {receipts.map((receipt) => (
        <li className="panel" key={receipt.id}>
          <Link className="text-lg font-bold" href={`/receipts/${receipt.id}`}>
            {receipt.store_name}
          </Link>
          <p className="mt-2 text-xl">
            {receipt.price.toLocaleString("ja-JP")}円
          </p>
          <p className="mt-2 text-sm">
            {receipt.purchase_date.slice(0, 10)} · {receipt.category}
          </p>
        </li>
      ))}
    </ul>
  );
}
