// テスト専用APIとNext.jsにのみ接続する。生成したデータは各テストのfinallyで削除する。
import assert from 'node:assert/strict';
export { assert };
export const base = process.env.RECEIPT_UI_TEST_URL;
if (!base) throw new Error('RECEIPT_UI_TEST_URL にテスト専用Next.jsを指定してください。');
export const api = process.env.RECEIPT_TEST_API_URL || 'http://127.0.0.1:18080';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
export async function setup(options = {}) {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL });
  const page = await browser.newPage(options);
  page.setDefaultTimeout(15000);
  return { browser, page };
}
export const values = { store_name: '画面検証店', price: 1234, purchase_date: '2024-02-29T00:00:00Z', category: '食品', memo: '一行目\n 二行目 ' };
export async function create(page, overrides = {}) {
  const response = await page.request.post(api + '/receipts', { data: { ...values, ...overrides } });
  assert.equal(response.status(), 201);
  return response.json();
}
export async function fill(page, overrides = {}) {
  const data = { ...values, ...overrides };
  for (const [key, value] of Object.entries(data)) await page.locator('#' + key).fill(key === 'purchase_date' ? value.slice(0, 10) : String(value));
}
export async function state(page, mode) {
  await page.request.post(api + '/__test/state', { data: { mode, delay: 0 } });
}
