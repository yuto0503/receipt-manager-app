import Link from "next/link";
export default function NotFound() {
  return (
    <section className="panel space-y-4">
      <h1>対象のレシートが見つかりません</h1>
      <p>削除されたか、存在しないレシートです。</p>
      <Link href="/receipts">一覧へ戻る</Link>
    </section>
  );
}
