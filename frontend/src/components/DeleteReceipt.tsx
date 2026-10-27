"use client";
import { useRef, useState } from "react";
import type { Receipt } from "@/types/receipt";

import { deleteReceipt, ReceiptClientError } from "@/lib/receipt-client";

export default function DeleteReceipt({ receipt }: { receipt: Receipt }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const sending = useRef(false);
  async function remove() {
    if (sending.current) return;
    sending.current = true;
    setPending(true);
    setMessage("");
    try {
      await deleteReceipt(receipt.id);
      window.location.assign("/receipts");
      return;
    } catch (error) {
      setMessage(error instanceof ReceiptClientError ? error.message :
        "削除結果を確認できませんでした。通信状態と一覧を確認してください。");
    }
    sending.current = false;
    setPending(false);
  }
  return (
    <section className="panel space-y-4" aria-label="レシートの削除">
      <button
        type="button"
        className="danger"
        aria-expanded={confirming}
        onClick={() => {
          setConfirming(!confirming);
          setMessage("");
        }}
        disabled={pending}
      >
        {confirming ? "削除をキャンセル" : "削除する"}
      </button>
      {confirming && (
        <div className="space-y-4">
          <p>
            {receipt.store_name}・{receipt.price.toLocaleString("ja-JP")}円・
            {receipt.purchase_date.slice(0, 10)}
            を削除します。この操作は元に戻せません。
          </p>
          <button
            className="danger"
            type="button"
            disabled={pending}
            onClick={remove}
          >
            {pending ? "削除中…" : "削除を実行"}
          </button>
        </div>
      )}
      {message && (
        <p role="alert" className="text-red-700">
          {message}
        </p>
      )}
    </section>
  );
}
