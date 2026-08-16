import { mkdir, writeFile } from "node:fs/promises";
import { createDocumentPdfDataUri } from "../app/document-pdf.ts";

const outputDirectory = new URL("../output/pdf/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });

const dataUri = await createDocumentPdfDataUri({
  number: "AN-2026-117",
  type: "Angebot",
  status: "Offen",
  date: "16.08.2026",
  customer: "Studio Nord GmbH",
  employee: "Mara Vogt",
  supplier: "Farbwerk AG",
  projectId: 2026116,
  article: "Flyer Studio Nord - A5",
  quantity: 250,
  requestedQuantities: [250, 500, 1000],
  unitPrice: 0.42,
  subtotal: 105,
  markupPercent: 12,
  markupAmount: 12.6,
  total: 117.6,
  deliveryDate: "30.08.2026",
  supplierDeliveryDate: "30.08.2026",
  supplierDeliveryNote: "Gilt nach Freigabe des Gut zum Druck.",
  note: "Preise inklusive neutraler Verpackung. Alle Preise verstehen sich exklusive Mehrwertsteuer.",
  supplierGzd: "studio-nord_a5_bestaetigt.pdf",
  gzdStatus: "In Prüfung",
  offerOptions: [
    { quantity: 250, unitPrice: 0.42, supplierTotal: 105 },
    { quantity: 500, unitPrice: 0.36, supplierTotal: 180 },
    { quantity: 1000, unitPrice: 0.31, supplierTotal: 310 },
  ],
});

const bytes = Buffer.from(dataUri.split(",")[1], "base64");
await writeFile(new URL("printcenter-angebot-muster.pdf", outputDirectory), bytes);
