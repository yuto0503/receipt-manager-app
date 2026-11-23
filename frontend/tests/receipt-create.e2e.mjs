import { assert, base, api, setup, fill } from './ui-helpers.mjs';
const { browser, page } = await setup();
let id;
try {
  await page.goto(base + '/receipts/new');
  for (const key of ['store_name', 'price', 'purchase_date', 'category', 'memo']) assert.equal(await page.locator('#' + key).inputValue(), '');
  await page.getByRole('link', { name: 'キャンセル', exact: true }).click();
  await page.waitForURL('**/receipts');
  await page.goto(base + '/receipts/new');
  await fill(page);
  for (const status of [400, 500, 'offline']) {
    let calls = 0;
    await page.route('**/api/receipts', route => {
      calls++;
      return status === 'offline' ? route.abort() : route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ message: status === 400 ? '入力を確認してください。' : 'private internal' }) });
    });
    await page.getByRole('button', { name: '保存する' }).click();
    await page.getByRole('main').getByRole('alert').waitFor();
    assert.equal(new URL(page.url()).pathname, '/receipts/new');
    assert.equal(await page.locator('#store_name').inputValue(), '画面検証店');
    assert.equal(await page.locator('#memo').inputValue(), '一行目\n 二行目 ');
    assert.ok(!(await page.locator('main').innerText()).includes('private internal'));
    assert.equal(calls, 1);
    await page.unroute('**/api/receipts');
  }
  const response = page.waitForResponse(r => r.url().endsWith('/api/receipts') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '保存する' }).click();
  const saved = await response;
  assert.equal(saved.status(), 201);
  id = (await saved.json()).id;
  await page.waitForURL(base + `/receipts/${id}?saved=1`);
  await page.getByRole('status').filter({ hasText: '保存しました。' }).waitFor();
  await page.getByRole('link', { name: '一覧へ戻る' }).click();
  await page.locator(`main a[href="/receipts/${id}"]`).waitFor();
  console.log('PASS: 空フォーム・キャンセル・登録201・完了表示・一覧反映・400/500/通信断の保持');
} finally {
  if (id) await page.request.delete(api + '/receipts/' + id);
  await browser.close();
}
