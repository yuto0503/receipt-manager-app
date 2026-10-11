import "server-only";
import { revalidatePath } from "next/cache";
import { ApiError, apiRequest, validId } from "@/lib/receipts";
import { isReceipt } from "@/types/receipt";

export async function mutateReceipt(
  request: Request,
  method: "POST" | "PUT" | "DELETE",
  id?: string,
) {
  try {
    if (id !== undefined && !validId(id))
      throw new ApiError(400, "IDは1以上の整数で指定してください。");
    // ブラウザからの別オリジンの更新を拒否する。
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.headers.get("host"))
      throw new ApiError(403, "この送信元からは操作できません。");
    let body: string | undefined;
    if (method !== "DELETE") {
      if (
        request.headers.get("content-type")?.split(";")[0].trim() !==
        "application/json"
      )
        throw new ApiError(400, "JSON形式で送信してください。");
      let input: unknown;
      try {
        input = await request.json();
      } catch {
        throw new ApiError(400, "JSONの形式が不正です。");
      }
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw new ApiError(400, "JSONオブジェクトを指定してください。");
      body = JSON.stringify(input);
    }
    const data = await apiRequest(id ? `/receipts/${id}` : "/receipts", {
      method,
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (method !== "DELETE" && !isReceipt(data))
      throw new ApiError(
        502,
        "保存結果を確認できませんでした。一覧を確認してください。",
      );
    revalidatePath("/receipts", "layout");
    return method === "DELETE"
      ? new Response(null, { status: 204 })
      : Response.json(data, { status: method === "POST" ? 201 : 200 });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof ApiError ? error.message : "処理に失敗しました。",
      },
      { status: error instanceof ApiError ? error.status : 500 },
    );
  }
}
