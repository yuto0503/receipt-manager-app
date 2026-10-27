import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  },
});
const { saveReceipt, deleteReceipt, ReceiptClientError } = await import("../src/lib/receipt-client.ts");
hooks.deregister();
afterEach(() => test.mock.restoreAll());
const input = { store_name: "テスト店", price: 0, purchase_date: "2026-10-28T00:00:00Z", category: "食費", memo: "" };
const receipt = { ...input, id: 7, created_at: "", updated_at: "" };
test("登録・更新は同一オリジンへJSONオブジェクトを送る", async () => {
  for (const [id, method, status, path] of [[undefined, "POST", 201, "/api/receipts"], [7, "PUT", 200, "/api/receipts/7"]]) {
    const fetch = test.mock.method(globalThis, "fetch", async () => Response.json(receipt, { status }));
    assert.deepEqual(await saveReceipt(input, id), receipt);
    const [url, options] = fetch.mock.calls[0].arguments;
    assert.equal(url, path);
    assert.equal(options.method, method);
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(options.body), input);
    test.mock.restoreAll();
  }
});
test("UI側で400と404を区別でき、理由を保持する", async () => {
  for (const status of [400, 404]) {
    test.mock.method(globalThis, "fetch", async () => Response.json({ message: "入力を確認してください。" }, { status }));
    await assert.rejects(saveReceipt(input, 7), error => error instanceof ReceiptClientError && error.status === status && error.message === "入力を確認してください。");
    test.mock.restoreAll();
  }
});

test("HTTPエラー・通信失敗・タイムアウト・不正JSONを区別する", async () => {
  for (const [response, status, kind] of [
    [new Response("html", { status: 404 }), 404, "http"],
    [new Response("invalid", { status: 200 }), 502, "invalid-response"],
    [Response.json({}), 502, "invalid-response"],
  ]) {
    test.mock.method(globalThis, "fetch", async () => response);
    await assert.rejects(saveReceipt(input), { status, kind });
    test.mock.restoreAll();
  }
  for (const [error, kind] of [[new TypeError("private host"), "network"], [new DOMException("private timeout", "TimeoutError"), "timeout"]]) {
    test.mock.method(globalThis, "fetch", async () => { throw error; });
    await assert.rejects(saveReceipt(input), e => e.status === 503 && e.kind === kind && !e.message.includes("private"));
    test.mock.restoreAll();
  }
});

test("削除204はJSON解析せず完了し、それ以外の成功応答は拒否する", async () => {
  const response = new Response(null, { status: 204 });
  const json = test.mock.method(response, "json", () => assert.fail("204を解析しない"));
  const fetch = test.mock.method(globalThis, "fetch", async () => response);
  assert.equal(await deleteReceipt(7), undefined);
  assert.equal(json.mock.callCount(), 0);
  assert.equal(fetch.mock.calls[0].arguments[0], "/api/receipts/7");
  assert.equal(fetch.mock.calls[0].arguments[1].method, "DELETE");
  assert.equal(fetch.mock.calls[0].arguments[1].body, undefined);
  test.mock.restoreAll();
  test.mock.method(globalThis, "fetch", async () => Response.json({}));
  await assert.rejects(deleteReceipt(7), { status: 502, kind: "invalid-response" });
});
