import type { Metadata } from "next";
import { PrintcenterApp } from "../../page";

export const metadata: Metadata = {
  title: "Printcenter",
};

export default async function SupplierOfferRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PrintcenterApp initialRoute="supplier" initialSupplierToken={token} />;
}
