/** 一覧・詳細・登録・更新APIが返すレシート。日時はJSON文字列。 */
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

/** 登録（POST）・更新（PUT）共通の本文。更新対象のIDはURLで指定する。 */
export type ReceiptInput = {
  store_name: string;
  /** 0〜2,147,483,647円の整数。 */
  price: number;
  /** タイムゾーン付きのRFC 3339形式。 */
  purchase_date: string;
  category: string;
  /** 省略・nullは空文字として保存される。 */
  memo?: string | null;
};

/** 編集中の値。検証後にReceiptInputへ変換して送信する。 */
export type ReceiptFormValues = {
  store_name: string;
  /** 空欄を0円と区別できるよう、入力文字列をそのまま保持する。 */
  price: string;
  /** 日付入力欄のYYYY-MM-DD形式。未入力時は空文字。 */
  purchase_date: string;
  category: string;
  memo: string;
};

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
