import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Node単体テストではNext.jsのサーバー側と同じserver-only解決を使う。
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === "server-only"
        ? "next/dist/compiled/server-only/empty.js"
        : specifier,
      context,
    );
  },
});
const { apiRequest, ApiError } = await import("../src/lib/api.ts");
hooks.deregister();

const originalBase = process.env.SERVER_API_BASE_URL;
afterEach(() => {
  test.mock.restoreAll();
  if (originalBase === undefined) delete process.env.SERVER_API_BASE_URL;
  else process.env.SERVER_API_BASE_URL = originalBase;
});

function respond(body, status = 200) {
  process.env.SERVER_API_BASE_URL = "http://api.example.test/";
  return test.mock.method(globalThis, "fetch", async () =>
    new Response(body, { status }),
  );
}

test("ベースURLを共通化し、キャッシュせずにJSONを取得する", async () => {
  const fetch = respond("[]");
  assert.deepEqual(await apiRequest("/receipts"), []);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, "http://api.example.test/receipts");
  assert.equal(options.cache, "no-store");
  assert.ok(options.signal instanceof AbortSignal);
});

test("POST・PUTの本文とヘッダーを保持し、201・200を扱う", async () => {
  for (const [method, status] of [["POST", 201], ["PUT", 200]]) {
    const fetch = respond('{"id":1}', status);
    const body = JSON.stringify({ price: 0 });
    const headers = { "Content-Type": "application/json" };
    assert.deepEqual(
      await apiRequest("/receipts", { method, body, headers }),
      { id: 1 },
    );
    const options = fetch.mock.calls[0].arguments[1];
    assert.equal(options.method, method);
    assert.equal(options.body, body);
    assert.deepEqual(options.headers, headers);
    test.mock.restoreAll();
  }
});

test("DELETEの204はJSON解析せずnullを返す", async () => {
  respond(null, 204);
  assert.equal(await apiRequest("/receipts/1", { method: "DELETE" }), null);
});

test("400・404のJSONエラーはステータスと理由を保持する", async () => {
  for (const status of [400, 404]) {
    respond('{"message":"入力を確認してください。"}', status);
    await assert.rejects(apiRequest("/receipts"), (error) =>
      error instanceof ApiError && error.status === status &&
      error.message === "入力を確認してください。",
    );
    test.mock.restoreAll();
  }
});

test("不正なエラー本文でもステータスを保持し、空メッセージを補う", async () => {
  for (const body of ["<html>not found</html>", "", "null", '{"message":42}', '{"message":" "}']) {
    respond(body, 404);
    await assert.rejects(apiRequest("/receipts/1"), {
      name: "ApiError", status: 404, message: "処理に失敗しました。",
    });
    test.mock.restoreAll();
  }
});

test("500系の内部エラー詳細はJSON・非JSONともに公開しない", async () => {
  for (const body of ['{"message":"private database details"}', "private proxy details"]) {
    respond(body, 503);
    await assert.rejects(apiRequest("/receipts"), {
      name: "ApiError", status: 503,
      message: "APIの処理に失敗しました。時間をおいて再試行してください。",
    });
    test.mock.restoreAll();
  }
});

test("成功応答のJSON不正は502にする", async () => {
  respond("not json");
  await assert.rejects(apiRequest("/receipts"), { name: "ApiError", status: 502 });
});

test("接続失敗・タイムアウトは詳細を隠して503にする", async () => {
  for (const failure of [new TypeError("private host"), new DOMException("timeout", "TimeoutError")]) {
    process.env.SERVER_API_BASE_URL = "http://api.example.test";
    test.mock.method(globalThis, "fetch", async () => { throw failure; });
    await assert.rejects(apiRequest("/receipts"), {
      name: "ApiError", status: 503,
      message: "APIに接続できませんでした。時間をおいて再試行してください。",
    });
    test.mock.restoreAll();
  }
});

test("ベースURL未設定・空白時は通信しない", async () => {
  const fetch = test.mock.method(globalThis, "fetch", async () => {
    assert.fail("接続先未設定でfetchを呼び出してはいけない");
  });
  for (const base of [undefined, "", " "]) {
    if (base === undefined) delete process.env.SERVER_API_BASE_URL;
    else process.env.SERVER_API_BASE_URL = base;
    await assert.rejects(apiRequest("/receipts"), { name: "ApiError", status: 503 });
  }
  assert.equal(fetch.mock.callCount(), 0);
});
