// 必ずテスト専用APIに接続したNext.jsに対して実行する。
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.RECEIPT_UI_TEST_URL;
if (!base) throw new Error("RECEIPT_UI_TEST_URL を指定してください。");
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL });
const page = await browser.newPage();
page.setDefaultTimeout(15000);
const mock = process.env.RECEIPT_TEST_API_URL || "http://127.0.0.1:18080";
const state = (mode, delay = 0) => page.request.post(mock + "/__test/state", { data: { mode, delay } });
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
  await state("normal", 1500);
  await page.goto(base + "/receipts", { waitUntil: "commit" });
  await page.getByRole("status").filter({ hasText: "レシートを読み込んでいます" }).waitFor();
  await page.getByRole("heading", { name: "レシート一覧", exact: true }).waitFor();
  await state("error");
  await page.reload();
  await page.getByRole("main").getByRole("alert").waitFor();
  assert.equal(await page.getByText("internal", { exact: true }).count(), 0);
  await state("normal", 1500);
  await page.getByRole("button", { name: "再試行", exact: true }).click();
  await page.getByRole("button", { name: "再試行中…" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "再試行中…" }).isDisabled(), true);
  await page.getByRole("heading", { name: "レシート一覧", exact: true }).waitFor();
  await state("empty");
  await page.reload();
  await page.getByText("まだレシートがありません。新規登録から追加してください。").waitFor();
  await state("normal");
  for (const path of ["/receipts/9999", "/receipts/9999/edit"]) {
    await page.goto(base + path);
    await page.getByRole("heading", { name: "対象のレシートが見つかりません" }).waitFor();
    await page.getByRole("main").getByRole("link", { name: "一覧へ戻る" }).click();
    await page.waitForURL("**/receipts");
  }
  for (const path of ["/receipts/abc", "/receipts/0/edit", "/receipts/-1"]) {
    await page.goto(base + path);
    await page.getByRole("heading", { name: "レシートの指定が正しくありません" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "再試行", exact: true }).count(), 0);
    assert.ok((await page.getByRole("main").getByRole("alert").innerText()).includes("IDは1以上"));
  }
  for (const mode of ["error", "offline"]) {
    await state(mode);
    await page.goto(base + "/receipts/1");
    await page.getByRole("heading", { name: "レシートを表示できません", exact: true }).waitFor();
    await page.getByRole("button", { name: "再試行", exact: true }).waitFor();
    assert.equal(await page.getByText("対象のレシートが見つかりません", { exact: true }).count(), 0);
  }
  await state("normal");
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/receipts", "/receipts/new", "/receipts/1", "/receipts/1/edit", "/receipts/9999", "/receipts/abc", "/receipts/500"]) {
      await page.goto(base + path);
      await page.locator("main h1").waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path + " at " + width);
    }
  }
  await page.goto(base + "/receipts/new");
  for (const selector of ['nav a[href="/receipts/new"]', '#store_name', 'button[type="submit"]']) {
    const control = page.locator(selector);
    await control.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    assert.ok(await control.evaluate(el => el === document.activeElement));
    const style = await control.evaluate(el => ({ outline: getComputedStyle(el).outlineStyle, width: getComputedStyle(el).outlineWidth, height: el.getBoundingClientRect().height }));
    assert.equal(style.outline, "solid");
    assert.equal(style.width, "3px");
    assert.ok(style.height >= 44);
  }
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(base + "/receipts/new");
    await page.getByRole("button", { name: "保存する" }).click();
    const colors = await page.evaluate(() => {
      // Tailwindのoklch()もブラウザでsRGBへ変換してから比較する。
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d");
      const rgb = color => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        return `rgb(${r}, ${g}, ${b})`;
      };
      const style = selector => {
        const css = getComputedStyle(document.querySelector(selector));
        return { color: rgb(css.color), background: rgb(css.backgroundColor) };
      };
      return { scheme: getComputedStyle(document.documentElement).colorScheme,
        body: style("body"), panel: style(".panel"), input: style("input"),
        textarea: style("textarea"), link: style("nav a"), error: style("#store_name-error") };
    });
    assert.equal(colors.scheme, "light");
    assert.equal(colors.body.background, "rgb(248, 250, 252)");
    for (const element of [colors.panel, colors.input, colors.textarea]) {
      assert.equal(element.background, "rgb(255, 255, 255)");
      assert.equal(element.color, "rgb(15, 23, 42)");
    }
    // 通常文字・リンク・エラー文の背景に対するコントラスト比を確認。
    const luminance = rgb => rgb.match(/\d+/g).slice(0, 3).map(Number)
      .map(n => n / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
      .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
    for (const [foreground, background] of [
      [colors.body.color, colors.body.background],
      [colors.input.color, colors.input.background],
      [colors.link.color, colors.panel.background],
      [colors.error.color, colors.panel.background],
    ]) {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `/private/tmp/receipt-layout-${colorScheme}.png`, fullPage: true });
  }
  console.log("PASS: 共通レイアウト・メタ情報・リダイレクト・画面状態・エラー区別・モバイル・配色");
} finally {
  await state("normal");
  await browser.close();
}
