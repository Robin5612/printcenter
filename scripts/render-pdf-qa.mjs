import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { createDocumentPdfDataUri } from "../app/document-pdf.ts";

const baseRecord = {
  status: "Bestätigt",
  date: "16.08.2026",
  customer: "Müller & Söhne AG",
  employee: "Frau Müller",
  supplier: "Druckerei Zürich AG",
  projectId: 1786847403750,
  article: "Broschüre Zürich · A4",
  quantity: 250,
  unitPrice: 2.1,
  subtotal: 525,
  markupPercent: 12,
  markupAmount: 63,
  total: 588,
  supplierDeliveryDate: "27.08.2026",
  supplierDeliveryNote: "Lieferung nach GzD-Freigabe",
  supplierGzd: "broschüre_zürich_final.pdf",
  gzdStatus: "Freigegeben",
  offerOptions: [
    { quantity: 250, unitPrice: 2.1, supplierTotal: 525 },
    { quantity: 500, unitPrice: 1.8, supplierTotal: 900 },
  ],
};

const records = [
  { ...baseRecord, number: "AN-2026-QA", type: "Angebot" },
  {
    ...baseRecord,
    number: "AB-2026-QA",
    type: "Auftragsbestätigung",
    offerOptions: undefined,
  },
];

const merged = await PDFDocument.create();
for (const record of records) {
  const dataUri = await createDocumentPdfDataUri(record);
  const source = await PDFDocument.load(await (await fetch(dataUri)).arrayBuffer());
  const [page] = await merged.copyPages(source, [0]);
  merged.addPage(page);
}

await mkdir("output/pdf", { recursive: true });
await writeFile(
  "output/pdf/printcenter-kundenbelege-qa.pdf",
  await merged.save(),
);
