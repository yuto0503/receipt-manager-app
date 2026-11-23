import { mutateReceipt } from "@/lib/receipt-proxy";

// コレクションでは登録だけを公開する。転送先は POST /receipts 固定。
export async function POST(request: Request) {
  return mutateReceipt(request, "POST");
}
