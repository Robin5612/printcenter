import type { Metadata } from "next";
import { PrintcenterApp } from "../page";

export const metadata: Metadata = {
  title: "Printcenter",
};

export default async function CustomerNumberRoute({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ "portal-preview"?: string | string[] }>;
}) {
  const { number } = await params;
  const query = await searchParams;
  const previewValue = query["portal-preview"];
  const previewToken = Array.isArray(previewValue)
    ? previewValue[0]
    : previewValue;
  return (
    <PrintcenterApp
      initialRoute="customer"
      initialPortalNumber={number}
      initialPortalPreviewToken={previewToken}
    />
  );
}
