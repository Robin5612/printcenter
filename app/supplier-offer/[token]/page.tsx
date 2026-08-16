import { PrintcenterApp } from "../../page";

export default async function SupplierOfferRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PrintcenterApp initialRoute="supplier" initialSupplierToken={token} />;
}
