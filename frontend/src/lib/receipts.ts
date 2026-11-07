import "server-only";
import { ApiError, apiRequest } from "@/lib/api";
import { isReceipt, type Receipt } from "@/types/receipt";

export function validId(id: string) {
  return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
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
