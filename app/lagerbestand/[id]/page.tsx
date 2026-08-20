import type { Metadata } from "next";
import { StockHistoryView } from "../../stock-history-view";

export const metadata: Metadata = {
  title: "Lagerbestand · Printcenter",
};

export default async function StockHistoryRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StockHistoryView articleId={Number(id)} />;
}
