"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
export default function ReceiptError({ message, status }: { message: string; status?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <section className="panel space-y-4">
      <h1>{status === 400 ? "レシートの指定が正しくありません" : "レシートを表示できません"}</h1>
      <p role="alert">{message}</p>
      <div className="actions">
        {status !== 400 && <button disabled={pending} onClick={() => startTransition(() => router.refresh())}>
          {pending ? "再試行中…" : "再試行"}
        </button>}
        <Link href="/receipts">一覧へ戻る</Link>
      </div>
      {pending && <p role="status">レシートを読み直しています…</p>}
    </section>
  );
}
