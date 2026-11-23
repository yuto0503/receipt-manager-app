import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "レシート管理",
  description: "日々のレシートを登録・整理するアプリ",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <nav
            aria-label="メインナビゲーション"
            className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-5 py-5"
          >
            <Link href="/receipts" className="text-xl font-bold no-underline">
              レシート管理
            </Link>
            <div className="actions">
              <Link href="/receipts">一覧</Link>
              <Link href="/receipts/new">新規登録</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
