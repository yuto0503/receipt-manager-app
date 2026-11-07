import { assert, base, api, setup, fill } from './ui-helpers.mjs';
for (const timezoneId of ['Asia/Tokyo', 'UTC', 'America/Los_Angeles']) {
  const { browser, page } = await setup({ timezoneId });
  let id;
  try {
    await page.goto(base + '/receipts/new');
    await page.getByRole('button', { name: '保存する' }).click();
    assert.equal(await page.locator('#store_name').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('#store_name').getAttribute('aria-describedby'), 'store_name-hint store_name-error');
    await fill(page, { price: 0, memo: ' \n ' });
    let count = 0;
    await page.route('**/api/receipts', async route => {
      count++;
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.continue();
    });
    await page.getByRole('button', { name: '保存する' }).click();
    await page.getByRole('button', { name: '保存中…' }).waitFor();
    assert.equal(await page.locator('#store_name').isDisabled(), true);
    await page.waitForURL(/\/receipts\/\d+(\?.*)?$/);
    id = new URL(page.url()).pathname.split('/').pop();
    await page.getByRole('heading', { name: 'レシート詳細' }).waitFor();
    assert.ok((await page.locator('dl').innerText()).includes('2024-02-29'));
    assert.equal(count, 1);
    await page.reload();
    await page.getByRole('link', { name: '編集する' }).click();
    assert.equal(await page.locator('#purchase_date').inputValue(), '2024-02-29');
    assert.equal(await page.locator('#price').inputValue(), '0');
    assert.equal(await page.locator('#memo').inputValue(), ' \n ');
    await page.locator('#memo').fill('');
    await page.getByRole('button', { name: '保存する' }).click();
    await page.waitForURL(/\/receipts\/\d+(\?.*)?$/);
    await page.getByText('メモなし', { exact: true }).waitFor();
    console.log('PASS: 共通フォーム・連打防止・メモ削除・暦日保持 ' + timezoneId);
  } finally {
    if (id) await page.request.delete(api + '/receipts/' + id);
    await browser.close();
  }
}
