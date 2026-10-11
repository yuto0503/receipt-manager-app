import type { ReceiptInput } from "../types/receipt";
export type FormValues = {
  store_name: string;
  price: string;
  purchase_date: string;
  category: string;
  memo: string;
};
export type FormErrors = Partial<Record<keyof FormValues, string>>;

// Go strings.TrimSpaceと同じUnicode White_Spaceを必須判定に使う。
const blank = /^\p{White_Space}*$/u;
export function parseReceiptInput(values: FormValues): {
  errors: FormErrors;
  input?: ReceiptInput;
} {
  const errors: FormErrors = {};
  for (const [key, label, max] of [
    ["store_name", "店名", 255],
    ["category", "カテゴリ", 100],
    ["memo", "メモ", 2000],
  ] as const) {
    if (key !== "memo" && blank.test(values[key]))
      errors[key] = `${label}を入力してください。空白のみにはできません。`;
    else if (Array.from(values[key]).length > max)
      errors[key] = `${label}は${max}文字以内で入力してください。`;
  }
  if (
    !/^\d+$/.test(values.price) ||
    !Number.isSafeInteger(Number(values.price)) ||
    Number(values.price) > 2147483647
  )
    errors.price = "金額は0〜2,147,483,647円の整数で入力してください。";
  const date = values.purchase_date;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number(date.slice(0, 4)) < 1000 ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    errors.purchase_date =
      "購入日は1000〜9999年の実在する日付を入力してください。";
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    input: {
      ...values,
      price: Number(values.price),
      purchase_date: `${date}T00:00:00Z`,
    },
  };
}
