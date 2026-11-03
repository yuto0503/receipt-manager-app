// 必ずテスト専用APIに接続したNext.jsに対して実行する。
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.RECEIPT_UI_TEST_URL;
if (!base) throw new Error("RECEIPT_UI_TEST_URL を指定してください。");
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL });
const page = await browser.newPage();
try {
  const response = await page.request.get(base, { maxRedirects: 0 });
  assert.equal(response.status(), 307);
  assert.equal(response.headers().location, "/receipts");
  await page.goto(base);
  await page.waitForURL("**/receipts");
  await page.getByRole("heading", { name: "レシート一覧", exact: true }).waitFor();
  for (const [path, heading] of [
    ["/receipts", "レシート一覧"],
    ["/receipts/new", "レシートを登録"],
    ["/receipts/1", "レシート詳細"],
    ["/receipts/1/edit", "レシートを編集"],
  ]) {
    await page.goto(base + path);
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    assert.equal(await page.locator("html").getAttribute("lang"), "ja");
    assert.equal(await page.title(), "レシート管理");
    assert.equal(await page.locator('meta[name="description"]').getAttribute("content"), "日々のレシートを登録・整理するアプリ");
    const nav = page.getByRole("navigation", { name: "メインナビゲーション" });
    assert.equal(await nav.getByRole("link", { name: "レシート管理", exact: true }).getAttribute("href"), "/receipts");
    await nav.getByRole("link", { name: "新規登録", exact: true }).click();
    await page.waitForURL("**/receipts/new");
    await nav.getByRole("link", { name: "一覧", exact: true }).click();
    await page.waitForURL("**/receipts");
  }
  console.log("PASS: 共通レイアウト・ナビゲーション");
} finally {
  await browser.close();
}
