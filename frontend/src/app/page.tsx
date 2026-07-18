export default async function Home() {
  try {
    const response = await fetch(`${process.env.SERVER_API_BASE_URL}/health`);

    if (!response.ok) {
      throw new Error("API Error");
    }
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.log(error);
  }

  return <div>通信成功</div>;
}
