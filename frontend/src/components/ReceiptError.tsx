"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
export default function ReceiptError({ message }: { message: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <section className="panel space-y-4">
      <h1>レシートを表示できません</h1>
      <p role="alert">{message}</p>
      <div className="actions">
        <button disabled={pending} onClick={() => startTransition(() => router.refresh())}>
          {pending ? "再試行中…" : "再試行"}
        </button>
        <Link href="/receipts">一覧へ戻る</Link>
      </div>
      {pending && <p role="status">レシートを読み直しています…</p>}
    </section>
  );
}
