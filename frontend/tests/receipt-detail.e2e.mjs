import { assert, base, api, setup, create, state } from './ui-helpers.mjs';
const { browser, page } = await setup({ viewport: { width: 320, height: 900 } });
const ids = [];
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  const html = '<img src=x onerror="alert(1)">';
  const row = await create(page, { store_name: html, category: '<b>食品</b>', memo: html + '\n 二行目 ' });
  ids.push(row.id);
  const other = await create(page, { store_name: '別レシート', memo: '' });
  ids.push(other.id);
  for (const receipt of [row, other]) {
    await page.goto(base + '/receipts/' + receipt.id);
    await page.getByRole('heading', { name: 'レシート詳細' }).waitFor();
    const fields = await page.locator('dl dd').allTextContents();
    assert.deepEqual(fields, [receipt.store_name, '1,234円', '2024-02-29', receipt.category, receipt.memo || 'メモなし']);
    assert.equal(await page.locator('main img, main b').count(), 0);
    assert.equal(await page.locator('dl dd').last().evaluate(el => getComputedStyle(el).whiteSpace), 'pre-wrap');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.equal(await page.getByRole('link', { name: '編集する' }).getAttribute('href'), `/receipts/${receipt.id}/edit`);
    await page.getByRole('button', { name: '削除する', exact: true }).waitFor();
    await page.getByRole('link', { name: '一覧へ戻る' }).click();
    await page.waitForURL('**/receipts');
  }
  for (const id of ['abc', '0', '-1']) {
    await page.goto(base + '/receipts/' + id);
    await page.getByRole('heading', { name: 'レシートの指定が正しくありません' }).waitFor();
  }
  await page.goto(base + '/receipts/9999999');
  await page.getByRole('heading', { name: '対象のレシートが見つかりません' }).waitFor();
  for (const mode of ['error', 'offline']) {
    await state(page, mode);
    await page.goto(base + '/receipts/' + row.id);
    await page.getByRole('heading', { name: 'レシートを表示できません', exact: true }).waitFor();
    await page.getByRole('link', { name: '一覧へ戻る' }).waitFor();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: URLの対象・全項目・空/改行メモ・HTML安全表示・導線・不正ID/404/取得失敗');
} finally {
  await state(page, 'normal');
  for (const id of ids) await page.request.delete(api + '/receipts/' + id);
  await browser.close();
}
