import { useEffect, useState } from "react";

export default function ReceiptList() {
  type Receipt = {
    id: number;
    store_name: string;
    amount: number;
    purchase_date: string;
    category: string;
    memo: string;
  };

  const [receipts, setReceipts] = useState<Receipt[]>([]);

  useEffect(() => {
    async function getReceipts() {
      const response = await fetch("http://localhost:8080/receipts");
      const data = await response.json();

      setReceipts(data);
    }

    getReceipts();
  }, []);

  return (
    <div>
      {receipts.map((receipt) => (
        <div key={receipt.id}>{receipt.store_name}</div>
      ))}
    </div>
  );
}
