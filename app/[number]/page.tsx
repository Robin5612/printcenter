import type { Metadata } from "next";
import { PrintcenterApp } from "../page";

export const metadata: Metadata = {
  title: "Printcenter",
};

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
