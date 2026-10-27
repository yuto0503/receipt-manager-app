import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier === "server-only" ? "next/dist/compiled/server-only/empty.js" : specifier, context);
  },
});
const { getReceipt, getReceipts } = await import("../src/lib/receipts.ts");
hooks.deregister();
const originalBase = process.env.SERVER_API_BASE_URL;
afterEach(() => {
  test.mock.restoreAll();
  if (originalBase === undefined) delete process.env.SERVER_API_BASE_URL;
  else process.env.SERVER_API_BASE_URL = originalBase;
});
test("一覧・詳細は毎回APIへ問い合わせ、更新・削除後の結果を返す", async () => {
  process.env.SERVER_API_BASE_URL = "http://api.example.test";
  let row = { id: 7, store_name: "更新前", price: 0, purchase_date: "2026-10-28T00:00:00Z", category: "食費", memo: "", created_at: "", updated_at: "" };
  const fetch = test.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.cache, "no-store");
    if (url.endsWith("/receipts")) return Response.json(row ? [row] : []);
    return row ? Response.json(row) : Response.json({ message: "対象なし" }, { status: 404 });
  });
  assert.equal((await getReceipts())[0].store_name, "更新前");
  assert.equal((await getReceipt("7")).store_name, "更新前");
  row = { ...row, store_name: "更新後" };
  assert.equal((await getReceipts())[0].store_name, "更新後");
  assert.equal((await getReceipt("7")).store_name, "更新後");
  row = null;
  assert.deepEqual(await getReceipts(), []);
  await assert.rejects(getReceipt("7"), { status: 404 });
  assert.equal(fetch.mock.callCount(), 6);
});
