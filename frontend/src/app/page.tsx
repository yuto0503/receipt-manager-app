export default async function Home() {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/health`,
  );
  const data = await response.json();

  console.log(data);

  return <div>通信成功</div>;
}
