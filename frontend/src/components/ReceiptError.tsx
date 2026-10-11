"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
export default function ReceiptError({ message }: { message: string }) {
  const router = useRouter();
  return (
    <section className="panel space-y-4">
      <h1>レシートを表示できません</h1>
      <p role="alert">{message}</p>
      <div className="actions">
        <button onClick={() => router.refresh()}>再試行</button>
        <Link href="/receipts">一覧へ戻る</Link>
      </div>
    </section>
  );
}
