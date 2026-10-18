// 実データを操作しないため、必ずテスト専用APIに接続したNext.jsに対して実行する。
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(15000);
const base = process.env.RECEIPT_UI_TEST_URL;
if (!base)
  throw new Error(
    "RECEIPT_UI_TEST_URL にテスト専用Next.jsのURLを指定してください。",
  );
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(base);
  await page.waitForURL("**/receipts");
  assert.equal(await page.locator("h1").innerText(), "レシート一覧");
  for (const [path, heading] of [
    ["/receipts/new", "レシートを登録"],
    ["/receipts/1", "レシート詳細"],
    ["/receipts/1/edit", "レシートを編集"],
  ]) {
    await page.goto(base + path);
    assert.equal(await page.locator("h1").innerText(), heading);
    await page.reload();
    assert.equal(await page.locator("h1").innerText(), heading);
  }
  await page.getByRole("link", { name: "キャンセル", exact: true }).click();
  await page.waitForURL("**/receipts/1");
  await page.goto(base + "/receipts/new");
  await page.getByRole("link", { name: "キャンセル", exact: true }).click();
  await page.waitForURL("**/receipts");
  await page.getByRole("main").getByRole("link", { name: "新規登録" }).click();
  await page.getByRole("button", { name: "保存する" }).click();
  assert.equal(
    await page.locator("#store_name").getAttribute("aria-invalid"),
    "true",
  );
  await page.locator("#store_name").fill("操作検証店");
  await page.locator("#price").fill("0");
  await page.locator("#purchase_date").fill("2024-02-29");
  await page.locator("#category").fill("食品");
  await page.locator("#memo").fill("確認用\nメモ");
  await page.getByRole("button", { name: "保存する" }).click();
  await page.waitForURL(/\/receipts\/\d+$/);
  const detail = page.url();
  assert.ok((await page.locator("main").innerText()).includes("操作検証店"));
  assert.ok((await page.locator("main").innerText()).includes("2024-02-29"));
  await page.getByRole("link", { name: "編集する" }).click();
  await page.locator("#store_name").fill("APIエラー");
  await page.getByRole("button", { name: "保存する" }).click();
  await page.getByRole("main").getByRole("alert").waitFor();
  assert.equal(await page.locator("#store_name").inputValue(), "APIエラー");
  await page.locator("#store_name").fill("更新検証店");
  await page.getByRole("button", { name: "保存する" }).click();
  await page.waitForURL(detail);
  assert.ok((await page.locator("main").innerText()).includes("更新検証店"));
  await page.getByRole("link", { name: "一覧へ戻る" }).click();
  await page.getByRole("link", { name: "更新検証店" }).click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await page.getByRole("button", { name: "削除をキャンセル" }).click();
  assert.equal(
    await page.getByRole("button", { name: "削除を実行" }).count(),
    0,
  );
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await page.getByRole("button", { name: "削除を実行" }).click();
  await page.waitForURL("**/receipts");
  assert.equal(await page.getByRole("link", { name: "更新検証店" }).count(), 0);
  for (const path of ["/receipts/9999", "/receipts/9999/edit"]) {
    await page.goto(base + path);
    assert.equal(
      await page.locator("h1").innerText(),
      "対象のレシートが見つかりません",
    );
  }
  for (const path of ["/receipts/abc", "/receipts/0/edit", "/receipts/-1"]) {
    await page.goto(base + path);
    assert.ok(
      (await page.getByRole("main").getByRole("alert").innerText()).includes(
        "IDは1以上",
      ),
    );
  }
  for (const path of ["/receipts/500", "/receipts/502"]) {
    await page.goto(base + path);
    await page.getByRole("main").getByRole("alert").waitFor();
    assert.equal(
      await page.locator("h1").innerText(),
      "レシートを表示できません",
    );
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(base + "/receipts/new");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "/private/tmp/receipt-new-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + "/receipts/1");
  await page.screenshot({
    path: "/private/tmp/receipt-detail-desktop.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 直接アクセス・再読込・登録・編集・キャンセル・削除・404・不正ID・API異常・モバイル幅",
  );
} finally {
  await browser.close();
}
