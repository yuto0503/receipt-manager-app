"use client";
import Link from "next/link";
import { useTransition } from "react";
export default function ErrorPage({ unstable_retry }: { unstable_retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <section className="panel space-y-4">
      <h1>画面を表示できませんでした</h1>
      <p role="alert">時間をおいて再試行してください。</p>
      <div className="actions">
        <button disabled={pending} onClick={() => startTransition(() => unstable_retry())}>
          {pending ? "再試行中…" : "再試行"}
        </button>
        <Link href="/receipts">一覧へ戻る</Link>
      </div>
      {pending && <p role="status">画面を読み直しています…</p>}
    </section>
  );
}
