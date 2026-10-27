import { isReceipt, type ReceiptInput, type Receipt } from "@/types/receipt";

/** ブラウザが受け取ったHTTPステータスを失わずに画面へ渡す。 */
export class ReceiptClientError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ReceiptClientError";
    this.status = status;
  }
}

export async function saveReceipt(input: ReceiptInput, id?: number): Promise<Receipt> {
  const response = await fetch(id === undefined ? "/api/receipts" : `/api/receipts/${id}`, {
    method: id === undefined ? "POST" : "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const message = data && typeof data === "object" && "message" in data &&
      typeof data.message === "string" && data.message.trim()
      ? data.message : "保存に失敗しました。";
    throw new ReceiptClientError(response.status, message);
  }
  if (!isReceipt(data))
    throw new ReceiptClientError(502, "保存結果を確認できませんでした。一覧を確認してから再操作してください。");
  return data;
}
