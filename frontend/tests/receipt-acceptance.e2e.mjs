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
async function save(target = page) {
  await target.getByRole('button', { name: '保存する', exact: true }).click();
  await target.waitForURL(/\/receipts\/\d+\?saved=1$/);
  const id = Number(new URL(target.url()).pathname.split('/').pop());
  ids.add(id);
  await target.getByRole('heading', { name: 'レシート詳細' }).waitFor();
  return id;
}
async function remove() {
  await page.getByRole('button', { name: '削除する', exact: true }).click();
  await page.getByRole('button', { name: '削除を実行', exact: true }).click();
  await page.waitForURL('**/receipts');
  await page.getByRole('heading', { name: 'レシート一覧' }).waitFor();
}
try {
  if (!['7-server-error', '7-offline'].includes(step))
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
  } else if (step === '4') {
    const record = await create(page);
    ids.add(record.id);
    for (const editing of [false, true]) {
      const url = base + (editing ? `/receipts/${record.id}/edit` : '/receipts/new');
      await page.goto(url);
      const before = await list();
      let sent = 0;
      const listener = request => { if (['POST', 'PUT'].includes(request.method())) sent++; };
      page.on('request', listener);
      for (const [key, value] of [
        ['store_name', ''], ['store_name', ' 　\t'], ['category', ''], ['category', ' 　\t'],
        ['purchase_date', ''], ['price', ''], ['price', ' '], ['price', '-1'], ['price', '1.5'], ['price', '2147483648'],
      ]) {
        await fill(page);
        await page.locator('#' + key).fill(value);
        await page.getByRole('button', { name: '保存する' }).click();
        assert.equal(await page.locator('#' + key).getAttribute('aria-invalid'), 'true');
        assert.equal(await page.locator('#' + key).evaluate(el => el === document.activeElement), true);
      }
      assert.equal(sent, 0);
      page.off('request', listener);
      assert.deepEqual(await list(), before);
      for (const price of [0, 2147483647]) {
        await page.goto(url);
        await fill(page, { price });
        const id = await save();
        const stored = await (await page.request.get(api + '/receipts/' + id)).json();
        assert.equal(stored.price, price);
      }
    }
  } else if (step === '5') {
    const record = await create(page);
    ids.add(record.id);
    for (const editing of [false, true]) {
      const url = base + (editing ? `/receipts/${record.id}/edit` : '/receipts/new');
      for (const character of ['あ', '😀']) {
        await page.goto(url);
        const before = await list();
        for (const [key, limit] of [['store_name', 255], ['category', 100], ['memo', 2000]]) {
          await fill(page, { [key]: character.repeat(limit + 1) });
          await page.getByRole('button', { name: '保存する' }).click();
          assert.equal(await page.locator('#' + key).getAttribute('aria-invalid'), 'true');
        }
        assert.deepEqual(await list(), before);
        const data = { store_name: character.repeat(255), category: character.repeat(100), memo: character.repeat(2000) };
        await fill(page, data);
        const id = await save();
        const stored = await (await page.request.get(api + '/receipts/' + id)).json();
        for (const [key, value] of Object.entries(data)) assert.equal(stored[key], value);
        await page.getByRole('link', { name: '編集する' }).click();
        for (const [key, value] of Object.entries(data)) assert.equal(await page.locator('#' + key).inputValue(), value);
      }
    }
  } else if (step === '6') {
    for (const timezoneId of ['Asia/Tokyo', 'UTC', 'America/Los_Angeles']) {
      const context = await browser.newContext({ timezoneId });
      const target = await context.newPage();
      target.setDefaultTimeout(15000);
      target.on('pageerror', error => errors.push(error.message));
      const record = await create(target);
      ids.add(record.id);
      for (const editing of [false, true]) {
        const url = base + (editing ? `/receipts/${record.id}/edit` : '/receipts/new');
        for (const date of ['2024-04-30', '2024-12-31', '2024-02-29', '1000-01-01', '9999-12-31']) {
          await target.goto(url);
          await fill(target, { purchase_date: date });
          const id = await save(target);
          assert.ok((await target.locator('dl').innerText()).includes(date));
          const stored = await (await target.request.get(api + '/receipts/' + id)).json();
          assert.equal(stored.purchase_date.slice(0, 10), date);
          await target.reload();
          await target.getByRole('link', { name: '編集する' }).click();
          assert.equal(await target.locator('#purchase_date').inputValue(), date);
        }
        await target.goto(url);
        const before = await list();
        for (const date of ['0999-12-31', '10000-01-01', '2023-02-29', '2024-04-31']) {
          await fill(target);
          // date要素が入力できない不正文字列もアプリの検証へ渡して確認する。
          await target.locator('#purchase_date').evaluate(el => { el.type = 'text'; });
          await target.locator('#purchase_date').fill(date);
          await target.getByRole('button', { name: '保存する' }).click();
          assert.equal(await target.locator('#purchase_date').getAttribute('aria-invalid'), 'true');
        }
        assert.deepEqual(await list(), before);
      }
      await context.close();
    }
  } else if (step === '7') {
    for (const id of ['abc', '0', '-1']) {
      for (const method of ['GET', 'PUT', 'DELETE']) {
        const response = await page.request.fetch(api + '/receipts/' + id, { method, data: {} });
        assert.equal(response.status(), 400);
      }
      await page.goto(base + '/receipts/' + id);
      assert.ok((await page.getByRole('main').getByRole('alert').innerText()).includes('IDは1以上'));
    }
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const response = await page.request.fetch(api + '/receipts/2147483647', { method, data: {
        store_name: '存在しない検証店', price: 1, category: '検証', purchase_date: '2024-01-01T00:00:00Z',
      } });
      assert.equal(response.status(), 404);
    }
    await page.goto(base + '/receipts/2147483647');
    await page.getByRole('heading', { name: '対象のレシートが見つかりません' }).waitFor();
    let id;
    for (const method of ['POST', 'PUT', 'DELETE']) {
      await page.goto(base + (method === 'POST' ? '/receipts/new' : `/receipts/${id}${method === 'PUT' ? '/edit' : ''}`));
      let count = 0;
      await page.route('**/api/receipts{,/*}', async route => {
        count++;
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.continue();
      });
      if (method !== 'DELETE') {
        await fill(page);
        await page.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
        await page.getByRole('button', { name: '保存中…' }).waitFor();
        assert.equal(await page.locator('#store_name').isDisabled(), true);
        await page.waitForURL(/\/receipts\/\d+\?saved=1$/);
        id = Number(new URL(page.url()).pathname.split('/').pop());
        ids.add(id);
        await page.getByRole('heading', { name: 'レシート詳細' }).waitFor();
      } else {
        await page.getByRole('button', { name: '削除する', exact: true }).click();
        await page.getByRole('button', { name: '削除を実行' }).evaluate(button => { button.click(); button.click(); });
        await page.getByRole('button', { name: '削除中…' }).waitFor();
        assert.equal(await page.getByRole('button', { name: '削除中…' }).isDisabled(), true);
        await page.waitForURL('**/receipts');
      }
      assert.equal(count, 1);
      await page.unroute('**/api/receipts{,/*}');
    }
    assert.deepEqual(await list(), []);
  } else if (['7-server-error', '7-offline'].includes(step)) {
    if (step === '7-server-error') assert.equal((await page.request.get(api + '/receipts')).status(), 500);
    else await assert.rejects(() => page.request.get(api + '/receipts', { timeout: 2000 }));
    await page.goto(base + '/receipts');
    await page.getByRole('main').getByRole('alert').waitFor();
    assert.equal(await page.getByText('まだレシートがありません。新規登録から追加してください。').count(), 0);
    await page.goto(base + '/receipts/new');
    await fill(page);
    const response = page.waitForResponse(r => r.url().endsWith('/api/receipts') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '保存する' }).click();
    assert.equal((await response).status(), step === '7-server-error' ? 500 : 503);
    await page.getByRole('main').getByRole('alert').waitFor();
    assert.equal(await page.locator('#store_name').inputValue(), '画面検証店');
    assert.ok(!(await page.locator('main').innerText()).includes('SQL'));
    assert.equal(await page.getByRole('button', { name: '保存する' }).isEnabled(), true);
  } else if (step === '8') {
    const record = await create(page);
    ids.add(record.id);
    const tabTo = async locator => {
      for (let i = 0; i < 45; i++) {
        if (await locator.evaluate(el => el === document.activeElement)) return;
        await page.keyboard.press('Tab');
      }
      assert.fail('Tabで到達できない要素');
    };
    for (const width of [320, 375, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/receipts', '/receipts/new', `/receipts/${record.id}`, `/receipts/${record.id}/edit`]) {
        await page.goto(base + path);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      await page.goto(base + '/receipts/new');
      await tabTo(page.getByRole('button', { name: '保存する' }));
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#store_name').evaluate(el => el === document.activeElement), true);
      for (const key of ['store_name', 'price', 'purchase_date', 'category', 'memo']) {
        assert.ok(await page.locator('#' + key).evaluate(el => el.labels.length > 0));
        const descriptions = (await page.locator('#' + key).getAttribute('aria-describedby')).split(' ');
        for (const id of descriptions) assert.ok(await page.locator('#' + id).isVisible());
      }
      assert.ok(await page.locator('#store_name').evaluate(el => getComputedStyle(el).outlineStyle !== 'none'));
      await page.screenshot({ path: `/private/tmp/receipt-acceptance-${width}.png`, fullPage: true });
    }
    await page.goto(base + '/receipts');
    await tabTo(page.getByRole('link', { name: '画面検証店', exact: true }));
    await page.keyboard.press('Enter');
    await page.waitForURL(base + `/receipts/${record.id}`);
    await tabTo(page.getByRole('link', { name: '編集する' }));
    await page.keyboard.press('Enter');
    await page.waitForURL(base + `/receipts/${record.id}/edit`);
    await tabTo(page.locator('#store_name'));
    await page.keyboard.press('Meta+A');
    await page.keyboard.type('Keyboard verification');
    await tabTo(page.getByRole('button', { name: '保存する' }));
    await page.keyboard.press('Enter');
    await page.waitForURL(/\?saved=1$/);
    await page.getByText('Keyboard verification', { exact: true }).waitFor();
    await tabTo(page.getByRole('button', { name: '削除する', exact: true }));
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('button', { name: '削除を実行' }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: '削除する', exact: true }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/receipts');
    assert.deepEqual(await list(), []);
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
