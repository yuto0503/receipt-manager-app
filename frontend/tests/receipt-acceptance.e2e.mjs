// 専用の空の実DB/APIでのみ実行する。作成したID以外は削除しない。
import { assert, base, api, setup, fill, create } from './ui-helpers.mjs';
assert.equal(process.env.RECEIPT_ACCEPTANCE_ISOLATED, '1', '独立した検証DBを用意してください');
const step = process.argv[2];
const { browser, page } = await setup();
const ids = new Set();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function list() {
  const response = await page.request.get(api + '/receipts');
  assert.equal(response.status(), 200);
  return response.json();
}
async function save() {
  await page.getByRole('button', { name: '保存する', exact: true }).click();
  await page.waitForURL(/\/receipts\/\d+\?saved=1$/);
  const id = Number(new URL(page.url()).pathname.split('/').pop());
  ids.add(id);
  await page.getByRole('heading', { name: 'レシート詳細' }).waitFor();
  return id;
}
async function remove() {
  await page.getByRole('button', { name: '削除する', exact: true }).click();
  await page.getByRole('button', { name: '削除を実行', exact: true }).click();
  await page.waitForURL('**/receipts');
  await page.getByRole('heading', { name: 'レシート一覧' }).waitFor();
}
try {
  assert.deepEqual(await list(), [], '安全のため開始時に空のDBであることを要求します');
  if (step === '1') {
    await page.goto(base + '/receipts');
    await page.getByRole('main').getByRole('link', { name: '新規登録' }).click();
    await fill(page);
    const id = await save();
    assert.equal((await list())[0].store_name, '画面検証店');
    await page.getByRole('link', { name: '編集する' }).click();
    await page.locator('#store_name').fill('実DB更新検証店');
    await save();
    await page.getByText('実DB更新検証店', { exact: true }).waitFor();
    assert.equal((await list())[0].store_name, '実DB更新検証店');
    await remove();
    assert.deepEqual(await list(), []);
    assert.equal((await page.request.get(api + '/receipts/' + id)).status(), 404);
  } else if (step === '2') {
    const record = await create(page);
    ids.add(record.id);
    const detail = base + '/receipts/' + record.id;
    for (const [url, heading] of [
      [base + '/receipts', 'レシート一覧'],
      [base + '/receipts/new', 'レシートを登録'],
      [detail, 'レシート詳細'], [detail + '/edit', 'レシートを編集'],
    ]) {
      await page.goto(url);
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      await page.reload();
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    }
    await page.goto(base + '/receipts');
    await page.getByRole('link', { name: '画面検証店', exact: true }).click();
    await page.waitForURL(detail);
    await page.getByRole('link', { name: '編集する' }).click();
    await page.waitForURL(detail + '/edit');
    await page.goBack();
    await page.getByRole('heading', { name: 'レシート詳細' }).waitFor();
    await page.goForward();
    await page.getByRole('heading', { name: 'レシートを編集' }).waitFor();
    await page.locator('#store_name').fill('履歴更新店');
    await save();
    await page.reload();
    await page.getByText('履歴更新店', { exact: true }).waitFor();
    await page.goBack();
    assert.equal(await page.locator('#store_name').inputValue(), '履歴更新店');
    await page.goForward();
    await page.getByText('履歴更新店', { exact: true }).waitFor();
    await page.getByRole('link', { name: '一覧へ戻る' }).click();
    await page.getByRole('link', { name: '履歴更新店', exact: true }).click();
    await remove();
    await page.goBack();
    await page.getByRole('heading', { name: '対象のレシートが見つかりません' }).waitFor();
    await page.goForward();
    await page.getByText('まだレシートがありません。新規登録から追加してください。').waitFor();
    await page.reload();
    assert.equal(await page.locator('main ul li').count(), 0);
  } else if (step === '3') {
    await page.goto(base + '/receipts');
    await page.getByText('まだレシートがありません。新規登録から追加してください。').waitFor();
    assert.equal(await page.locator('main ul li').count(), 0);
    const first = await create(page, { memo: '' });
    ids.add(first.id);
    await page.reload();
    assert.equal(await page.locator('main ul li').count(), 1);
    await page.goto(base + '/receipts/' + first.id);
    await page.getByText('メモなし', { exact: true }).waitFor();
    const long = await create(page, { store_name: '店'.repeat(255), category: '分類'.repeat(50), memo: '一行目\n二行目\n😀三行目' });
    ids.add(long.id);
    await page.goto(base + '/receipts');
    assert.equal(await page.locator('main ul li').count(), 2);
    await page.getByRole('link', { name: long.store_name, exact: true }).waitFor();
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.goto(base + '/receipts/' + long.id);
    assert.ok((await page.locator('dl').innerText()).includes(long.category));
    const memo = page.locator('dd').last();
    assert.equal(await memo.innerText(), long.memo);
    assert.equal(await memo.evaluate(el => getComputedStyle(el).whiteSpace), 'pre-wrap');
  } else {
    throw new Error('未定義の項目: ' + step);
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: acceptance ${step} (real Go API / MySQL)`);
} finally {
  for (const id of ids) {
    const response = await page.request.delete(api + '/receipts/' + id);
    assert.ok([204, 404].includes(response.status()));
  }
  await browser.close();
}
