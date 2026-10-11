export type Receipt = {
  id: number;
  store_name: string;
  price: number;
  purchase_date: string;
  category: string;
  memo: string;
  created_at: string;
  updated_at: string;
};

export type ReceiptInput = Pick<
  Receipt,
  "store_name" | "price" | "purchase_date" | "category" | "memo"
>;

export function isReceipt(value: unknown): value is Receipt {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "number" &&
    Number.isSafeInteger(r.id) &&
    r.id > 0 &&
    typeof r.price === "number" &&
    Number.isInteger(r.price) &&
    r.price >= 0 &&
    r.price <= 2147483647 &&
    [
      "store_name",
      "purchase_date",
      "category",
      "memo",
      "created_at",
      "updated_at",
    ].every((key) => typeof r[key] === "string")
  );
}
