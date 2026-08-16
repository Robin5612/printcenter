import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

export type PdfDocumentRecord = {
  number: string;
  type: "Anfrage" | "Angebot" | "Bestellung" | "Auftragsbestätigung";
  status: string;
  date: string;
  customer: string;
  employee: string;
  supplier?: string;
  projectId?: number;
  article: string;
  quantity: number;
  requestedQuantities?: number[];
  unitPrice: number;
  subtotal: number;
  markupPercent: number;
  markupAmount: number;
  total: number;
  deliveryDate?: string;
  supplierLeadTime?: string;
  supplierDeliveryDate?: string;
  supplierDeliveryNote?: string;
  bindingDeliveryConfirmationDue?: string;
  note?: string;
  documentText?: string;
  printFile?: string;
  supplierGzd?: string;
  gzdStatus?: "Freigegeben" | "In Prüfung" | "Abgelehnt";
  offerOptions?: Array<{
    quantity: number;
    unitPrice: number;
    supplierTotal?: number;
  }>;
};

const red = rgb(203 / 255, 0, 61 / 255);
const ink = rgb(19 / 255, 19 / 255, 19 / 255);
const muted = rgb(102 / 255, 102 / 255, 102 / 255);
const sand = rgb(247 / 255, 244 / 255, 239 / 255);
const white = rgb(1, 1, 1);

const money = (value: number) => `CHF ${value.toFixed(2)}`;
const unitMoney = (value: number) => `CHF ${value.toFixed(4)}`;
const safe = (value: string | number | undefined) =>
  String(value ?? "-")
    .replaceAll("’", "'")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("·", "-")
    .replaceAll("→", ">")
    .replaceAll(" ", " ")
    .replaceAll(" ", " ");

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = safe(text).replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size = 9,
  color = ink,
  lineHeight = 13,
) {
  const lines = wrapText(text, font, size, maxWidth);
  lines.forEach((line, index) =>
    page.drawText(line, { x, y: y - index * lineHeight, size, font, color }),
  );
  return y - lines.length * lineHeight;
}

