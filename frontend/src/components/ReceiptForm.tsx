"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import {
  type Receipt,
  type ReceiptFormValues,
} from "@/types/receipt";
import {
  parseReceiptInput,
  type FormErrors,
} from "@/lib/receipt-input";

import { saveReceipt, ReceiptClientError } from "@/lib/receipt-client";

const hints = {
  store_name: "255文字以内。空白だけでは登録できません。",
  price: "0〜2,147,483,647円の整数を入力してください。",
  purchase_date: "1000〜9999年の日付を選択してください。",
  category: "100文字以内で自由に入力できます。",
  memo: "2,000文字以内。空白や改行もそのまま保存します。",
};

export default function ReceiptForm({ receipt }: { receipt?: Receipt }) {
  const [values, setValues] = useState<ReceiptFormValues>({
    store_name: receipt?.store_name ?? "",
    price: receipt ? String(receipt.price) : "",
    purchase_date: receipt?.purchase_date.slice(0, 10) ?? "",
    category: receipt?.category ?? "",
    memo: receipt?.memo ?? "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [missing, setMissing] = useState(false);
  const sending = useRef(false);
  const cancel = receipt ? `/receipts/${receipt.id}` : "/receipts";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const result = parseReceiptInput(values);
    setErrors(result.errors);
    setMessage("");
    setMissing(false);
    if (!result.input) {
      document.getElementById(Object.keys(result.errors)[0])?.focus();
      return;
    }
    sending.current = true;
    setPending(true);
    try {
      const saved = await saveReceipt(result.input, receipt?.id);
      // 保存後はサーバーから最新の詳細を読み直す。
      window.location.assign(`/receipts/${saved.id}?saved=1`);
      return;
    } catch (error) {
      setMissing(error instanceof ReceiptClientError && error.status === 404);
      setMessage(error instanceof ReceiptClientError ? error.message :
        "保存結果を確認できませんでした。通信状態と一覧を確認してから再操作してください。");
    }
    sending.current = false;
    setPending(false);
  }

  return (
    <form className="panel space-y-5" onSubmit={submit} noValidate>
      {message && (
        <p role="alert" className="text-red-700">
          {message}
        </p>
      )}
      {missing && (
        <p role="alert">対象のレシートは削除されたか存在しません。<Link href="/receipts">一覧へ戻る</Link></p>
      )}
      <fieldset disabled={pending || missing} className="space-y-5">
        {(
          [
            ["store_name", "店名", "text"],
            ["price", "金額（円）", "text"],
            ["purchase_date", "購入日", "date"],
            ["category", "カテゴリ", "text"],
            ["memo", "メモ", "textarea"],
          ] as const
        ).map(([key, label, type]) => (
          <div key={key}>
            <label htmlFor={key} className="mb-2 block font-medium">
              {label}{" "}
              <span className="text-sm">
                {key === "memo" ? "（任意）" : "（必須）"}
              </span>
            </label>
            {type === "textarea" ? (
              <textarea
                id={key}
                name={key}
                rows={4}
                value={values[key]}
                onChange={(e) =>
                  setValues({ ...values, [key]: e.target.value })
                }
                aria-invalid={!!errors[key]}
                aria-describedby={`${key}-hint${errors[key] ? ` ${key}-error` : ""}`}
              />
            ) : (
              <input
                id={key}
                name={key}
                type={type}
                inputMode={key === "price" ? "numeric" : undefined}
                min={type === "date" ? "1000-01-01" : undefined}
                max={type === "date" ? "9999-12-31" : undefined}
                required
                value={values[key]}
                onChange={(e) =>
                  setValues({ ...values, [key]: e.target.value })
                }
                aria-invalid={!!errors[key]}
                aria-describedby={`${key}-hint${errors[key] ? ` ${key}-error` : ""}`}
              />
            )}
            <p id={`${key}-hint`} className="mt-1 text-sm text-slate-600">{hints[key]}</p>
            {errors[key] && (
              <p id={`${key}-error`} className="mt-1 text-sm text-red-700">
                {errors[key]}
              </p>
            )}
          </div>
        ))}
        <div className="actions">
          <button type="submit">{pending ? "保存中…" : "保存する"}</button>
          {!pending && <Link href={cancel}>キャンセル</Link>}
        </div>
      </fieldset>
      {pending && <p role="status">保存しています…</p>}
    </form>
  );
}
