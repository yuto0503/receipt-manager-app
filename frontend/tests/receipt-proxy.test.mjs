import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const invalidations = [];
globalThis.__receiptProxyRevalidate = (...args) => invalidations.push(args);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/cache") return {
      url: "data:text/javascript,export const revalidatePath = (...args) => globalThis.__receiptProxyRevalidate(...args)", shortCircuit: true,
    };
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier === "server-only" ? "next/dist/compiled/server-only/empty.js" : specifier, context);
  },
});
const collection = await import("../src/app/api/receipts/route.ts");
const item = await import("../src/app/api/receipts/[id]/route.ts");
const { mutateReceipt } = await import("../src/lib/receipt-proxy.ts");
hooks.deregister();
const originalBase = process.env.SERVER_API_BASE_URL;
afterEach(() => {
  test.mock.restoreAll();
  invalidations.length = 0;
  if (originalBase === undefined) delete process.env.SERVER_API_BASE_URL;
  else process.env.SERVER_API_BASE_URL = originalBase;
});
const receipt = {
  id: 7, store_name: "テスト店", price: 0, purchase_date: "2026-10-19T00:00:00Z",
  category: "食費", memo: "", created_at: "", updated_at: "",
};
function request(method, body = JSON.stringify(receipt), headers = {}) {
  return new Request("http://frontend.test/api/receipts?path=/health&method=GET", {
    method, headers: { "Content-Type": "application/json", ...headers },
    ...(method === "DELETE" ? {} : { body }),
  });
}
function respond(body = JSON.stringify(receipt), status = 200) {
  process.env.SERVER_API_BASE_URL = "http://api.example.test/";
  return test.mock.method(globalThis, "fetch", async () => new Response(body, { status }));
}
const context = (id) => ({ params: Promise.resolve({ id }) });

test("ルートはPOSTとPUT・DELETEだけを公開する", () => {
  assert.deepEqual(Object.keys(collection), ["POST"]);
  assert.deepEqual(Object.keys(item).sort(), ["DELETE", "PUT"]);
});
for (const [method, path, status] of [["POST", "/receipts", 201], ["PUT", "/receipts/7", 200], ["DELETE", "/receipts/7", 204]]) {
  test(`${method}は固定パスに中継し${status}を返す`, async () => {
    const fetch = respond(method === "DELETE" ? null : JSON.stringify(receipt), status);
    const handler = method === "POST" ? collection.POST : item[method];
    const response = await handler(request(method, JSON.stringify({ ...receipt, id: 99 }), {
      "X-HTTP-Method-Override": "GET", Authorization: "untrusted",
    }), context("7"));
    assert.equal(response.status, status);
    assert.equal(fetch.mock.callCount(), 1);
    const [url, options] = fetch.mock.calls[0].arguments;
    assert.equal(url, `http://api.example.test${path}`);
    assert.equal(options.method, method);
    assert.equal(options.redirect, "error");
    assert.deepEqual(options.headers, { "Content-Type": "application/json" });
    if (method === "DELETE") {
      assert.equal(options.body, undefined);
      assert.equal(await response.text(), "");
    } else {
      assert.equal(JSON.parse(options.body).id, 99);
      assert.deepEqual(await response.json(), receipt);
    }
    assert.deepEqual(invalidations, [["/receipts", "layout"]]);
  });
}
test("不正ID・パス・クエリの注入は中継前に400にする", async () => {
  const fetch = respond();
  for (const id of ["", "0", "-1", "1.5", "01", "9007199254740992", "../health", "1/../../health", "%2fhealth", "1?path=/health", "1#x", "https://evil.test"]) {
    for (const method of ["PUT", "DELETE"])
      assert.equal((await item[method](request(method), context(id))).status, 400, `${method}: ${id}`);
  }
  assert.equal(fetch.mock.callCount(), 0);
  assert.deepEqual(invalidations, []);
});
test("共通処理でも許可しないメソッド・IDの組み合わせを拒否する", async () => {
  const fetch = respond();
  for (const [method, id, status] of [["PATCH", "7", 405], ["GET", undefined, 405], ["POST", "7", 400], ["PUT", undefined, 400], ["DELETE", undefined, 400]])
    assert.equal((await mutateReceipt(request("POST"), method, id)).status, status);
  assert.equal(fetch.mock.callCount(), 0);
});
test("不正JSON・Content-Typeと別オリジンを転送しない", async () => {
  const fetch = respond();
  for (const method of ["POST", "PUT"]) {
    const handler = method === "POST" ? collection.POST : item.PUT;
    for (const body of ["", "{", "null", "[]", "42", "{} {}"])
      assert.equal((await handler(request(method, body), context("7"))).status, 400);
    assert.equal((await handler(request(method, "{}", { "Content-Type": "text/plain" }), context("7"))).status, 400);
  }
  assert.equal((await collection.POST(request("POST", "{}", { Origin: "http://other.test", Host: "frontend.test" }))).status, 403);
  assert.equal(fetch.mock.callCount(), 0);
});
test("APIの400・404・500を保ち、内部エラー詳細を隠す", async () => {
  for (const method of ["POST", "PUT", "DELETE"]) {
    for (const status of [400, 404, 500]) {
      respond('{"message":"backend details"}', status);
      const handler = method === "POST" ? collection.POST : item[method];
      const response = await handler(request(method), context("7"));
      assert.equal(response.status, status);
      assert.equal((await response.json()).message.includes("backend details"), status < 500);
      test.mock.restoreAll();
    }
  }
  assert.deepEqual(invalidations, []);
});
test("通信失敗と不正な保存結果を成功扱いにしない", async () => {
  process.env.SERVER_API_BASE_URL = "http://api.example.test";
  test.mock.method(globalThis, "fetch", async () => { throw new TypeError("private details"); });
  const response = await collection.POST(request("POST"));
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes("private details"), false);
  test.mock.restoreAll();
  respond('{}');
  assert.equal((await item.PUT(request("PUT"), context("7"))).status, 502);
  assert.deepEqual(invalidations, []);
});
