import { assert, base, api, setup, create, state } from './ui-helpers.mjs';
const { browser, page } = await setup({ viewport: { width: 320, height: 900 } });
const ids = [];
try {
  await state(page, 'empty');
  await page.goto(base + '/receipts');
  await page.getByText('まだレシートがありません。新規登録から追加してください。').waitFor();
  assert.equal(await page.locator('main ul li').count(), 0);
  await page.getByRole('main').getByRole('link', { name: '新規登録' }).click();
  await page.waitForURL('**/receipts/new');
  await state(page, 'normal');
  for (const data of [
    { store_name: '古い日付', price: 0, purchase_date: '1000-01-01T00:00:00Z' },
    { store_name: 'A'.repeat(255), category: 'B'.repeat(100), price: 2147483647, purchase_date: '9999-12-31T00:00:00Z' },
    { store_name: '同日の新しいID', purchase_date: '9999-12-31T00:00:00Z' },
  ]) ids.push((await create(page, data)).id);
  await page.goto(base + '/receipts');
  const cards = page.locator('main ul li');
  await cards.first().waitFor();
  assert.equal(await cards.nth(0).locator('a').getAttribute('href'), `/receipts/${ids[2]}`);
  assert.equal(await cards.nth(1).locator('a').getAttribute('href'), `/receipts/${ids[1]}`);
  assert.ok((await cards.nth(1).innerText()).includes('2,147,483,647円'));
  assert.ok((await cards.last().innerText()).includes('0円'));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const id of ids) {
    await page.locator(`main a[href="/receipts/${id}"]`).click();
    await page.getByRole('heading', { name: 'レシート詳細' }).waitFor();
    await page.getByRole('link', { name: '一覧へ戻る' }).click();
    await page.getByRole('heading', { name: 'レシート一覧' }).waitFor();
  }
  for (const mode of ['error', 'offline']) {
    await state(page, mode);
    await page.reload();
    await page.getByRole('main').getByRole('alert').waitFor();
    assert.equal(await page.getByText('まだレシートがありません。新規登録から追加してください。').count(), 0);
    await state(page, 'normal');
    await page.getByRole('button', { name: '再試行', exact: true }).click();
    await cards.first().waitFor();
  }
  console.log('PASS: 一覧・円表示・並び順・空一覧・再試行・長文・詳細導線');
} finally {
  await state(page, 'normal');
  for (const id of ids) await page.request.delete(api + '/receipts/' + id);
  await browser.close();
}
