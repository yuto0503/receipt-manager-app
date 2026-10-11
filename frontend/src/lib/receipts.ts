import "server-only";
import { isReceipt, type Receipt } from "@/types/receipt";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function validId(id: string) {
  return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
}

export async function apiRequest(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const base = process.env.SERVER_API_BASE_URL;
  if (!base)
    throw new ApiError(
      503,
      "API接続先が設定されていません。管理者に確認してください。",
    );
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError(
      503,
      "APIに接続できませんでした。時間をおいて再試行してください。",
    );
  }
  if (response.status === 204) return null;
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(502, "APIから正しい応答を受信できませんでした。");
  }
  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string"
        ? data.message
        : "処理に失敗しました。";
    throw new ApiError(
      response.status,
      response.status >= 500
        ? "APIの処理に失敗しました。時間をおいて再試行してください。"
        : message,
    );
  }
  return data;
}

export async function getReceipts(): Promise<Receipt[]> {
  const data = await apiRequest("/receipts");
  if (!Array.isArray(data) || !data.every(isReceipt))
    throw new ApiError(502, "一覧データの形式が不正です。");
  return data.sort(
    (a, b) =>
      b.purchase_date
        .slice(0, 10)
        .localeCompare(a.purchase_date.slice(0, 10)) || b.id - a.id,
  );
}

export async function getReceipt(id: string): Promise<Receipt> {
  if (!validId(id))
    throw new ApiError(400, "IDは1以上の整数で指定してください。");
  const data = await apiRequest(`/receipts/${id}`);
  if (!isReceipt(data))
    throw new ApiError(502, "レシートデータの形式が不正です。");
  return data;
}
