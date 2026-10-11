import { mutateReceipt } from "@/lib/receipt-proxy";
export async function POST(request: Request) {
  return mutateReceipt(request, "POST");
}
