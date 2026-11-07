import { isReceipt, type ReceiptInput, type Receipt } from "@/types/receipt";

/** ブラウザが受け取ったHTTPステータスを失わずに画面へ渡す。 */
export class ReceiptClientError extends Error {
  readonly status: number;
  readonly kind: "http" | "network" | "timeout" | "invalid-response";

  constructor(status: number, message: string, kind: ReceiptClientError["kind"] = "http") {
    super(message);
    this.name = "ReceiptClientError";
    this.status = status;
    this.kind = kind;
  }
}

async function requestReceipt(path: string, init: RequestInit): Promise<unknown> {
  const fallback = init.method === "DELETE" ? "削除に失敗しました。" : "保存に失敗しました。";
  let response: Response;
  try {
    response = await fetch(path, { ...init, signal: AbortSignal.timeout(15000) });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    throw new ReceiptClientError(503, timeout
      ? "通信がタイムアウトしました。一覧で結果を確認してから再操作してください。"
      : "接続できませんでした。通信状態と一覧を確認してから再操作してください。",
    timeout ? "timeout" : "network");
  }
  if (response.status === 204) return null;
  if (init.method === "DELETE" && response.ok)
    throw new ReceiptClientError(502, "削除結果を確認できませんでした。一覧を確認してください。", "invalid-response");
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    // エラー本文がHTMLや空でも、HTTPステータスは失わない。
    if (!response.ok) throw new ReceiptClientError(response.status, fallback);
    const timeout = error instanceof Error && error.name === "TimeoutError";
    throw new ReceiptClientError(timeout ? 503 : 502,
      "応答を確認できませんでした。一覧で結果を確認してから再操作してください。",
      timeout ? "timeout" : "invalid-response");
  }
  if (!response.ok) {
    const message = response.status < 500 && data && typeof data === "object" && "message" in data &&
      typeof data.message === "string" && data.message.trim() && data.message !== "処理に失敗しました。"
      ? data.message : fallback;
    throw new ReceiptClientError(response.status, message);
  }
  return data;
}

export async function saveReceipt(input: ReceiptInput, id?: number): Promise<Receipt> {
  const data = await requestReceipt(id === undefined ? "/api/receipts" : `/api/receipts/${id}`, {
    method: id === undefined ? "POST" : "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!isReceipt(data))
    throw new ReceiptClientError(502, "保存結果を確認できませんでした。一覧を確認してから再操作してください。", "invalid-response");
  return data;
}

export async function deleteReceipt(id: number): Promise<void> {
  await requestReceipt(`/api/receipts/${id}`, { method: "DELETE" });
}
