import { PrintcenterApp } from "../page";

export default async function CustomerNumberRoute({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  return (
    <PrintcenterApp initialRoute="customer" initialPortalNumber={number} />
  );
}
