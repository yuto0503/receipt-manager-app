"use client";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import type { Receipt } from "@/types/receipt";

import { deleteReceipt, ReceiptClientError } from "@/lib/receipt-client";

export default function DeleteReceipt({ receipt }: { receipt: Receipt }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const sending = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const confirmationId = useId();
  const [missing, setMissing] = useState(false);
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
      setMissing(error instanceof ReceiptClientError && error.status === 404);
      setMessage(error instanceof ReceiptClientError ? error.message :
        "削除結果を確認できませんでした。通信状態と一覧を確認してください。");
    }
    sending.current = false;
    setPending(false);
  }
  return (
    <section
      className="panel space-y-4"
      aria-label="レシートの削除"
      onKeyDown={(event) => {
        if (event.key === "Escape" && confirming && !pending) {
          setConfirming(false);
          setMessage("");
          trigger.current?.focus();
        }
      }}
    >
      <button
        type="button"
        className="danger"
        ref={trigger}
        aria-expanded={confirming}
        aria-controls={confirming ? confirmationId : undefined}
        onClick={() => {
          setConfirming(!confirming);
          setMessage("");
        }}
        disabled={pending}
      >
        {confirming ? "削除をキャンセル" : "削除する"}
      </button>
      {confirming && (
        <div id={confirmationId} className="space-y-4">
          <p>
            {receipt.store_name}・{receipt.price.toLocaleString("ja-JP")}円・
            {receipt.purchase_date.slice(0, 10)}
            を削除します。この操作は元に戻せません。
          </p>
          <button
            className="danger"
            type="button"
            disabled={pending || missing}
            onClick={remove}
          >
            {pending ? "削除中…" : "削除を実行"}
          </button>
        </div>
      )}
      {missing && <p role="alert">対象のレシートはすでに削除されたか存在しません。<Link href="/receipts">一覧へ戻る</Link></p>}
      {message && !missing && (
        <p role="alert" className="text-red-700">
          {message}
        </p>
      )}
    </section>
  );
}