export async function createDocumentPdfDataUri(record: PdfDocumentRecord) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${record.type} ${record.number}`);
  pdf.setAuthor("Printcenter");
  pdf.setSubject(`Projekt ${record.projectId ?? record.number}`);
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.CourierBold);
  const width = page.getWidth();
  const margin = 44;
  const contentWidth = width - margin * 2;
  const hasPrice = record.type !== "Anfrage";
  const customerPriceDocument =
    record.type === "Angebot" || record.type === "Auftragsbestätigung";

  page.drawRectangle({ x: 0, y: 771, width, height: 71, color: ink });
  page.drawRectangle({ x: 0, y: 771, width: 16, height: 71, color: red });
  page.drawText("PRINTCENTER", {
    x: margin,
    y: 807,
    size: 11,
    font: bold,
    color: white,
  });
  page.drawText(safe(record.type).toUpperCase(), {
    x: margin,
    y: 784,
    size: 19,
    font: bold,
    color: white,
  });
  const numberWidth = mono.widthOfTextAtSize(record.number, 11);
  page.drawText(safe(record.number), {
    x: width - margin - numberWidth,
    y: 799,
    size: 11,
    font: mono,
    color: white,
  });
  const statusWidth = bold.widthOfTextAtSize(
    safe(record.status).toUpperCase(),
    8,
  );
  page.drawText(safe(record.status).toUpperCase(), {
    x: width - margin - statusWidth,
    y: 783,
    size: 8,
    font: bold,
    color: red,
  });

  let y = 730;
  page.drawText("BELEGANGABEN", {
    x: margin,
    y,
    size: 8,
    font: bold,
    color: red,
  });
  page.drawText("EMPFÄNGER / PARTNER", {
    x: 330,
    y,
    size: 8,
    font: bold,
    color: red,
  });
  y -= 18;
  page.drawText(`Datum: ${safe(record.date)}`, {
    x: margin,
    y,
    size: 9,
    font: regular,
    color: ink,
  });
  page.drawText(`Projekt: ${safe(record.projectId ?? record.number)}`, {
    x: margin,
    y: y - 15,
    size: 9,
    font: regular,
    color: ink,
  });
  page.drawText(`Kunde: ${safe(record.customer)}`, {
    x: 330,
    y,
    size: 10,
    font: bold,
    color: ink,
  });
  page.drawText(`Login: ${safe(record.employee)}`, {
    x: 330,
    y: y - 15,
    size: 9,
    font: regular,
    color: muted,
  });
  if (!customerPriceDocument)
    page.drawText(`Lieferant: ${safe(record.supplier)}`, {
      x: 330,
      y: y - 30,
      size: 9,
      font: regular,
      color: muted,
    });

  y = 623;
  page.drawRectangle({
    x: margin,
    y,
    width: contentWidth,
    height: 43,
    color: red,
  });
  page.drawText("ARTIKEL", {
    x: margin + 13,
    y: y + 27,
    size: 7,
    font: bold,
    color: white,
  });
  page.drawText(safe(record.article), {
    x: margin + 13,
    y: y + 10,
    size: 12,
    font: bold,
    color: white,
  });

  y = 596;
  if (record.type === "Anfrage") {
    const quantities = record.requestedQuantities?.length
      ? record.requestedQuantities
      : [record.quantity];
    page.drawText("ANGEFRAGTE STAFFELMENGEN", {
      x: margin,
      y,
      size: 8,
      font: bold,
      color: red,
    });
    y -= 28;
    quantities.forEach((quantity, index) => {
      page.drawRectangle({
        x: margin,
        y: y - 8,
        width: contentWidth,
        height: 28,
        color: index % 2 ? sand : white,
        borderColor: sand,
        borderWidth: 1,
      });
      page.drawText(`Staffel ${index + 1}`, {
        x: margin + 12,
        y,
        size: 9,
        font: regular,
        color: muted,
      });
      page.drawText(`${quantity} Stück`, {
        x: width - margin - 92,
        y,
        size: 10,
        font: bold,
        color: ink,
      });
      y -= 28;
    });
    y -= 10;
    page.drawRectangle({
      x: margin,
      y: y - 30,
      width: contentWidth,
      height: 40,
      color: ink,
    });
    page.drawText("PREISANGABEN", {
      x: margin + 12,
      y: y - 4,
      size: 7,
      font: bold,
      color: red,
    });
    page.drawText("Werden durch den Lieferanten im Angebot ergänzt.", {
      x: margin + 12,
      y: y - 19,
      size: 10,
      font: bold,
      color: white,
    });
    y -= 53;
  } else {
    const options =
      record.type === "Angebot" && record.offerOptions?.length
        ? record.offerOptions
        : [{ quantity: record.quantity, unitPrice: record.unitPrice }];
    page.drawText(record.type === "Angebot" ? "ANGEBOTSSTAFFELN" : "POSITION", {
      x: margin,
      y,
      size: 8,
      font: bold,
      color: red,
    });
    y -= 28;
    page.drawRectangle({
      x: margin,
      y: y - 8,
      width: contentWidth,
      height: 26,
      color: ink,
    });
    page.drawText("MENGE", {
      x: margin + 12,
      y,
      size: 8,
      font: bold,
      color: white,
    });
    page.drawText(
      customerPriceDocument ? "PREIS / STK EXKL. MWST." : "PREIS / STK",
      { x: 270, y, size: 7, font: bold, color: white },
    );
    page.drawText(customerPriceDocument ? "TOTAL EXKL. MWST." : "TOTAL", {
      x: 450,
      y,
      size: 7,
      font: bold,
      color: white,
    });
    y -= 26;
    options.forEach((option, index) => {
      const supplierTotal =
        option.supplierTotal ?? option.quantity * option.unitPrice;
      const optionTotal = customerPriceDocument
        ? supplierTotal * (1 + record.markupPercent / 100)
        : supplierTotal;
      const displayedUnitPrice = optionTotal / option.quantity;
      page.drawRectangle({
        x: margin,
        y: y - 8,
        width: contentWidth,
        height: 28,
        color: index % 2 ? sand : white,
        borderColor: sand,
        borderWidth: 1,
      });
      page.drawText(`${option.quantity} Stück`, {
        x: margin + 12,
        y,
        size: 9,
        font: regular,
        color: ink,
      });
      page.drawText(unitMoney(displayedUnitPrice), {
        x: 270,
        y,
        size: 9,
        font: regular,
        color: ink,
      });
      page.drawText(money(optionTotal), {
        x: 450,
        y,
        size: 9,
        font: bold,
        color: ink,
      });
      y -= 28;
    });
    y -= 10;
  }

  const infoTop = y;
  page.drawRectangle({
    x: margin,
    y: infoTop - 63,
    width: 242,
    height: 63,
    color: sand,
  });
  const deliveryLabel =
    record.type === "Angebot" || record.type === "Bestellung"
      ? "VERBINDLICHES LIEFERDATUM"
      : "LIEFERUNG";
  const deliveryText =
    record.type === "Angebot" || record.type === "Bestellung"
      ? [
          record.supplierDeliveryDate ||
            record.supplierLeadTime ||
            "Auf Anfrage",
          record.supplierDeliveryNote,
        ]
          .filter(Boolean)
          .join(" - ")
      : record.deliveryDate || "Auf Anfrage";
  page.drawText(deliveryLabel, {
    x: margin + 12,
    y: infoTop - 17,
    size: 7,
    font: bold,
    color: red,
  });
  drawWrapped(
    page,
    deliveryText,
    margin + 12,
    infoTop - 35,
    215,
    bold,
    9,
    ink,
    11,
  );
  page.drawRectangle({
    x: 309,
    y: infoTop - 63,
    width: 242,
    height: 63,
    color: sand,
  });
  page.drawText("DRUCKDATEN / GZD", {
    x: 321,
    y: infoTop - 17,
    size: 7,
    font: bold,
    color: red,
  });
  drawWrapped(
    page,
    [
      record.supplierGzd || record.printFile || "Keine Datei hinterlegt",
      record.gzdStatus ? `Status: ${record.gzdStatus}` : undefined,
    ]
      .filter(Boolean)
      .join(" - "),
    321,
    infoTop - 37,
    215,
    regular,
    9,
    ink,
    11,
  );
  y = infoTop - 89;

  if (record.note || record.documentText) {
    page.drawText("BEMERKUNG", {
      x: margin,
      y,
      size: 8,
      font: bold,
      color: red,
    });
    y =
      drawWrapped(
        page,
        record.note || record.documentText || "",
        margin,
        y - 18,
        contentWidth,
        regular,
        9,
        ink,
        13,
      ) - 9;
  }

  if (hasPrice) {
    const boxHeight = customerPriceDocument ? 54 : 78;
    const boxY = Math.max(90, y - boxHeight - 10);
    page.drawRectangle({
      x: 309,
      y: boxY,
      width: 242,
      height: boxHeight,
      color: ink,
    });
    if (customerPriceDocument) {
      page.drawText("GESAMTPREIS EXKL. MWST.", {
        x: 321,
        y: boxY + 32,
        size: 8,
        font: bold,
        color: red,
      });
      page.drawText(money(record.total), {
        x: 455,
        y: boxY + 18,
        size: 12,
        font: bold,
        color: white,
      });
    } else {
      page.drawText("ZWISCHENSUMME", {
        x: 321,
        y: boxY + 55,
        size: 7,
        font: bold,
        color: white,
      });
      page.drawText(money(record.subtotal), {
        x: 455,
        y: boxY + 55,
        size: 9,
        font: bold,
        color: white,
      });
      page.drawText("GESAMT", {
        x: 321,
        y: boxY + 15,
        size: 9,
        font: bold,
        color: red,
      });
      page.drawText(money(record.total), {
        x: 455,
        y: boxY + 15,
        size: 11,
        font: bold,
        color: white,
      });
    }
  }

  page.drawLine({
    start: { x: margin, y: 52 },
    end: { x: width - margin, y: 52 },
    thickness: 1,
    color: ink,
  });
  page.drawText("PRINTCENTER - ROT. KLAR. PRODUKTIONSBEREIT.", {
    x: margin,
    y: 35,
    size: 7,
    font: bold,
    color: ink,
  });
  const footer = `${safe(record.number)} - Seite 1 / 1`;
  page.drawText(footer, {
    x: width - margin - regular.widthOfTextAtSize(footer, 7),
    y: 35,
    size: 7,
    font: regular,
    color: muted,
  });

  return pdf.saveAsBase64({ dataUri: true });
}

export function downloadDocumentPdf(dataUri: string, number: string) {
  const link = document.createElement("a");
  link.href = dataUri;
  link.download = `${number}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
