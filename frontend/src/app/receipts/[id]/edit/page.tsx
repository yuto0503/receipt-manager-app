import { notFound } from "next/navigation";
import ReceiptForm from "@/components/ReceiptForm";
import ReceiptError from "@/components/ReceiptError";
import { ApiError, getReceipt } from "@/lib/receipts";

export default async function EditReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let receipt;
  try {
    receipt = await getReceipt(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <ReceiptError
        message={
          error instanceof ApiError ? error.message : "取得に失敗しました。"
        }
      />
    );
  }
  return (
    <>
      <h1 className="mb-6">レシートを編集</h1>
      <ReceiptForm key={receipt.id} receipt={receipt} />
    </>
  );
}
