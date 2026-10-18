import "server-only";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function errorMessage(status: number, data: unknown): string {
  if (status >= 500)
    return "APIの処理に失敗しました。時間をおいて再試行してください。";
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string" &&
    data.message.trim()
  )
    return data.message;
  return "処理に失敗しました。";
}

/** Go APIへの通信専用。レスポンスのデータ型は呼び出し側で検証する。 */
export async function apiRequest(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const base = process.env.SERVER_API_BASE_URL?.trim();
  if (!base)
    throw new ApiError(
      503,
      "API接続先が設定されていません。管理者に確認してください。",
    );

  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/+$/, "")}${path}`, {
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
    // HTMLや空のエラー本文でも、404などのHTTPステータスを失わない。
    if (!response.ok)
      throw new ApiError(response.status, errorMessage(response.status, null));
    throw new ApiError(502, "APIから正しい応答を受信できませんでした。");
  }
  if (!response.ok)
    throw new ApiError(response.status, errorMessage(response.status, data));
  return data;
}
