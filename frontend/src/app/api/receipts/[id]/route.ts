import { mutateReceipt } from "@/lib/receipt-proxy";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  return mutateReceipt(request, "PUT", (await context.params).id);
}
export async function DELETE(request: Request, context: Context) {
  return mutateReceipt(request, "DELETE", (await context.params).id);
}
