import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// npm run buildの後に実行する。環境変数なしのビルドでエラー画面が
// 静的HTMLとして保存されると、起動時に接続先を設定しても回復しない。
const manifest = JSON.parse(
  await readFile(new URL("../.next/prerender-manifest.json", import.meta.url), "utf8"),
);
assert.ok(manifest.routes, "ビルドのprerender manifestが必要です");
assert.equal(
  Object.hasOwn(manifest.routes, "/receipts"),
  false,
  "レシート一覧はビルド時に静的生成せず、リクエストごとに取得してください",
);
console.log("PASS: /receipts is not prerendered");
