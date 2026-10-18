"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import {
  isReceipt,
  type Receipt,
  type ReceiptFormValues,
} from "@/types/receipt";
import {
  parseReceiptInput,
  type FormErrors,
} from "@/lib/receipt-input";

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
  const sending = useRef(false);
  const cancel = receipt ? `/receipts/${receipt.id}` : "/receipts";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const result = parseReceiptInput(values);
    setErrors(result.errors);
    setMessage("");
    if (!result.input) {
      document.getElementById(Object.keys(result.errors)[0])?.focus();
      return;
    }
    sending.current = true;
    setPending(true);
    try {
      const response = await fetch(
        receipt ? `/api/receipts/${receipt.id}` : "/api/receipts",
        {
          method: receipt ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.input),
        },
      );
      const data: unknown = await response.json();
      if (!response.ok) {
        setMessage(
          data &&
            typeof data === "object" &&
            "message" in data &&
            typeof data.message === "string"
            ? data.message
            : "保存に失敗しました。",
        );
      } else if (isReceipt(data)) {
        // 保存後はサーバーから最新の詳細を読み直す。
        window.location.assign(`/receipts/${data.id}`);
        return;
      } else
        setMessage(
          "保存結果を確認できませんでした。一覧を確認してから再操作してください。",
        );
    } catch {
      setMessage(
        "保存結果を確認できませんでした。通信状態と一覧を確認してから再操作してください。",
      );
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
      <fieldset disabled={pending} className="space-y-5">
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
                aria-describedby={errors[key] ? `${key}-error` : undefined}
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
                aria-describedby={errors[key] ? `${key}-error` : undefined}
              />
            )}
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
