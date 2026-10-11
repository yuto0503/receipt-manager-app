import http from "node:http";
let rows = [
  {
    id: 1,
    store_name: "検証用ストア",
    price: 1234,
    purchase_date: "2026-10-08T00:00:00Z",
    category: "食品",
    memo: "確認用\nメモ",
    created_at: "2026-10-08T00:00:00Z",
    updated_at: "2026-10-08T00:00:00Z",
  },
];
let nextId = 2;
http
  .createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    const reply = (status, data) => {
      res.statusCode = status;
      res.end(data === undefined ? undefined : JSON.stringify(data));
    };
    const id = Number(req.url.split("/")[2]);
    if (req.method === "GET") {
      if (req.url === "/receipts") return reply(200, rows);
      if (id === 500) return reply(500, { message: "internal" });
      if (id === 502) {
        res.end("invalid json");
        return;
      }
      const r = rows.find((r) => r.id === id);
      return r
        ? reply(200, r)
        : reply(404, { message: "レシートが存在しません。" });
    }
    if (req.method === "DELETE") {
      const r = rows.find((r) => r.id === id);
      if (!r) return reply(404, { message: "レシートが存在しません。" });
      rows = rows.filter((r) => r.id !== id);
      return reply(204);
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body);
    if (data.store_name === "APIエラー")
      return reply(400, { message: "テスト用の入力エラーです。" });
    if (req.method === "POST") {
      const r = {
        ...data,
        id: nextId++,
        created_at: "2026-10-08T00:00:00Z",
        updated_at: "2026-10-08T00:00:00Z",
      };
      rows.push(r);
      return reply(201, r);
    }
    const r = rows.find((r) => r.id === id);
    if (!r) return reply(404, { message: "レシートが存在しません。" });
    Object.assign(r, data);
    reply(200, r);
  })
  .listen(18080, "127.0.0.1", () => console.log("Mock API ready: 18080"));
