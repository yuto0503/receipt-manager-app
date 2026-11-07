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
