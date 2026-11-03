export default function Loading() {
  return (
    <section className="panel space-y-4" aria-busy="true">
      <h1>レシートを読み込み中</h1>
      <p role="status">レシートを読み込んでいます…</p>
      <p>そのままお待ちいただくか、上のナビゲーションから移動できます。</p>
    </section>
  );
}
