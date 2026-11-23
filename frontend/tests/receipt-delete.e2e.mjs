import { assert, base, api, setup, create } from './ui-helpers.mjs';
const { browser, page } = await setup();
const ids = [];
try {
  const row = await create(page);
  const other = await create(page, { store_name: '削除しない店' });
  ids.push(row.id, other.id);
  await page.goto(base + '/receipts/' + row.id);
  const section = page.getByRole('region', { name: 'レシートの削除' });
  let requests = 0;
  page.on('request', request => { if (request.method() === 'DELETE') requests++; });
  const toggle = section.locator('button').first();
  await toggle.focus();
  await page.keyboard.press('Enter');
  assert.ok((await section.innerText()).includes('画面検証店・1,234円・2024-02-29'));
  assert.ok((await section.innerText()).includes('元に戻せません'));
  await page.keyboard.press('Tab');
  assert.equal(await section.getByRole('button', { name: '削除を実行' }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await toggle.evaluate(el => el === document.activeElement), true);
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  await toggle.click();
  await section.getByRole('button', { name: '削除をキャンセル' }).click();
  assert.equal(requests, 0);
  await toggle.click();
  for (const status of [500, 'offline']) {
    await page.route(`**/api/receipts/${row.id}`, route => status === 'offline' ? route.abort() : route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ message: 'private internal' }) }));
    await section.getByRole('button', { name: '削除を実行' }).click();
    await section.getByRole('alert').waitFor();
    assert.equal(new URL(page.url()).pathname, `/receipts/${row.id}`);
    assert.ok(!(await section.innerText()).includes('private internal'));
    assert.equal(await section.getByRole('button', { name: '削除を実行' }).isEnabled(), true);
    await page.unroute(`**/api/receipts/${row.id}`);
  }
  requests = 0;
  await page.route(`**/api/receipts/${row.id}`, async route => {
    await new Promise(resolve => setTimeout(resolve, 400));
    await route.continue();
  });
  const response = page.waitForResponse(r => r.request().method() === 'DELETE');
  await section.getByRole('button', { name: '削除を実行' }).click();
  await section.getByRole('button', { name: '削除中…' }).waitFor();
  assert.equal(await toggle.isDisabled(), true);
  assert.equal(await section.getByRole('button', { name: '削除中…' }).isDisabled(), true);
  assert.equal((await response).status(), 204);
  await page.waitForURL('**/receipts');
  await page.getByRole('heading', { name: 'レシート一覧' }).waitFor();
  assert.equal(requests, 1);
  assert.equal(await page.locator(`a[href="/receipts/${row.id}"]`).count(), 0);
  await page.locator(`main a[href="/receipts/${other.id}"]`).click();
  await page.getByRole('heading', { name: 'レシート詳細' }).waitFor();
  await page.request.delete(api + '/receipts/' + other.id);
  await section.getByRole('button', { name: '削除する', exact: true }).click();
  await section.getByRole('button', { name: '削除を実行' }).click();
  await section.getByText('対象のレシートはすでに削除されたか存在しません。').waitFor();
  await section.getByRole('link', { name: '一覧へ戻る' }).click();
  await page.waitForURL('**/receipts');
  console.log('PASS: 削除確認・キーボード・キャンセル・500/通信断・連打防止・204・競合404');
} finally {
  for (const id of ids) await page.request.delete(api + '/receipts/' + id);
  await browser.close();
}
