"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel space-y-4">
      <h1>画面を表示できませんでした</h1>
      <p role="alert">時間をおいて再試行してください。</p>
      <div className="actions">
        <button onClick={reset}>再試行</button>
        <Link href="/receipts">一覧へ戻る</Link>
      </div>
    </section>
  );
}
