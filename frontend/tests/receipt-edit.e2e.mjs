import { assert, base, api, setup, create, values } from './ui-helpers.mjs';
const { browser, page } = await setup();
const ids = [];
try {
  const row = await create(page);
  const other = await create(page, { store_name: '変更しない店' });
  ids.push(row.id, other.id);
  const edit = base + `/receipts/${row.id}/edit`;
  await page.goto(edit);
  for (const [key, value] of Object.entries(values)) assert.equal(await page.locator('#' + key).inputValue(), key === 'purchase_date' ? value.slice(0, 10) : String(value));
  let sent;
  await page.route(`**/api/receipts/${row.id}`, async route => { sent = route.request(); await route.continue(); });
  // 同一内容も200として成功し、入力用以外のフィールドを送らない。
  const response = page.waitForResponse(r => r.request().method() === 'PUT');
  await page.getByRole('button', { name: '保存する' }).click();
  assert.equal((await response).status(), 200);
  await page.waitForURL(base + `/receipts/${row.id}?saved=1`);
  assert.deepEqual(sent.postDataJSON(), values);
  assert.equal(sent.method(), 'PUT');
  await page.unroute(`**/api/receipts/${row.id}`);
  await page.getByRole('link', { name: '編集する' }).click();
  await page.locator('#store_name').fill('更新した店');
  await page.locator('#memo').fill('');
  for (const status of [400, 500, 'offline']) {
    await page.route(`**/api/receipts/${row.id}`, route => status === 'offline' ? route.abort() : route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ message: '保存失敗' }) }));
    await page.getByRole('button', { name: '保存する' }).click();
    await page.getByRole('main').getByRole('alert').waitFor();
    assert.equal(page.url(), edit);
    assert.equal(await page.locator('#store_name').inputValue(), '更新した店');
    assert.equal(await page.locator('#memo').inputValue(), '');
    await page.unroute(`**/api/receipts/${row.id}`);
  }
  await page.getByRole('button', { name: '保存する' }).click();
  await page.waitForURL(base + `/receipts/${row.id}?saved=1`);
  await page.getByText('更新した店', { exact: true }).waitFor();
  await page.getByText('メモなし', { exact: true }).waitFor();
  assert.equal((await (await page.request.get(api + `/receipts/${other.id}`)).json()).store_name, '変更しない店');
  await page.getByRole('link', { name: '一覧へ戻る' }).click();
  await page.getByRole('link', { name: '更新した店', exact: true }).waitFor();
  await page.goto(edit);
  let count = 0;
  page.on('request', request => { if (request.method() === 'PUT') count++; });
  await page.locator('#store_name').fill('キャンセルする変更');
  await page.getByRole('link', { name: 'キャンセル', exact: true }).click();
  await page.waitForURL(base + `/receipts/${row.id}`);
  assert.equal(count, 0);
  await page.goto(edit);
  await page.locator('#store_name').fill('削除後の編集');
  await page.request.delete(api + `/receipts/${row.id}`);
  await page.getByRole('button', { name: '保存する' }).click();
  await page.getByText('対象のレシートは削除されたか存在しません。').waitFor();
  assert.equal(await page.locator('#store_name').inputValue(), '削除後の編集');
  await page.getByRole('main').getByRole('link', { name: '一覧へ戻る' }).click();
  await page.waitForURL('**/receipts');
  console.log('PASS: 編集初期値・PUT本文・同一内容200・対象のみ更新・失敗保持・キャンセル・競合404');
} finally {
  for (const id of ids) await page.request.delete(api + '/receipts/' + id);
  await browser.close();
}
