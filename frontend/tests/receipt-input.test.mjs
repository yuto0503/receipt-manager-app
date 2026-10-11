import test from "node:test";
import assert from "node:assert/strict";
import { parseReceiptInput } from "../src/lib/receipt-input.ts";
const base = {
  store_name: "試験店",
  price: "0",
  purchase_date: "2024-02-29",
  category: "食品",
  memo: "",
};
test("入力を保持し暦日をUTCの午前0時として送る", () => {
  const values = { ...base, store_name: " 店 ", memo: " \n " };
  assert.deepEqual(parseReceiptInput(values).input, {
    ...values,
    price: 0,
    purchase_date: "2024-02-29T00:00:00Z",
  });
});
test("金額の空欄・小数・負数・上限超過を拒否", () => {
  for (const price of ["", " ", "-1", "1.5", "1e2", "2147483648", "１２"])
    assert.ok(parseReceiptInput({ ...base, price }).errors.price);
  assert.equal(
    parseReceiptInput({ ...base, price: "2147483647" }).input.price,
    2147483647,
  );
});
test("購入日の境界と不正日付", () => {
  for (const purchase_date of [
    "",
    "0999-12-31",
    "10000-01-01",
    "2023-02-29",
    "2024-04-31",
  ])
    assert.ok(
      parseReceiptInput({ ...base, purchase_date }).errors.purchase_date,
    );
  for (const purchase_date of ["1000-01-01", "9999-12-31", "2024-02-29"])
    assert.ok(parseReceiptInput({ ...base, purchase_date }).input);
});
test("Go互換の空白判定とコードポイント数", () => {
  for (const store_name of ["", " \t\n　", "\u0085"])
    assert.ok(parseReceiptInput({ ...base, store_name }).errors.store_name);
  assert.ok(parseReceiptInput({ ...base, store_name: "\ufeff" }).input);
  assert.ok(
    parseReceiptInput({
      ...base,
      store_name: "😀".repeat(255),
      category: "あ".repeat(100),
      memo: "😀".repeat(2000),
    }).input,
  );
  assert.ok(
    parseReceiptInput({ ...base, store_name: "😀".repeat(256) }).errors
      .store_name,
  );
  assert.ok(
    parseReceiptInput({ ...base, category: "あ".repeat(101) }).errors.category,
  );
  assert.ok(
    parseReceiptInput({ ...base, memo: "😀".repeat(2001) }).errors.memo,
  );
});
