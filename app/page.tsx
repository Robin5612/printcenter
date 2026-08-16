"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createDocumentPdfDataUri, downloadDocumentPdf } from "./document-pdf";
import { completeSupplierTier } from "./price-calculation";

type DocumentType =
  | "Anfrage"
  | "Angebot"
  | "Bestellung"
  | "Auftragsbestätigung";
type View =
  | "Übersicht"
  | "Kunden"
  | "Lieferanten"
  | "Belege"
  | "Artikel"
  | "Einstellungen";
type EntryRoute = "customer-home" | "backend" | "customer" | "supplier";
type Salutation = "Frau" | "Herr" | "Divers";
type Employee = {
  id: number;
  name: string;
  salutation?: Salutation;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  login: string;
  password?: string;
  mailToMain: boolean;
};
type Customer = {
  id: number;
  number: string;
  name: string;
  contactSalutation?: Salutation;
  contactFirstName?: string;
  contactLastName?: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  markup: number;
  status: "Aktiv" | "Entwurf";
  turnover: number;
  employees: Employee[];
};
type Supplier = {
  id: number;
  number: string;
  name: string;
  group: string;
  contact: string;
  email: string;
  phone: string;
};
type GzdTemplate = { id: number; file: string; addedAt: string; url?: string };
type StockEvent = {
  date: string;
  change: number;
  stock: number;
  reason: string;
};
type Article = {
  id: number;
  sku: string;
  designation1: string;
  designation2: string;
  name: string;
  customerId?: number;
  supplier: string;
  stock: number;
  minimum: number;
  unitPrice: number;
  stockHistory: StockEvent[];
  templates: GzdTemplate[];
};
type OfferOption = {
  quantity: number;
  unitPrice: number;
  supplierTotal?: number;
};
type GzdStatus = "Freigegeben" | "In Prüfung" | "Abgelehnt";
type DocumentItem = {
  articleId: number;
  sku: string;
  article: string;
  quantity: number;
  requestedQuantities?: number[];
  unitPrice: number;
  subtotal: number;
  markupAmount: number;
  total: number;
  printFile?: string;
  printFileUrl?: string;
  supplierGzd?: string;
  supplierGzdUrl?: string;
  gzdStatus?: GzdStatus;
  offerOptions?: OfferOption[];
};
type DocumentRecord = {
  id: number;
  number: string;
  type: DocumentType;
  customerId: number;
  customer: string;
  employeeId?: number;
  employee: string;
  supplier?: string;
  supplierId?: number;
  supplierToken?: string;
  projectId?: number;
  articleId?: number;
  article: string;
  quantity: number;
  requestedQuantities?: number[];
  unitPrice: number;
  subtotal: number;
  markupPercent: number;
  markupAmount: number;
  total: number;
  date: string;
  createdAt?: string;
  deliveryDate?: string;
  supplierLeadTime?: string;
  supplierDeliveryDate?: string;
  supplierDeliveryNote?: string;
  bindingDeliveryConfirmationDue?: string;
  note?: string;
  requestText?: string;
  documentText?: string;
  attachDocument?: boolean;
  attachGzd?: boolean;
  printFile?: string;
  printFileUrl?: string;
  supplierGzd?: string;
  supplierGzdUrl?: string;
  supplierNote?: string;
  gzdStatus?: GzdStatus;
  offerOptions?: OfferOption[];
  items?: DocumentItem[];
  pdfUrl?: string;
  status: "Offen" | "Versendet" | "Bestätigt";
};
type WorkflowSettings = {
  requestTemplate: string;
  offerTemplate: string;
  orderTemplate: string;
  confirmationTemplate: string;
  employeeLoginSubject: string;
  employeeLoginTemplate: string;
  supplierOfferSubject: string;
  offerEmail: string;
  orderEmail: string;
  attachRequestDocument: boolean;
  attachRequestGzd: boolean;
  attachOfferDocument: boolean;
  attachOfferGzd: boolean;
  attachOrderDocument: boolean;
  attachOrderGzd: boolean;
  attachConfirmationDocument: boolean;
  attachConfirmationGzd: boolean;
};
type BackendUser = {
  id: number;
  name: string;
  email: string;
  role: "Admin" | "Sachbearbeitung";
  password: string;
  active: boolean;
};
type PersistedState = {
  initialized: boolean;
  customers: Customer[];
  suppliers: Supplier[];
  groups: string[];
  articles: Article[];
  documents: DocumentRecord[];
  backendUsers: BackendUser[];
  workflowSettings?: WorkflowSettings;
};
type IntegrationSettings = {
  navisionEndpoint: string;
  navisionTenant: string;
  apiBaseUrl: string;
  apiClientId: string;
  ftpProtocol: "SFTP" | "FTP";
  ftpHost: string;
  ftpPort: string;
  ftpUsername: string;
  ftpDirectory: string;
};
type EmailSecurity = "tls" | "starttls" | "none";
type EmailSender = {
  id: number;
  label: string;
  provider: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  smtpHost: string;
  smtpPort: number;
  security: EmailSecurity;
  username: string;
  passwordConfigured: boolean;
  active: boolean;
  isDefault: boolean;
  lastTestedAt?: string | null;
  lastTestStatus?: string | null;
};
type EmailSenderDraft = Omit<
  EmailSender,
  "id" | "passwordConfigured" | "lastTestedAt" | "lastTestStatus"
> & { password: string };

const navItems: View[] = [
  "Übersicht",
  "Kunden",
  "Lieferanten",
  "Belege",
  "Artikel",
  "Einstellungen",
];
const documentTypes: DocumentType[] = [
  "Anfrage",
  "Angebot",
  "Bestellung",
  "Auftragsbestätigung",
];
const portalDocumentTypes: DocumentType[] = [
  "Anfrage",
  "Angebot",
  "Auftragsbestätigung",
];
const formatMoney = (value: number) => {
  const [integer, decimals] = value.toFixed(2).split(".");
  return `CHF ${integer.replace(/\B(?=(\d{3})+(?!\d))/g, "’")}.${decimals}`;
};
const formatUnitMoney = (value: number) => `CHF ${value.toFixed(4)}`;
const backendSessionStorageKey = "printcenter:backend-session:v1";
const customerSessionStorageKey = "printcenter:customer-session:v1";
const supplierTotalForOption = (option: OfferOption) =>
  option.supplierTotal ?? option.quantity * option.unitPrice;
const customerTotalForOption = (option: OfferOption, markupPercent: number) =>
  supplierTotalForOption(option) * (1 + markupPercent / 100);
const splitPersonName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
};
const employeeDisplayName = (employee: Employee) => {
  const fallback = splitPersonName(employee.name);
  return [
    employee.firstName || fallback.firstName,
    employee.lastName || fallback.lastName,
  ]
    .filter(Boolean)
    .join(" ");
};
const articleNameFromDesignations = (
  designation1: string,
  designation2: string,
) => [designation1.trim(), designation2.trim()].filter(Boolean).join(" · ");
const normalizeArticle = (article: Article): Article => {
  const legacyParts = String(article.name || "").split(" · ");
  const designation1 = String(article.designation1 || legacyParts[0] || "").trim();
  const designation2 = String(
    article.designation2 || legacyParts.slice(1).join(" · ") || "",
  ).trim();
  return {
    ...article,
    designation1,
    designation2,
    name: articleNameFromDesignations(designation1, designation2),
  };
};
type StockSignal = "rot" | "gelb" | "grün";
const stockSignalFor = (article: Article): StockSignal =>
  article.stock < 0
    ? "rot"
    : article.stock <= article.minimum
      ? "gelb"
      : "grün";
async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(
      payload.error || "Die Änderung konnte nicht gespeichert werden.",
    );
  return payload;
}
const storedFileUrls = new Map<string, string>();
async function uploadStoredFile(file: File) {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/files", { method: "POST", body });
  const payload = (await response.json()) as {
    name?: string;
    url?: string;
    error?: string;
  };
  if (!response.ok || !payload.name || !payload.url)
    throw new Error(
      payload.error || "Die Datei konnte nicht gespeichert werden.",
    );
  storedFileUrls.set(payload.name, payload.url);
  return { name: payload.name, url: payload.url };
}
function downloadTextFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (!lines.length) return [];
  const delimiter =
    (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const parseLine = (line: string) => {
    const cells: string[] = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = !quoted;
      else if (character === delimiter && !quoted) {
        cells.push(value.trim());
        value = "";
      } else value += character;
    }
    cells.push(value.trim());
    return cells;
  };
  const headers = parseLine(lines[0]).map((header) => header.toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""]),
    );
  });
}
const today = () =>
  new Intl.DateTimeFormat("de-CH", { dateStyle: "medium" }).format(new Date());
const formatPortalDate = (value: string) => {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : value;
};
const documentCreatedAt = (document: DocumentRecord) => {
  if (document.createdAt) {
    const timestamp = Date.parse(document.createdAt);
    if (Number.isFinite(timestamp)) return timestamp;
  }
  const match = document.date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), 12).getTime();
  }
  const timestamp = Date.parse(document.date);
  return Number.isFinite(timestamp) ? timestamp : 0;
};
const gzdDateTimestamp = (value: string) => {
  const swissDate = value.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/,
  );
  if (swissDate) {
    const [, day, month, year, hours = "0", minutes = "0"] = swissDate;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
    ).getTime();
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};
type ArticleGzdFile = {
  id: number;
  key: string;
  name: string;
  url?: string;
  source: string;
  addedAt: string;
  timestamp: number;
};
const collectArticleGzdFiles = (
  article: Article,
  documents: DocumentRecord[],
): ArticleGzdFile[] => {
  const articleDocuments = documents.filter(
    (document) =>
      document.articleId === article.id ||
      document.items?.some((item) => item.articleId === article.id) ||
      (!document.articleId && document.article === article.name),
  );
  const files: ArticleGzdFile[] = [
    ...article.templates.map((template) => ({
      id: template.id,
      key: `template-${template.id}`,
      name: template.file,
      url: template.url,
      source: "Artikelvorlage",
      addedAt: template.addedAt,
      timestamp: gzdDateTimestamp(template.addedAt),
    })),
    ...articleDocuments.flatMap((document) => {
      const addedAt = `${document.number} · ${document.date}`;
      const timestamp = documentCreatedAt(document);
      const documentFiles: ArticleGzdFile[] = [];
      const documentItem = document.items?.find(
        (item) => item.articleId === article.id,
      );
      if (documentItem?.supplierGzd)
        documentFiles.push({
          id: document.id * 1000 + article.id * 2 + 1,
          key: `supplier-${document.id}-${article.id}-${documentItem.supplierGzd}`,
          name: documentItem.supplierGzd,
          url: documentItem.supplierGzdUrl,
          source: "Vom Lieferanten",
          addedAt,
          timestamp,
        });
      if (documentItem?.printFile)
        documentFiles.push({
          id: document.id * 1000 + article.id * 2,
          key: `customer-${document.id}-${article.id}-${documentItem.printFile}`,
          name: documentItem.printFile,
          url: documentItem.printFileUrl,
          source: "Vom Kunden",
          addedAt,
          timestamp,
        });
      if (documentItem) return documentFiles;
      if (document.supplierGzd)
        documentFiles.push({
          id: document.id * 2 + 1,
          key: `supplier-${document.id}-${document.supplierGzd}`,
          name: document.supplierGzd,
          url: document.supplierGzdUrl,
          source: "Vom Lieferanten",
          addedAt,
          timestamp,
        });
      if (document.printFile)
        documentFiles.push({
          id: document.id * 2,
          key: `customer-${document.id}-${document.printFile}`,
          name: document.printFile,
          url: document.printFileUrl,
          source: "Vom Kunden",
          addedAt,
          timestamp,
        });
      return documentFiles;
    }),
  ];
  return files
    .sort((left, right) => right.timestamp - left.timestamp)
    .filter((file, index, sortedFiles) => {
      const signature = file.url ? `url:${file.url}` : `name:${file.name}`;
      return (
        sortedFiles.findIndex((candidate) =>
          candidate.url
            ? `url:${candidate.url}` === signature
            : `name:${candidate.name}` === signature,
        ) === index
      );
    });
};
const renderTemplate = (
  template: string,
  values: Record<string, string | number>,
) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
const workflowForDocument = (
  type: DocumentType,
  settings: WorkflowSettings,
) => {
  if (type === "Anfrage")
    return {
      template: settings.requestTemplate,
      attachDocument: settings.attachRequestDocument,
      attachGzd: settings.attachRequestGzd,
    };
  if (type === "Angebot")
    return {
      template: settings.offerTemplate,
      attachDocument: settings.attachOfferDocument,
      attachGzd: settings.attachOfferGzd,
    };
  if (type === "Bestellung")
    return {
      template: settings.orderTemplate,
      attachDocument: settings.attachOrderDocument,
      attachGzd: settings.attachOrderGzd,
    };
  return {
    template: settings.confirmationTemplate,
    attachDocument: settings.attachConfirmationDocument,
    attachGzd: settings.attachConfirmationGzd,
  };
};

const initialCustomers: Customer[] = [
  {
    id: 1,
    number: "K-10024",
    name: "Studio Nord GmbH",
    contactSalutation: "Frau",
    contactFirstName: "Mara",
    contactLastName: "Vogt",
    email: "hello@studionord.ch",
    phone: "+41 44 211 08 60",
    street: "Nordstrasse 24",
    postalCode: "8006",
    city: "Zürich",
    country: "Schweiz",
    markup: 12,
    status: "Aktiv",
    turnover: 18420,
    employees: [
      {
        id: 11,
        name: "Mara Vogt",
        salutation: "Frau",
        firstName: "Mara",
        lastName: "Vogt",
        email: "mara.vogt@studionord.ch",
        phone: "+41 79 610 22 14",
        login: "mara.vogt@studionord.ch",
        mailToMain: true,
      },
      {
        id: 12,
        name: "Jonas Lenz",
        salutation: "Herr",
        firstName: "Jonas",
        lastName: "Lenz",
        email: "jonas.lenz@studionord.ch",
        phone: "+41 79 820 09 11",
        login: "jonas.lenz@studionord.ch",
        mailToMain: false,
      },
    ],
  },
  {
    id: 2,
    number: "K-10031",
    name: "Café Cobalt",
    contactSalutation: "Frau",
    contactFirstName: "Lina",
    contactLastName: "Ziegler",
    email: "hallo@cafecobalt.ch",
    phone: "+41 44 330 41 10",
    street: "Cobaltweg 8",
    postalCode: "8005",
    city: "Zürich",
    country: "Schweiz",
    markup: 18,
    status: "Aktiv",
    turnover: 7860,
    employees: [
      {
        id: 21,
        name: "Lina Ziegler",
        salutation: "Frau",
        firstName: "Lina",
        lastName: "Ziegler",
        email: "lina@cafecobalt.ch",
        phone: "+41 78 920 05 16",
        login: "lina@cafecobalt.ch",
        mailToMain: true,
      },
      {
        id: 22,
        name: "Noel Marti",
        salutation: "Divers",
        firstName: "Noel",
        lastName: "Marti",
        email: "noel@cafecobalt.ch",
        phone: "+41 76 880 14 70",
        login: "noel@cafecobalt.ch",
        mailToMain: false,
      },
    ],
  },
  {
    id: 3,
    number: "K-10037",
    name: "Atelier Riedel",
    contactSalutation: "Herr",
    contactFirstName: "Nils",
    contactLastName: "Riedel",
    email: "mail@atelier-riedel.ch",
    phone: "+41 61 690 18 08",
    street: "Werkhofstrasse 17",
    postalCode: "4058",
    city: "Basel",
    country: "Schweiz",
    markup: 10,
    status: "Aktiv",
    turnover: 4280,
    employees: [
      {
        id: 31,
        name: "Nils Riedel",
        salutation: "Herr",
        firstName: "Nils",
        lastName: "Riedel",
        email: "nils@atelier-riedel.ch",
        phone: "+41 79 777 28 19",
        login: "nils@atelier-riedel.ch",
        mailToMain: true,
      },
    ],
  },
];
const initialSuppliers: Supplier[] = [
  {
    id: 1,
    number: "L-2011",
    name: "Papierwerk Süd",
    group: "Papier",
    contact: "Julia Keller",
    email: "jkeller@papierwerk-sued.de",
    phone: "+49 761 441 63 10",
  },
  {
    id: 2,
    number: "L-2034",
    name: "Farbwerk AG",
    group: "Veredelung",
    contact: "Andreas Haas",
    email: "a.haas@farbwerk.ch",
    phone: "+41 71 811 24 81",
  },
  {
    id: 3,
    number: "L-2052",
    name: "Die Buchbinderei",
    group: "Weiterverarbeitung",
    contact: "Sarah Winter",
    email: "s.winter@buchbinderei.ch",
    phone: "+41 44 770 15 00",
  },
];
const initialArticles: Article[] = [
  {
    id: 1,
    sku: "VIS-COB-350",
    designation1: "Visitenkarten Cobalt",
    designation2: "350 g",
    name: "Visitenkarten Cobalt · 350 g",
    customerId: 2,
    supplier: "Papierwerk Süd",
    stock: 520,
    minimum: 200,
    unitPrice: 0.22,
    stockHistory: [
      { date: "14.08.2026", change: 520, stock: 520, reason: "Startbestand" },
    ],
    templates: [
      {
        id: 101,
        file: "cobalt_visitenkarte.pdf",
        addedAt: "14.08.2026, 08:32",
      },
    ],
  },
  {
    id: 2,
    sku: "FLY-NRD-A5",
    designation1: "Flyer Studio Nord",
    designation2: "A5",
    name: "Flyer Studio Nord · A5",
    customerId: 1,
    supplier: "Farbwerk AG",
    stock: 80,
    minimum: 150,
    unitPrice: 0.48,
    stockHistory: [
      { date: "14.08.2026", change: 80, stock: 80, reason: "Startbestand" },
    ],
    templates: [
      { id: 102, file: "studio-nord_a5.pdf", addedAt: "13.08.2026, 16:08" },
    ],
  },
  {
    id: 3,
    sku: "BCH-RIE-01",
    designation1: "Lookbook Riedel",
    designation2: "48 Seiten",
    name: "Lookbook Riedel · 48 Seiten",
    customerId: 3,
    supplier: "Die Buchbinderei",
    stock: 34,
    minimum: 50,
    unitPrice: 8.9,
    stockHistory: [
      { date: "14.08.2026", change: 34, stock: 34, reason: "Startbestand" },
    ],
    templates: [],
  },
];
const initialDocuments: DocumentRecord[] = [
  {
    id: 1,
    number: "AB-2026-041",
    type: "Auftragsbestätigung",
    customerId: 1,
    customer: "Studio Nord GmbH",
    employeeId: 11,
    employee: "Mara Vogt",
    projectId: 1001,
    articleId: 2,
    article: "Flyer Studio Nord · A5",
    quantity: 500,
    unitPrice: 0.48,
    subtotal: 240,
    markupPercent: 12,
    markupAmount: 28.8,
    total: 268.8,
    date: "14.08.2026",
    status: "Bestätigt",
  },
  {
    id: 2,
    number: "BE-2026-078",
    type: "Bestellung",
    customerId: 2,
    customer: "Café Cobalt",
    employeeId: 21,
    employee: "Lina Ziegler",
    projectId: 1002,
    articleId: 1,
    article: "Visitenkarten Cobalt · 350 g",
    quantity: 1000,
    unitPrice: 0.22,
    subtotal: 220,
    markupPercent: 0,
    markupAmount: 0,
    total: 220,
    date: "13.08.2026",
    status: "Versendet",
  },
  {
    id: 3,
    number: "AN-2026-112",
    type: "Angebot",
    customerId: 3,
    customer: "Atelier Riedel",
    employeeId: 31,
    employee: "Nils Riedel",
    projectId: 1003,
    articleId: 3,
    article: "Lookbook Riedel · 48 Seiten",
    quantity: 80,
    unitPrice: 8.9,
    subtotal: 712,
    markupPercent: 10,
    markupAmount: 71.2,
    total: 783.2,
    date: "12.08.2026",
    status: "Offen",
  },
];
const initialBackendUsers: BackendUser[] = [
  {
    id: 1,
    name: "Robin Lanfranchi",
    email: "admin@printcenter.local",
    role: "Admin",
    password: "printcenter",
    active: true,
  },
  {
    id: 2,
    name: "Nora Keller",
    email: "nora@printcenter.local",
    role: "Sachbearbeitung",
    password: "produktion",
    active: true,
  },
];
const initialWorkflowSettings: WorkflowSettings = {
  requestTemplate:
    "Guten Tag {supplier},\n\n{customer} fragt {quantity} Stück {article} an.\nWunsch-Lieferdatum: {deliveryDate}\n\n{note}\n\nBitte Preise und GzD über den sicheren Link eintragen.",
  offerTemplate:
    "Guten Tag {customer},\n\nIhre Offerte {project} für {article} ist bereit.",
  orderTemplate:
    "Guten Tag Lieferant,\n\nBestellung {project} wurde ausgelöst.",
  confirmationTemplate:
    "Guten Tag {customer},\n\nIhre Auftragsbestätigung {project} ist bereit.",
  employeeLoginSubject: "Ihr Zugang zum Printcenter von {company}",
  employeeLoginTemplate:
    "Guten Tag {salutation} {lastName},\n\nIhr persönlicher Zugang zum Kundenportal von {company} ist eingerichtet.\n\nPortal: {portalUrl}\nLogin: {email}\nPasswort: {password}\n\nBitte bewahren Sie diese Zugangsdaten sicher auf.\n\nFreundliche Grüsse\nPrintcenter",
  supplierOfferSubject: "Neue Lieferantenofferte für {project}",
  offerEmail: "angebote@printcenter.ch",
  orderEmail: "",
  attachRequestDocument: true,
  attachRequestGzd: true,
  attachOfferDocument: true,
  attachOfferGzd: true,
  attachOrderDocument: true,
  attachOrderGzd: true,
  attachConfirmationDocument: true,
  attachConfirmationGzd: true,
};

function Monogram({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`monogram ${small ? "monogram--small" : ""}`}
      aria-hidden="true"
    >
      <i />
      <b />
    </span>
  );
}
function Status({ children }: { children: string }) {
  return (
    <span
      className={`status status--${children.toLowerCase().replace("ä", "ae")}`}
    >
      {children}
    </span>
  );
}

export function PrintcenterApp({
  initialRoute,
  initialPortalNumber,
  initialSupplierToken,
}: {
  initialRoute: EntryRoute;
  initialPortalNumber?: string;
  initialSupplierToken?: string;
}) {
  const [view, setView] = useState<View>("Übersicht");
  const [customers, setCustomers] = useState(initialCustomers);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [groups, setGroups] = useState([
    "Papier",
    "Veredelung",
    "Weiterverarbeitung",
  ]);
  const [articles, setArticles] = useState(initialArticles);
  const [documents, setDocuments] = useState(initialDocuments);
  const [customerForm, setCustomerForm] = useState<"new" | number | null>(null);
  const [supplierForm, setSupplierForm] = useState<"new" | number | null>(null);
  const [articleForm, setArticleForm] = useState<"new" | number | null>(null);
  const [documentForm, setDocumentForm] = useState<DocumentType | null>(null);
  const [documentFocusId, setDocumentFocusId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState("");
  const [, setNotice] = useState("");
  const [portalSession, setPortalSession] = useState<{
    customerId: number;
    employeeId: number;
    source: "customer" | "backend-preview";
  } | null>(null);
  const [portalRoute, setPortalRoute] = useState<string | null>(
    initialRoute === "customer" ? (initialPortalNumber ?? null) : null,
  );
  const [supplierRoute, setSupplierRoute] = useState<string | null>(
    initialRoute === "supplier" ? (initialSupplierToken ?? null) : null,
  );
  const [backendUsers, setBackendUsers] = useState(initialBackendUsers);
  const [backendSession, setBackendSession] = useState<BackendUser | null>(
    null,
  );
  const [workflowSettings, setWorkflowSettings] = useState<WorkflowSettings>(
    initialWorkflowSettings,
  );
  const [databaseReady, setDatabaseReady] = useState(false);
  const [backendClock, setBackendClock] = useState("");
  const [backendNow, setBackendNow] = useState(0);
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const date = new Intl.DateTimeFormat("de-CH", {
        dateStyle: "long",
        timeZone: "Europe/Zurich",
      }).format(now);
      const time = new Intl.DateTimeFormat("de-CH", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Zurich",
      }).format(now);
      setBackendClock(`${date} · ${time}`);
      setBackendNow(now.getTime());
    };
    const initialTimer = window.setTimeout(updateClock, 0);
    const interval = window.setInterval(updateClock, 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    let active = true;
    void apiRequest<PersistedState>("/api/state")
      .then(async (stored) => {
        const normalizedStoredArticles = stored.articles.map(normalizeArticle);
        const hasOriginalDemoDirectory = initialCustomers.every(
          (demoCustomer) =>
            stored.customers.some(
              (customer) => customer.number === demoCustomer.number,
            ),
        );
        const bootstrapArticles = normalizedStoredArticles.length
          ? normalizedStoredArticles
          : hasOriginalDemoDirectory
            ? initialArticles
            : [];
        const validBootstrapArticleIds = new Set(
          bootstrapArticles.map((article) => article.id),
        );
        const bootstrapDocuments = stored.documents.length
          ? stored.documents
          : hasOriginalDemoDirectory
            ? initialDocuments.filter(
                (document) =>
                  stored.customers.some(
                    (customer) => customer.id === document.customerId,
                  ) &&
                  (!document.articleId ||
                    validBootstrapArticleIds.has(document.articleId)),
              )
            : [];
        const state = stored.initialized
          ? {
              customers: stored.customers,
              suppliers: stored.suppliers,
              groups: stored.groups,
              articles: normalizedStoredArticles,
              documents: stored.documents,
              backendUsers: stored.backendUsers,
              workflowSettings: {
                ...initialWorkflowSettings,
                ...(stored.workflowSettings ?? {}),
              },
            }
          : {
              customers: stored.customers,
              suppliers: stored.suppliers,
              groups: stored.groups,
              articles: bootstrapArticles,
              documents: bootstrapDocuments,
              backendUsers: stored.backendUsers.length
                ? stored.backendUsers
                : initialBackendUsers,
              workflowSettings: {
                ...initialWorkflowSettings,
                ...(stored.workflowSettings ?? {}),
              },
            };
        if (!stored.initialized)
          await apiRequest<{ ok: boolean }>("/api/state", {
            method: "PUT",
            body: JSON.stringify(state),
          });
        if (!active) return;
        setCustomers(state.customers);
        setSuppliers(state.suppliers);
        setGroups(state.groups);
        setArticles(state.articles);
        setDocuments(state.documents);
        setBackendUsers(state.backendUsers);
        setWorkflowSettings(state.workflowSettings);
        setDatabaseReady(true);
      })
      .catch(() => {
        if (active)
          setNotice(
            "Die dauerhafte Speicherung ist vorübergehend nicht erreichbar; die Vorschaudaten bleiben sichtbar.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!databaseReady) return;
    const timer = window.setTimeout(() => {
      const persistedDocuments = documents.map((document) => ({
        ...document,
        pdfUrl: undefined,
      }));
      void apiRequest<{ ok: boolean }>("/api/state", {
        method: "PUT",
        body: JSON.stringify({
          customers,
          suppliers,
          groups,
          articles,
          documents: persistedDocuments,
          backendUsers,
          workflowSettings,
        }),
      }).catch(() =>
        setNotice(
          "Eine Änderung konnte nicht dauerhaft gespeichert werden. Bitte erneut versuchen.",
        ),
      );
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    databaseReady,
    customers,
    suppliers,
    groups,
    articles,
    documents,
    backendUsers,
    workflowSettings,
  ]);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!databaseReady) return;
    try {
      if (initialRoute === "backend" && !backendSession) {
        const storedBackend = window.localStorage.getItem(
          backendSessionStorageKey,
        );
        if (storedBackend) {
          const { userId } = JSON.parse(storedBackend) as { userId?: number };
          const account = backendUsers.find(
            (user) => user.id === userId && user.active,
          );
          if (account) setBackendSession(account);
          else window.localStorage.removeItem(backendSessionStorageKey);
        }
      }
      if (
        initialRoute !== "backend" &&
        initialRoute !== "supplier" &&
        !portalSession
      ) {
        const storedCustomer = window.localStorage.getItem(
          customerSessionStorageKey,
        );
        if (storedCustomer) {
          const { customerId, employeeId } = JSON.parse(storedCustomer) as {
            customerId?: number;
            employeeId?: number;
          };
          const customer = customers.find((item) => item.id === customerId);
          const employee = customer?.employees.find(
            (item) => item.id === employeeId,
          );
          const routeMatches =
            initialRoute !== "customer" ||
            !initialPortalNumber ||
            customer?.number.toLowerCase() ===
              initialPortalNumber.toLowerCase();
          if (customer && employee && routeMatches) {
            setPortalRoute(customer.number);
            setPortalSession({
              customerId: customer.id,
              employeeId: employee.id,
              source: "customer",
            });
          } else if (!customer || !employee) {
            window.localStorage.removeItem(customerSessionStorageKey);
          }
        }
      }
    } catch {
      window.localStorage.removeItem(backendSessionStorageKey);
      window.localStorage.removeItem(customerSessionStorageKey);
    }
  }, [
    backendSession,
    backendUsers,
    customers,
    databaseReady,
    initialPortalNumber,
    initialRoute,
    portalSession,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    if (!name) return;
    const draft = {
      name,
      contactSalutation: String(
        data.get("contactSalutation") || "Divers",
      ) as Salutation,
      contactFirstName: String(data.get("contactFirstName") || "").trim(),
      contactLastName: String(data.get("contactLastName") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      street: String(data.get("street") || "").trim(),
      postalCode: String(data.get("postalCode") || "").trim(),
      city: String(data.get("city") || "").trim(),
      country: String(data.get("country") || "Schweiz").trim(),
      markup: Number(data.get("markup") || 0),
    };
    try {
      if (typeof customerForm === "number") {
        const updated = await apiRequest<Customer>(
          `/api/customers/${customerForm}`,
          { method: "PUT", body: JSON.stringify(draft) },
        );
        setCustomers((current) =>
          current.map((customer) =>
            customer.id === customerForm ? updated : customer,
          ),
        );
        setNotice(`${name} wurde dauerhaft aktualisiert.`);
      } else {
        const next = await apiRequest<Customer>("/api/customers", {
          method: "POST",
          body: JSON.stringify(draft),
        });
        setCustomers((current) => [...current, next]);
        setNotice(`${name} wurde dauerhaft als Kunde angelegt.`);
      }
      setCustomerForm(null);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Der Kunde konnte nicht gespeichert werden.",
      );
    }
  }
  async function deleteCustomer(customer: Customer) {
    try {
      await apiRequest<{ ok: boolean }>(`/api/customers/${customer.id}`, {
        method: "DELETE",
      });
      const remaining = customers.filter((item) => item.id !== customer.id);
      setCustomers(remaining);
      setArticles((current) =>
        current.map((article) =>
          article.customerId === customer.id
            ? { ...article, customerId: undefined }
            : article,
        ),
      );
      setCustomerForm(null);
      setNotice(
        `${customer.name} wurde dauerhaft gelöscht. Zugeordnete Artikel bleiben ohne Kundenverbindung erhalten.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Der Kunde konnte nicht gelöscht werden.",
      );
    }
  }
  async function addEmployee(
    event: FormEvent<HTMLFormElement>,
    customerId: number,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const firstName = String(data.get("firstName") || "").trim();
    const lastName = String(data.get("lastName") || "").trim();
    const name = [firstName, lastName].filter(Boolean).join(" ");
    const email = String(data.get("email") || "")
      .trim()
      .toLowerCase();
    if (!name || !email) return;
    if (
      customers.some((customer) =>
        customer.employees.some(
          (employee) => employee.email.toLowerCase() === email,
        ),
      )
    ) {
      setNotice(`Die Login-Mail „${email}“ ist bereits vergeben.`);
      return;
    }
    const draft = {
      name,
      salutation: String(data.get("salutation") || "Divers") as Salutation,
      firstName,
      lastName,
      email,
      phone: String(data.get("phone") || "").trim(),
      password: String(data.get("initialPassword") || "portal"),
      mailToMain:
        String(data.get("mailDelivery") || "employee") === "main-and-employee",
    };
    try {
      const employee = await apiRequest<Employee>(
        `/api/customers/${customerId}/employees`,
        { method: "POST", body: JSON.stringify(draft) },
      );
      setCustomers((current) =>
        current.map((customer) =>
          customer.id === customerId
            ? { ...customer, employees: [...customer.employees, employee] }
            : customer,
        ),
      );
      event.currentTarget.reset();
      setNotice(
        `${name} hat jetzt einen dauerhaft gespeicherten Portalzugang.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Der Portalzugang konnte nicht gespeichert werden.",
      );
    }
  }
  async function updateEmployee(
    customerId: number,
    employeeId: number,
    data: {
      name: string;
      salutation: Salutation;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      password: string;
      mailToMain: boolean;
    },
  ) {
    const email = data.email.trim().toLowerCase();
    const duplicate = customers.some((customer) =>
      customer.employees.some(
        (employee) =>
          employee.id !== employeeId && employee.email.toLowerCase() === email,
      ),
    );
    if (duplicate) {
      setNotice(`Die Login-Mail „${email}“ ist bereits vergeben.`);
      return false;
    }
    try {
      const employee = await apiRequest<Employee>(
        `/api/customers/${customerId}/employees/${employeeId}`,
        { method: "PUT", body: JSON.stringify({ ...data, email }) },
      );
      setCustomers((current) =>
        current.map((customer) =>
          customer.id === customerId
            ? {
                ...customer,
                employees: customer.employees.map((item) =>
                  item.id === employeeId ? employee : item,
                ),
              }
            : customer,
        ),
      );
      setDocuments((current) =>
        current.map((document) =>
          document.employeeId === employeeId
            ? {
                ...document,
                employee: [data.firstName, data.lastName]
                  .filter(Boolean)
                  .join(" "),
              }
            : document,
        ),
      );
      setNotice(
        `${data.name} und der Portalzugang wurden dauerhaft aktualisiert.`,
      );
      return true;
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Der Portalzugang konnte nicht aktualisiert werden.",
      );
      return false;
    }
  }
  async function deleteEmployee(customerId: number, employee: Employee) {
    try {
      await apiRequest<{ ok: boolean }>(
        `/api/customers/${customerId}/employees/${employee.id}`,
        { method: "DELETE" },
      );
      setCustomers((current) =>
        current.map((customer) =>
          customer.id === customerId
            ? {
                ...customer,
                employees: customer.employees.filter(
                  (item) => item.id !== employee.id,
                ),
              }
            : customer,
        ),
      );
      setNotice(`${employee.name} wurde dauerhaft als Mitarbeiter entfernt.`);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Der Mitarbeiter konnte nicht gelöscht werden.",
      );
    }
  }
  async function sendEmployeeLogin(customerId: number, employeeId: number) {
    await apiRequest<{ ok: boolean }>(
      `/api/customers/${customerId}/employees/${employeeId}/send-login`,
      { method: "POST", body: JSON.stringify({}) },
    );
  }
  function updateArticleMinimum(articleId: number, minimum: number) {
    setArticles((current) =>
      current.map((article) =>
        article.id === articleId
          ? { ...article, minimum: Math.max(0, minimum) }
          : article,
      ),
    );
    setNotice("Der Meldebestand wurde vom Kunden aktualisiert.");
  }
  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    if (!name) return;
    const draft = {
      name,
      group: String(data.get("group") || groups[0]),
      contact: String(data.get("contact") || ""),
      email: String(data.get("email") || ""),
      phone: String(data.get("phone") || ""),
    };
    try {
      if (typeof supplierForm === "number") {
        const updated = await apiRequest<Supplier>(
          `/api/suppliers/${supplierForm}`,
          { method: "PUT", body: JSON.stringify(draft) },
        );
        setSuppliers((current) =>
          current.map((supplier) =>
            supplier.id === supplierForm ? updated : supplier,
          ),
        );
        setNotice(`${name} wurde dauerhaft aktualisiert.`);
      } else {
        const next = await apiRequest<Supplier>("/api/suppliers", {
          method: "POST",
          body: JSON.stringify(draft),
        });
        setSuppliers((current) => [...current, next]);
        setNotice(`${name} wurde dauerhaft als Lieferant angelegt.`);
      }
      setSupplierForm(null);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Der Lieferant konnte nicht gespeichert werden.",
      );
    }
  }
  async function deleteSupplier(supplier: Supplier) {
    try {
      await apiRequest<{ ok: boolean }>(`/api/suppliers/${supplier.id}`, {
        method: "DELETE",
      });
      const remaining = suppliers.filter((item) => item.id !== supplier.id);
      setSuppliers(remaining);
      setArticles((current) =>
        current.map((article) =>
          article.supplier === supplier.name
            ? { ...article, supplier: "Nicht zugeordnet" }
            : article,
        ),
      );
      setSupplierForm(null);
      setNotice(
        `${supplier.name} wurde dauerhaft gelöscht. Betroffene Artikel sind jetzt nicht zugeordnet.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Der Lieferant konnte nicht gelöscht werden.",
      );
    }
  }
  async function addGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = groupName.trim();
    if (!name || groups.includes(name)) return;
    try {
      await apiRequest<{ name: string }>("/api/supplier-groups", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setGroups((current) => [...current, name]);
      setGroupName("");
      setNotice(`Die Gruppe „${name}“ ist dauerhaft angelegt.`);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Die Gruppe konnte nicht gespeichert werden.",
      );
    }
  }
  async function deleteGroup(name: string) {
    try {
      await apiRequest<{ ok: boolean }>(
        `/api/supplier-groups/${encodeURIComponent(name)}`,
        { method: "DELETE" },
      );
      setGroups((current) => current.filter((group) => group !== name));
      setSuppliers((current) =>
        current.map((supplier) =>
          supplier.group === name
            ? { ...supplier, group: "Ohne Gruppe" }
            : supplier,
        ),
      );
      setArticles((current) =>
        current.map((article) =>
          article.supplier === `group:${name}`
            ? { ...article, supplier: "Nicht zugeordnet" }
            : article,
        ),
      );
      setNotice(`Die Lieferantengruppe „${name}“ wurde dauerhaft gelöscht.`);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Die Gruppe konnte nicht gelöscht werden.",
      );
    }
  }
  function saveArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const designation1 = String(data.get("designation1") || "").trim();
    const designation2 = String(data.get("designation2") || "").trim();
    const name = articleNameFromDesignations(designation1, designation2);
    if (!designation1) return;
    const articleId = Number(data.get("articleId") || 0);
    const customerValue = String(data.get("customerId") || "");
    const enteredSku = String(data.get("sku") || "").trim();
    const draft = {
      sku: enteredSku || `ART-${String(Date.now()).slice(-6)}`,
      designation1,
      designation2,
      name,
      customerId: customerValue ? Number(customerValue) : undefined,
      supplier: String(data.get("supplier") || "Nicht zugeordnet"),
      stock: Number(data.get("stock") || 0),
      minimum: Number(data.get("minimum") || 0),
      unitPrice: Number(data.get("unitPrice") || 0),
    };
    if (articleId > 0) {
      setArticles((current) =>
        current.map((article) => {
          if (article.id !== articleId) return article;
          const stockHistory =
            article.stock === draft.stock
              ? article.stockHistory
              : [
                  {
                    date: today(),
                    change: draft.stock - article.stock,
                    stock: draft.stock,
                    reason: "Bestand im Backend angepasst",
                  },
                  ...article.stockHistory,
                ];
          return { ...article, ...draft, stockHistory };
        }),
      );
      setNotice(`${name} wurde aktualisiert.`);
    } else {
      setArticles((current) => [
        ...current,
        {
          id: Date.now(),
          ...draft,
          stockHistory: [
            {
              date: today(),
              change: draft.stock,
              stock: draft.stock,
              reason: "Startbestand",
            },
          ],
          templates: [],
        },
      ]);
      setNotice(`${name} wurde im Artikelsortiment eröffnet.`);
    }
    setArticleForm(null);
  }
  function deleteArticle(article: Article) {
    setArticles((current) => current.filter((item) => item.id !== article.id));
    setNotice(`${article.name} wurde gelöscht.`);
  }
  async function attachTemplate(
    event: ChangeEvent<HTMLInputElement>,
    articleId: number,
  ) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const stored = await uploadStoredFile(file);
      const template = {
        id: Date.now(),
        file: stored.name,
        url: stored.url,
        addedAt: new Intl.DateTimeFormat("de-CH", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date()),
      };
      setArticles((current) =>
        current.map((article) =>
          article.id === articleId
            ? { ...article, templates: [template, ...article.templates] }
            : article,
        ),
      );
      setNotice(
        `${file.name} wurde mit Zeitstempel als GzD-Vorlage im Dateispeicher hinterlegt.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Die GzD-Datei konnte nicht gespeichert werden.",
      );
    }
    input.value = "";
  }
  function createDocument(data: {
    type: DocumentType;
    customerId: number;
    employeeId?: number;
    articleId: number;
    quantity: number;
    unitPrice: number;
  }) {
    const customer = customers.find((item) => item.id === data.customerId);
    const employee = customer?.employees.find(
      (item) => item.id === data.employeeId,
    );
    const article = articles.find((item) => item.id === data.articleId);
    if (!customer || !article) return;
    const unitPrice = data.type === "Anfrage" ? 0 : data.unitPrice;
    const subtotal = data.quantity * unitPrice;
    const markupPercent = data.type === "Bestellung" ? 0 : customer.markup;
    const markupAmount =
      data.type === "Anfrage" ? 0 : (subtotal * markupPercent) / 100;
    const prefixes: Record<DocumentType, string> = {
      Anfrage: "AF",
      Angebot: "AN",
      Bestellung: "BE",
      Auftragsbestätigung: "AB",
    };
    const id = Date.now();
    const number = `${prefixes[data.type]}-2026-${String(documents.length + 113).padStart(3, "0")}`;
    const workflow = workflowForDocument(data.type, workflowSettings);
    const next: DocumentRecord = {
      id,
      number,
      type: data.type,
      customerId: customer.id,
      customer: customer.name,
      employeeId: employee?.id,
      employee: employee?.name ?? "Nicht zugeordnet",
      supplier: article.supplier,
      projectId: id,
      articleId: article.id,
      article: article.name,
      quantity: data.quantity,
      requestedQuantities:
        data.type === "Anfrage" ? [data.quantity] : undefined,
      unitPrice,
      subtotal,
      markupPercent,
      markupAmount,
      total: subtotal + markupAmount,
      date: today(),
      createdAt: new Date().toISOString(),
      documentText: renderTemplate(workflow.template, {
        supplier: article.supplier,
        customer: customer.name,
        article: article.name,
        quantity: data.quantity,
        quantities: data.quantity,
        deliveryDate: "auf Anfrage",
        note: "",
        project: number,
      }),
      attachDocument: workflow.attachDocument,
      attachGzd: workflow.attachGzd,
      status: "Offen",
    };
    setDocuments((current) => [next, ...current]);
    setDocumentForm(null);
    setNotice(
      `${next.type} ${next.number} wurde für ${customer.name} angelegt.`,
    );
  }
  async function createCustomerRequest(data: {
    customerId: number;
    employeeId: number;
    articleId: number;
    quantities: number[];
    deliveryDate: string;
    note: string;
    printFile?: string;
    printFileUrl?: string;
  }) {
    const customer = customers.find((item) => item.id === data.customerId);
    const employee = customer?.employees.find(
      (item) => item.id === data.employeeId,
    );
    const article = articles.find((item) => item.id === data.articleId);
    const groupName = article?.supplier.startsWith("group:")
      ? article.supplier.slice(6)
      : undefined;
    const supplier = suppliers.find((item) => item.name === article?.supplier);
    if (!customer || !employee || !article) return;
    const requestedQuantities = data.quantities
      .map(Number)
      .filter((quantity) => quantity > 0)
      .slice(0, 5);
    if (!requestedQuantities.length) return;
    const quantity = requestedQuantities[0];
    const quantitiesText = requestedQuantities
      .map((value) => `${value} Stück`)
      .join(", ");
    const targetLabel = groupName
      ? `Lieferantengruppe · ${groupName}`
      : (supplier?.name ?? article.supplier);
    const id = Date.now();
    const number = `AF-2026-${String(documents.length + 113).padStart(3, "0")}`;
    const supplierToken = `SUP-${id}`;
    const requestText = renderTemplate(workflowSettings.requestTemplate, {
      supplier: targetLabel,
      customer: customer.name,
      quantity: quantitiesText,
      quantities: quantitiesText,
      article: article.name,
      deliveryDate: data.deliveryDate,
      note: data.note || "Keine Bemerkung",
      project: number,
    });
    const requestWorkflow = workflowForDocument("Anfrage", workflowSettings);
    const next: DocumentRecord = {
      id,
      number,
      type: "Anfrage",
      customerId: customer.id,
      customer: customer.name,
      employeeId: employee.id,
      employee: employee.name,
      supplier: targetLabel,
      supplierId: supplier?.id,
      supplierToken,
      projectId: id,
      articleId: article.id,
      article: article.name,
      quantity,
      requestedQuantities,
      unitPrice: 0,
      subtotal: 0,
      markupPercent: customer.markup,
      markupAmount: 0,
      total: 0,
      date: today(),
      createdAt: new Date().toISOString(),
      deliveryDate: data.deliveryDate,
      note: data.note,
      requestText,
      documentText: requestText,
      attachDocument: requestWorkflow.attachDocument,
      attachGzd: requestWorkflow.attachGzd,
      printFile: data.printFile,
      printFileUrl: data.printFileUrl,
      status: "Versendet",
    };
    setDocuments((current) => [next, ...current]);
    try {
      const result = await apiRequest<{
        ok: boolean;
        sent: number;
        failed: number;
        attachmentCount: number;
        warning?: string;
        message: string;
      }>("/api/request-emails", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer.id,
          employeeId: employee.id,
          articleId: article.id,
          number: next.number,
          projectId: next.projectId,
          supplierToken,
          quantities: requestedQuantities,
          deliveryDate: data.deliveryDate,
          note: data.note,
          printFile: data.printFile,
          printFileUrl: data.printFileUrl,
        }),
      });
      const message = [result.message, result.warning].filter(Boolean).join(" ");
      setNotice(`Anfrage ${next.number}: ${message}`);
      window.dispatchEvent(
        new CustomEvent("printcenter:request-mail-status", {
          detail: { status: "sent", message },
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Die Lieferantenmail konnte nicht versendet werden.";
      setNotice(
        `Anfrage ${next.number} wurde erstellt, aber die Lieferantenmail ist fehlgeschlagen: ${message}`,
      );
      window.dispatchEvent(
        new CustomEvent("printcenter:request-mail-status", {
          detail: { status: "error", message },
        }),
      );
    }
  }
  async function createCollectiveCustomerRequest(data: {
    customerId: number;
    employeeId: number;
    supplier: string;
    items: Array<{
      articleId: number;
      quantities: number[];
      printFile?: string;
      printFileUrl?: string;
    }>;
    deliveryDate: string;
    note: string;
  }) {
    const customer = customers.find((item) => item.id === data.customerId);
    const employee = customer?.employees.find(
      (item) => item.id === data.employeeId,
    );
    const selectedArticles = data.items
      .map((item) => ({
        input: item,
        article: articles.find((article) => article.id === item.articleId),
      }))
      .filter(
        (entry): entry is { input: (typeof data.items)[number]; article: Article } =>
          Boolean(entry.article),
      );
    if (
      !customer ||
      !employee ||
      !selectedArticles.length ||
      selectedArticles.some(
        ({ article }) =>
          article.customerId !== customer.id || article.supplier !== data.supplier,
      )
    )
      return;
    const items: DocumentItem[] = selectedArticles.map(({ input, article }) => {
      const requestedQuantities = input.quantities
        .map(Number)
        .filter((quantity) => quantity > 0)
        .slice(0, 5);
      return {
        articleId: article.id,
        sku: article.sku,
        article: article.name,
        quantity: requestedQuantities[0],
        requestedQuantities,
        unitPrice: 0,
        subtotal: 0,
        markupAmount: 0,
        total: 0,
        printFile: input.printFile,
        printFileUrl: input.printFileUrl,
      };
    });
    if (items.some((item) => !item.requestedQuantities?.length)) return;
    const groupName = data.supplier.startsWith("group:")
      ? data.supplier.slice(6)
      : undefined;
    const supplier = suppliers.find((item) => item.name === data.supplier);
    const targetLabel = groupName
      ? `Lieferantengruppe · ${groupName}`
      : supplier?.name || data.supplier;
    const id = Date.now();
    const number = `AF-2026-${String(documents.length + 113).padStart(3, "0")}`;
    const supplierToken = `SUP-${id}`;
    const requestWorkflow = workflowForDocument("Anfrage", workflowSettings);
    const requestText = renderTemplate(workflowSettings.requestTemplate, {
      supplier: targetLabel,
      customer: customer.name,
      quantity: `${items.length} Artikel`,
      quantities: `${items.length} Artikel mit individuellen Staffelgrössen`,
      article: `Sammelanfrage mit ${items.length} Artikeln`,
      deliveryDate: data.deliveryDate,
      note: data.note || "Keine Bemerkung",
      project: number,
    });
    const first = items[0];
    const next: DocumentRecord = {
      id,
      number,
      type: "Anfrage",
      customerId: customer.id,
      customer: customer.name,
      employeeId: employee.id,
      employee: employee.name,
      supplier: targetLabel,
      supplierId: supplier?.id,
      supplierToken,
      projectId: id,
      articleId: first.articleId,
      article: `Sammelanfrage · ${items.length} Artikel`,
      quantity: first.quantity,
      requestedQuantities: first.requestedQuantities,
      unitPrice: 0,
      subtotal: 0,
      markupPercent: customer.markup,
      markupAmount: 0,
      total: 0,
      date: today(),
      createdAt: new Date().toISOString(),
      deliveryDate: data.deliveryDate,
      note: data.note,
      requestText,
      documentText: requestText,
      attachDocument: requestWorkflow.attachDocument,
      attachGzd: requestWorkflow.attachGzd,
      items,
      status: "Versendet",
    };
    setDocuments((current) => [next, ...current]);
    try {
      const result = await apiRequest<{
        ok: boolean;
        sent: number;
        failed: number;
        warning?: string;
        message: string;
      }>("/api/collective-request-emails", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer.id,
          employeeId: employee.id,
          number,
          projectId: id,
          supplierToken,
          deliveryDate: data.deliveryDate,
          note: data.note,
          items: items.map((item) => ({
            articleId: item.articleId,
            quantities: item.requestedQuantities,
            printFile: item.printFile,
            printFileUrl: item.printFileUrl,
          })),
        }),
      });
      const message = [result.message, result.warning].filter(Boolean).join(" ");
      setNotice(`Sammelanfrage ${number}: ${message}`);
      window.dispatchEvent(
        new CustomEvent("printcenter:request-mail-status", {
          detail: { status: "sent", message },
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Die Lieferantenmail konnte nicht versendet werden.";
      setNotice(
        `Sammelanfrage ${number} wurde erstellt, aber die Lieferantenmail ist fehlgeschlagen: ${message}`,
      );
      window.dispatchEvent(
        new CustomEvent("printcenter:request-mail-status", {
          detail: { status: "error", message },
        }),
      );
    }
  }
  async function submitSupplierOffer(data: {
    requestId: number;
    options?: OfferOption[];
    items?: Array<{
      articleId: number;
      options: OfferOption[];
      gzd?: string;
      gzdUrl?: string;
    }>;
    deliveryDate: string;
    deliveryNote?: string;
    gzd?: string;
    gzdUrl?: string;
    note?: string;
  }) {
    const request = documents.find(
      (item) => item.id === data.requestId && item.type === "Anfrage",
    );
    const collective = Boolean(request?.items?.length);
    if (
      !request ||
      !data.deliveryDate ||
      (collective
        ? !data.items?.length
        : !data.options?.length)
    ) {
      window.dispatchEvent(
        new CustomEvent("printcenter:supplier-offer-result", {
          detail: {
            status: "error",
            message: "Die Angebotsdaten sind unvollständig.",
          },
        }),
      );
      return;
    }
    const customer = customers.find((item) => item.id === request.customerId);
    if (!customer) {
      window.dispatchEvent(
        new CustomEvent("printcenter:supplier-offer-result", {
          detail: {
            status: "error",
            message: "Der Kunde der Anfrage wurde nicht gefunden.",
          },
        }),
      );
      return;
    }
    if (
      request.items?.some(
        (requestItem) =>
          !data.items?.find((item) => item.articleId === requestItem.articleId)
            ?.options.length,
      )
    ) {
      window.dispatchEvent(
        new CustomEvent("printcenter:supplier-offer-result", {
          detail: {
            status: "error",
            message: "Bei mindestens einem Artikel fehlen die Staffelpreise.",
          },
        }),
      );
      return;
    }
    const offerItems: DocumentItem[] | undefined = request.items?.map(
      (requestItem) => {
        const submittedItem = data.items!.find(
          (item) => item.articleId === requestItem.articleId,
        )!;
        const firstOption = submittedItem.options[0];
        const itemSubtotal = supplierTotalForOption(firstOption);
        const itemMarkupAmount = (itemSubtotal * customer.markup) / 100;
        return {
          ...requestItem,
          quantity: firstOption.quantity,
          unitPrice: firstOption.unitPrice,
          subtotal: itemSubtotal,
          markupAmount: itemMarkupAmount,
          total: itemSubtotal + itemMarkupAmount,
          supplierGzd: submittedItem.gzd,
          supplierGzdUrl:
            submittedItem.gzdUrl ||
            (submittedItem.gzd === requestItem.printFile
              ? requestItem.printFileUrl
              : submittedItem.gzd
                ? storedFileUrls.get(submittedItem.gzd)
                : undefined),
          gzdStatus: submittedItem.gzd ? "In Prüfung" : undefined,
          offerOptions: submittedItem.options,
        };
      },
    );
    const first = offerItems?.[0]?.offerOptions?.[0] ?? data.options?.[0];
    if (!first) return;
    const subtotal = offerItems?.length
      ? offerItems.reduce((sum, item) => sum + item.subtotal, 0)
      : supplierTotalForOption(first);
    const markupAmount = (subtotal * customer.markup) / 100;
    const id = Date.now();
    const number = `AN-2026-${String(documents.length + 113).padStart(3, "0")}`;
    const offerWorkflow = workflowForDocument("Angebot", workflowSettings);
    const documentText = renderTemplate(offerWorkflow.template, {
      supplier: request.supplier ?? "Lieferant",
      customer: customer.name,
      article: collective
        ? `Sammelofferte mit ${offerItems?.length ?? 0} Artikeln`
        : request.article,
      quantity: first.quantity,
      deliveryDate: data.deliveryDate,
      note: data.deliveryNote ?? data.note ?? request.note ?? "",
      project: request.projectId ?? request.id,
      total: subtotal + markupAmount,
    });
    const supplierGzdUrl =
      data.gzdUrl ??
      (data.gzd === request.printFile
        ? request.printFileUrl
        : data.gzd
          ? storedFileUrls.get(data.gzd)
          : undefined);
    const offer: DocumentRecord = {
      ...request,
      id,
      number,
      type: "Angebot",
      projectId: request.projectId ?? request.id,
      quantity: first.quantity,
      unitPrice: first.unitPrice,
      subtotal,
      markupAmount,
      total: subtotal + markupAmount,
      date: today(),
      createdAt: new Date().toISOString(),
      pdfUrl: undefined,
      supplierDeliveryDate: data.deliveryDate,
      supplierDeliveryNote: data.deliveryNote?.trim() || undefined,
      supplierLeadTime: undefined,
      documentText,
      attachDocument: offerWorkflow.attachDocument,
      attachGzd: offerWorkflow.attachGzd,
      supplierGzd: data.gzd,
      supplierGzdUrl,
      supplierNote: data.note,
      gzdStatus: data.gzd ? "In Prüfung" : undefined,
      offerOptions: collective ? undefined : data.options,
      items: offerItems,
      status: "Offen",
    };
    let mailMessage = "";
    let mailError = "";
    try {
      const result = await apiRequest<{
        ok: boolean;
        sent: number;
        failed: number;
        attachmentCount: number;
        warning?: string;
        message: string;
      }>(collective ? "/api/collective-offer-emails" : "/api/offer-emails", {
        method: "POST",
        body: JSON.stringify({
          requestId: request.id,
          supplierToken: request.supplierToken,
          offerNumber: offer.number,
          options: data.options,
          items: data.items,
          deliveryDate: data.deliveryDate,
          deliveryNote: data.deliveryNote,
          gzd: data.gzd,
          gzdUrl: supplierGzdUrl,
          note: data.note,
        }),
      });
      mailMessage = [result.message, result.warning].filter(Boolean).join(" ");
    } catch (error) {
      mailError =
        error instanceof Error
          ? error.message
          : "Die Angebotsmail konnte nicht versendet werden.";
    }
    setDocuments((current) => [
      offer,
      ...current.map((item) =>
        item.id === request.id
          ? { ...item, pdfUrl: undefined, status: "Bestätigt" as const }
          : item,
      ),
    ]);
    setNotice(
      mailError
        ? `Angebot ${offer.number} wurde gespeichert, aber die Kundenmail ist fehlgeschlagen: ${mailError}`
        : `Angebot ${offer.number}: ${mailMessage}`,
    );
    window.dispatchEvent(
      new CustomEvent("printcenter:supplier-offer-result", {
        detail: { status: "success", offerNumber: offer.number },
      }),
    );
  }
  async function acceptOffer(
    offerId: number,
    quantity: number,
    itemQuantities?: Record<string, number>,
  ) {
    const offer = documents.find(
      (item) => item.id === offerId && item.type === "Angebot",
    );
    if (!offer) return;
    const option = offer.offerOptions?.find(
      (item) => item.quantity === quantity,
    ) ?? { quantity, unitPrice: offer.unitPrice };
    const selectedItems = offer.items?.map((item) => {
      const selectedQuantity = itemQuantities?.[String(item.articleId)] ?? item.quantity;
      const selectedOption =
        item.offerOptions?.find(
          (offerOption) => offerOption.quantity === selectedQuantity,
        ) ?? {
          quantity: selectedQuantity,
          unitPrice: item.unitPrice,
          supplierTotal: item.subtotal,
        };
      const itemSubtotal = supplierTotalForOption(selectedOption);
      const itemCustomerTotal = customerTotalForOption(
        selectedOption,
        offer.markupPercent,
      );
      return {
        source: item,
        option: selectedOption,
        subtotal: itemSubtotal,
        customerTotal: itemCustomerTotal,
      };
    });
    const orderSubtotal = selectedItems?.length
      ? selectedItems.reduce((sum, item) => sum + item.subtotal, 0)
      : supplierTotalForOption(option);
    const customerTotal = selectedItems?.length
      ? selectedItems.reduce((sum, item) => sum + item.customerTotal, 0)
      : customerTotalForOption(option, offer.markupPercent);
    const orderId = Date.now();
    const confirmationId = orderId + 1;
    const orderNumber = `BE-2026-${String(documents.length + 113).padStart(3, "0")}`;
    const confirmationNumber = `AB-2026-${String(documents.length + 114).padStart(3, "0")}`;
    const orderWorkflow = workflowForDocument("Bestellung", workflowSettings);
    const confirmationWorkflow = workflowForDocument(
      "Auftragsbestätigung",
      workflowSettings,
    );
    const bindingNotice = offer.supplierDeliveryDate
      ? `Das vom Lieferanten eingetragene Lieferdatum ${offer.supplierDeliveryDate} ist bei Bestellung innerhalb von 72 Stunden nach Angebotsabgabe verbindlich.`
      : "";
    const orderText = renderTemplate(orderWorkflow.template, {
      supplier: offer.supplier ?? "Lieferant",
      customer: offer.customer,
      article: offer.article,
      quantity: selectedItems?.length
        ? `${selectedItems.length} Artikel`
        : option.quantity,
      deliveryDate:
        offer.supplierDeliveryDate ?? offer.deliveryDate ?? "auf Anfrage",
      note: offer.supplierDeliveryNote ?? offer.supplierNote ?? "",
      project: offer.projectId ?? offer.id,
      total: orderSubtotal,
    });
    const orderItems: DocumentItem[] | undefined = selectedItems?.map(
      ({ source, option: selectedOption, subtotal: itemSubtotal }) => ({
        ...source,
        quantity: selectedOption.quantity,
        unitPrice: selectedOption.unitPrice,
        subtotal: itemSubtotal,
        markupAmount: 0,
        total: itemSubtotal,
        requestedQuantities: undefined,
        offerOptions: undefined,
      }),
    );
    const order: DocumentRecord = {
      ...offer,
      id: orderId,
      number: orderNumber,
      type: "Bestellung",
      quantity: orderItems?.[0]?.quantity ?? option.quantity,
      unitPrice: orderItems?.[0]?.unitPrice ?? option.unitPrice,
      subtotal: orderSubtotal,
      markupPercent: 0,
      markupAmount: 0,
      total: orderSubtotal,
      date: today(),
      createdAt: new Date(orderId).toISOString(),
      pdfUrl: undefined,
      bindingDeliveryConfirmationDue: undefined,
      documentText: [orderText, bindingNotice].filter(Boolean).join("\n\n"),
      note: [offer.supplierDeliveryNote, offer.supplierNote, bindingNotice]
        .filter(Boolean)
        .join("\n\n"),
      attachDocument: orderWorkflow.attachDocument,
      attachGzd: orderWorkflow.attachGzd,
      offerOptions: selectedItems?.length ? undefined : offer.offerOptions,
      items: orderItems,
      status: "Versendet",
    };
    const confirmationText = renderTemplate(confirmationWorkflow.template, {
      supplier: offer.supplier ?? "Lieferant",
      customer: offer.customer,
      article: offer.article,
      quantity: selectedItems?.length
        ? `${selectedItems.length} Artikel`
        : option.quantity,
      deliveryDate:
        offer.supplierDeliveryDate ?? offer.deliveryDate ?? "auf Anfrage",
      note: offer.supplierDeliveryNote ?? offer.supplierNote ?? "",
      project: offer.projectId ?? offer.id,
      total: customerTotal,
      date: today(),
      createdAt: new Date(confirmationId).toISOString(),
    });
    const confirmationItems: DocumentItem[] | undefined = selectedItems?.map(
      ({ source, option: selectedOption, subtotal: itemSubtotal, customerTotal: itemTotal }) => ({
        ...source,
        quantity: selectedOption.quantity,
        unitPrice: selectedOption.unitPrice,
        subtotal: itemSubtotal,
        markupAmount: itemTotal - itemSubtotal,
        total: itemTotal,
        requestedQuantities: undefined,
        offerOptions: undefined,
      }),
    );
    const confirmation: DocumentRecord = {
      ...offer,
      id: confirmationId,
      number: confirmationNumber,
      type: "Auftragsbestätigung",
      quantity: confirmationItems?.[0]?.quantity ?? option.quantity,
      unitPrice: confirmationItems?.[0]?.unitPrice ?? option.unitPrice,
      subtotal: orderSubtotal,
      markupPercent: offer.markupPercent,
      markupAmount: customerTotal - orderSubtotal,
      total: customerTotal,
      pdfUrl: undefined,
      documentText: confirmationText,
      note: [offer.supplierDeliveryNote, offer.supplierNote]
        .filter(Boolean)
        .join("\n\n"),
      attachDocument: confirmationWorkflow.attachDocument,
      attachGzd: confirmationWorkflow.attachGzd,
      offerOptions: selectedItems?.length ? undefined : offer.offerOptions,
      items: confirmationItems,
      status: "Bestätigt",
    };
    setDocuments((current) => [
      confirmation,
      order,
      ...current.map((item) =>
        item.id === offer.id
          ? { ...item, pdfUrl: undefined, status: "Bestätigt" as const }
          : item,
      ),
    ]);
    try {
      const result = await apiRequest<{ ok: boolean; message: string }>(
        "/api/order-emails",
        {
          method: "POST",
          body: JSON.stringify({
            offerId: offer.id,
            orderNumber: order.number,
            quantity,
            itemQuantities,
          }),
        },
      );
      setNotice(
        `Bestellung ${order.number} wurde intern gemeldet und Auftragsbestätigung ${confirmation.number} erzeugt. ${result.message}`,
      );
    } catch (error) {
      setNotice(
        `Bestellung ${order.number} und Auftragsbestätigung ${confirmation.number} wurden erzeugt, aber die interne Bestellmail ist fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
      );
    }
  }
  function rejectOffer(offerId: number) {
    const offer = documents.find(
      (item) => item.id === offerId && item.type === "Angebot",
    );
    if (!offer) return;
    const projectId = offer.projectId ?? offer.id;
    setDocuments((current) =>
      current.filter(
        (item) =>
          !(
            item.projectId === projectId &&
            (item.type === "Anfrage" || item.type === "Angebot")
          ),
      ),
    );
    setNotice(
      `Angebot ${offer.number} und alle zugehörigen Anfragebelege wurden gelöscht.`,
    );
  }
  function updateDocument(data: {
    id: number;
    customerId: number;
    employeeId?: number;
    articleId: number;
    quantity: number;
    unitPrice: number;
    deliveryDate?: string;
    note?: string;
    status: DocumentRecord["status"];
  }) {
    const customer = customers.find((item) => item.id === data.customerId);
    const article = articles.find((item) => item.id === data.articleId);
    const employee = customer?.employees.find(
      (item) => item.id === data.employeeId,
    );
    if (!customer || !article) return;
    setDocuments((current) =>
      current.map((document) => {
        if (document.id !== data.id) return document;
        const unitPrice = document.type === "Anfrage" ? 0 : data.unitPrice;
        const subtotal = data.quantity * unitPrice;
        const markupPercent =
          document.type === "Bestellung" ? 0 : customer.markup;
        const markupAmount =
          document.type === "Anfrage" ? 0 : (subtotal * markupPercent) / 100;
        return {
          ...document,
          customerId: customer.id,
          customer: customer.name,
          employeeId: employee?.id,
          employee: employee?.name ?? "Nicht zugeordnet",
          supplier: article.supplier,
          articleId: article.id,
          article: article.name,
          quantity: data.quantity,
          requestedQuantities:
            document.type === "Anfrage"
              ? [data.quantity]
              : document.requestedQuantities,
          unitPrice,
          subtotal,
          markupPercent,
          markupAmount,
          total: subtotal + markupAmount,
          deliveryDate: data.deliveryDate,
          note: data.note,
          pdfUrl: undefined,
          status: data.status,
        };
      }),
    );
    setNotice(
      "Der Beleg wurde vollständig aktualisiert und das PDF neu erzeugt.",
    );
  }
  function deleteDocument(document: DocumentRecord) {
    setDocuments((current) =>
      current.filter((item) => item.id !== document.id),
    );
    setNotice(`${document.number} wurde gelöscht.`);
  }
  useEffect(() => {
    const missing = documents.filter((document) => !document.pdfUrl);
    if (!missing.length) return;
    let active = true;
    void Promise.all(
      missing.map(async (document) => ({
        id: document.id,
        pdfUrl: await createDocumentPdfDataUri(document),
      })),
    ).then((generated) => {
      if (!active) return;
      const urls = new Map(generated.map((item) => [item.id, item.pdfUrl]));
      setDocuments((current) =>
        current.map((document) =>
          urls.has(document.id)
            ? { ...document, pdfUrl: urls.get(document.id) }
            : document,
        ),
      );
    });
    return () => {
      active = false;
    };
  }, [documents]);
  useEffect(() => {
    const onRequest = (event: Event) =>
      void createCustomerRequest(
        (
          event as CustomEvent<{
            customerId: number;
            employeeId: number;
            articleId: number;
            quantities: number[];
            deliveryDate: string;
            note: string;
            printFile?: string;
            printFileUrl?: string;
          }>
        ).detail,
      );
    const onCollectiveRequest = (event: Event) =>
      void createCollectiveCustomerRequest(
        (
          event as CustomEvent<{
            customerId: number;
            employeeId: number;
            supplier: string;
            items: Array<{
              articleId: number;
              quantities: number[];
              printFile?: string;
              printFileUrl?: string;
            }>;
            deliveryDate: string;
            note: string;
          }>
        ).detail,
      );
    const onEdit = (event: Event) =>
      updateDocument(
        (
          event as CustomEvent<{
            id: number;
            customerId: number;
            employeeId?: number;
            articleId: number;
            quantity: number;
            unitPrice: number;
            deliveryDate?: string;
            note?: string;
            status: DocumentRecord["status"];
          }>
        ).detail,
      );
    const onDelete = (event: Event) => {
      const detail = (event as CustomEvent<{ id: number }>).detail;
      const document = documents.find((item) => item.id === detail.id);
      if (document) deleteDocument(document);
    };
    const onSupplierOffer = (event: Event) =>
      void submitSupplierOffer(
        (
          event as CustomEvent<{
            requestId: number;
            options?: OfferOption[];
            items?: Array<{
              articleId: number;
              options: OfferOption[];
              gzd?: string;
              gzdUrl?: string;
            }>;
            deliveryDate: string;
            deliveryNote?: string;
            gzd?: string;
            gzdUrl?: string;
            note?: string;
          }>
        ).detail,
      );
    const onAccept = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          offerId: number;
          quantity: number;
          itemQuantities?: Record<string, number>;
        }>
      ).detail;
      void acceptOffer(
        detail.offerId,
        detail.quantity,
        detail.itemQuantities,
      );
    };
    const onReject = (event: Event) =>
      rejectOffer((event as CustomEvent<{ offerId: number }>).detail.offerId);
    const onSupplierOpen = (event: Event) => {
      const token = (event as CustomEvent<{ token: string }>).detail.token;
      setSupplierRoute(token);
      window.history.pushState({}, "", `/supplier-offer/${token}`);
    };
    const onGzdStatus = (event: Event) => {
      const { documentId, articleId, status } = (
        event as CustomEvent<{
          documentId: number;
          articleId?: number;
          status: GzdStatus;
        }>
      ).detail;
      setDocuments((current) =>
        current.map((document) =>
          document.id === documentId
            ? articleId
              ? {
                  ...document,
                  items: document.items?.map((item) =>
                    item.articleId === articleId
                      ? { ...item, gzdStatus: status }
                      : item,
                  ),
                  pdfUrl: undefined,
                }
              : { ...document, gzdStatus: status, pdfUrl: undefined }
            : document,
        ),
      );
    };
    window.addEventListener("printcenter:request", onRequest);
    window.addEventListener(
      "printcenter:collective-request",
      onCollectiveRequest,
    );
    window.addEventListener("printcenter:document-edit", onEdit);
    window.addEventListener("printcenter:document-delete", onDelete);
    window.addEventListener("printcenter:supplier-offer", onSupplierOffer);
    window.addEventListener("printcenter:offer-accept", onAccept);
    window.addEventListener("printcenter:offer-reject", onReject);
    window.addEventListener("printcenter:supplier-open", onSupplierOpen);
    window.addEventListener("printcenter:gzd-status", onGzdStatus);
    return () => {
      window.removeEventListener("printcenter:request", onRequest);
      window.removeEventListener(
        "printcenter:collective-request",
        onCollectiveRequest,
      );
      window.removeEventListener("printcenter:document-edit", onEdit);
      window.removeEventListener("printcenter:document-delete", onDelete);
      window.removeEventListener("printcenter:supplier-offer", onSupplierOffer);
      window.removeEventListener("printcenter:offer-accept", onAccept);
      window.removeEventListener("printcenter:offer-reject", onReject);
      window.removeEventListener("printcenter:supplier-open", onSupplierOpen);
      window.removeEventListener("printcenter:gzd-status", onGzdStatus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, articles, documents]);
  useEffect(() => {
    const previewToken = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    ).get("portal-preview");
    if (previewToken) {
      const storageKey = `printcenter:portal-preview:${previewToken}`;
      const storedPreview = window.localStorage.getItem(storageKey);
      window.localStorage.removeItem(storageKey);
      window.history.replaceState({}, "", window.location.pathname);
      const activatePreview = (preview: {
        customerId: number;
        employeeId: number;
        expiresAt: number;
      }) => {
        if (preview.expiresAt > Date.now())
          setPortalSession({
            customerId: preview.customerId,
            employeeId: preview.employeeId,
            source: "backend-preview",
          });
      };
      if (storedPreview) {
        try {
          const preview = JSON.parse(storedPreview) as {
            customerId: number;
            employeeId: number;
            expiresAt: number;
          };
          activatePreview(preview);
        } catch {
          // Ungültige oder abgelaufene Vorschau-Tokens werden still verworfen.
        }
      } else
        void apiRequest<{
          customerId: number;
          employeeId: number;
          expiresAt: number;
        }>(`/api/portal-previews/${encodeURIComponent(previewToken)}`, {
          method: "DELETE",
        })
          .then(activatePreview)
          .catch(() => {
            // Ungültige oder bereits verwendete Vorschau-Links öffnen den Login.
          });
    }
  }, []);
  useEffect(() => {
    if (portalSession) {
      const customer = customers.find(
        (item) => item.id === portalSession.customerId,
      );
      if (customer) window.history.replaceState({}, "", `/${customer.number}`);
    }
  }, [portalSession, customers]);
  function signIn(email: string, password: string) {
    const account = backendUsers.find(
      (user) =>
        user.active &&
        user.email.toLowerCase() === email.toLowerCase() &&
        user.password === password,
    );
    if (!account) return false;
    setBackendSession(account);
    try {
      window.localStorage.setItem(
        backendSessionStorageKey,
        JSON.stringify({ userId: account.id }),
      );
    } catch {
      // Die Anmeldung funktioniert auch, wenn der Browser Speicher blockiert.
    }
    return true;
  }
  function startCustomerSession(customer: Customer, employee: Employee) {
    setPortalRoute(customer.number);
    setPortalSession({
      customerId: customer.id,
      employeeId: employee.id,
      source: "customer",
    });
    try {
      window.localStorage.setItem(
        customerSessionStorageKey,
        JSON.stringify({ customerId: customer.id, employeeId: employee.id }),
      );
    } catch {
      // Die Anmeldung funktioniert auch, wenn der Browser Speicher blockiert.
    }
    window.history.replaceState({}, "", `/${customer.number}`);
  }
  function signInCustomer(
    customerNumber: string,
    email: string,
    password: string,
  ) {
    const normalizedNumber = customerNumber.trim().toLocaleLowerCase("de-CH");
    const normalizedEmail = email.trim().toLocaleLowerCase("de-CH");
    const customer = customers.find(
      (item) => item.number.toLocaleLowerCase("de-CH") === normalizedNumber,
    );
    const employee = customer?.employees.find(
      (item) => item.email.toLocaleLowerCase("de-CH") === normalizedEmail,
    );
    if (
      !customer ||
      !employee ||
      password !== (employee.password ?? "portal")
    )
      return false;
    startCustomerSession(customer, employee);
    return true;
  }
  async function openPortalPreview(customerId: number, employee: Employee) {
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) return;
    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) previewWindow.opener = null;
    try {
      const preview = await apiRequest<{ token: string }>(
        "/api/portal-previews",
        {
          method: "POST",
          body: JSON.stringify({ customerId, employeeId: employee.id }),
        },
      );
      const previewUrl = `/${customer.number}#portal-preview=${encodeURIComponent(preview.token)}`;
      if (previewWindow) previewWindow.location.replace(previewUrl);
      else window.location.assign(previewUrl);
    } catch (error) {
      previewWindow?.close();
      setNotice(
        error instanceof Error
          ? error.message
          : "Das Kundenportal konnte nicht geöffnet werden.",
      );
    }
  }
  function leavePortal() {
    const customer = customers.find(
      (item) => item.id === portalSession?.customerId,
    );
    const customerPath = customer ? `/${customer.number}` : "/";
    const wasBackendPreview = portalSession?.source === "backend-preview";
    if (!wasBackendPreview)
      try {
        window.localStorage.removeItem(customerSessionStorageKey);
      } catch {
        // Abmelden bleibt auch ohne verfügbaren Browser-Speicher möglich.
      }
    setPortalSession(null);
    setPortalRoute(customer?.number ?? null);
    window.history.replaceState({}, "", customerPath);
    if (wasBackendPreview) window.close();
  }
  function leaveSupplierPortal() {
    window.history.pushState({}, "", "/");
    setSupplierRoute(null);
  }
  function createBackendUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    if (!name || !email || !password) return;
    if (
      backendUsers.some(
        (user) => user.email.toLowerCase() === email.toLowerCase(),
      )
    ) {
      setNotice("Für diese Mailadresse existiert bereits ein Backend-Zugang.");
      return;
    }
    const user: BackendUser = {
      id: Date.now(),
      name,
      email,
      password,
      role: String(data.get("role")) as BackendUser["role"],
      active: true,
    };
    setBackendUsers((current) => [...current, user]);
    event.currentTarget.reset();
    setNotice(`${name} kann sich jetzt im Backend anmelden.`);
  }
  function updateBackendUser(
    id: number,
    name: string,
    email: string,
    password: string,
  ) {
    setBackendUsers((current) =>
      current.map((user) =>
        user.id === id
          ? { ...user, name, email, password: password || user.password }
          : user,
      ),
    );
    setNotice(`${name} wurde aktualisiert.`);
  }
  function toggleBackendUser(user: BackendUser) {
    setBackendUsers((current) =>
      current.map((item) =>
        item.id === user.id ? { ...item, active: !item.active } : item,
      ),
    );
    setNotice(
      `${user.name} wurde ${user.active ? "deaktiviert" : "aktiviert"}.`,
    );
  }
  function deleteBackendUser(user: BackendUser) {
    if (user.id === backendSession?.id) {
      setNotice("Der aktuell angemeldete Zugang kann nicht gelöscht werden.");
      return;
    }
    setBackendUsers((current) => current.filter((item) => item.id !== user.id));
    setNotice(`${user.name} wurde als Backend-Zugang gelöscht.`);
  }
  const supplierRequest = supplierRoute
    ? documents.find(
        (item) =>
          item.type === "Anfrage" &&
          item.supplierToken === supplierRoute &&
          item.status === "Versendet",
      )
    : undefined;
  if (supplierRoute)
    return (
      <SupplierPortal request={supplierRequest} onExit={leaveSupplierPortal} />
    );
  const portalCustomer = portalRoute
    ? customers.find(
        (item) => item.number.toLowerCase() === portalRoute.toLowerCase(),
      )
    : undefined;
  if (portalCustomer && !portalSession)
    return (
      <PortalLogin
        customer={portalCustomer}
        onLogin={(employee) => startCustomerSession(portalCustomer, employee)}
      />
    );
  if (portalSession) {
    const customer = customers.find(
      (item) => item.id === portalSession.customerId,
    );
    const employee = customer?.employees.find(
      (item) => item.id === portalSession.employeeId,
    );
    if (customer && employee)
      return (
        <CustomerPortal
          customer={customer}
          employee={employee}
          articles={articles}
          documents={documents}
          onExit={leavePortal}
          onReorder={(article) =>
            setNotice(
              `${article.name} wurde zur Nachbestellung von ${employee.name} vorgemerkt.`,
            )
          }
          onMinimumChange={updateArticleMinimum}
          backendPreview={portalSession.source === "backend-preview"}
        />
      );
  }
  if (initialRoute !== "backend")
    return (
      <CustomerEntryLogin
        initialCustomerNumber={initialPortalNumber}
        onSubmit={signInCustomer}
      />
    );
  if (!backendSession) return <BackendLogin onSubmit={signIn} />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Monogram />
          <span>
            print
            <br />
            center
          </span>
        </div>
        <div className="sidebar-rule" />
        <nav aria-label="Hauptnavigation">
          {navItems.map((item, index) => (
            <button
              className={`nav-item ${view === item ? "is-active" : ""}`}
              onClick={() => {
                if (item === "Belege") setDocumentFocusId(null);
                setView(item);
              }}
              key={item}
            >
              <span className="nav-index">0{index + 1}</span>
              {item}
            </button>
          ))}
        </nav>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">PRINTCENTER / OPERATIV</p>
            <p className="topbar-title" aria-live="off">
              {backendClock || "Aktuelle Zeit wird geladen…"}
            </p>
          </div>
          <div className="topbar-actions">
            <button
              className="portal-button"
              onClick={() => {
                const customer = customers[0];
                const employee = customer?.employees[0];
                if (customer && employee)
                  openPortalPreview(customer.id, employee);
              }}
            >
              Kundenportal ↗
            </button>
            <button
              className="profile"
              aria-label="Abmelden"
              title="Abmelden"
              onClick={() => {
                try {
                  window.localStorage.removeItem(backendSessionStorageKey);
                } catch {
                  // Die Sitzung wird mindestens im aktuellen Tab beendet.
                }
                setBackendSession(null);
              }}
            >
              {backendSession.name
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </button>
          </div>
        </header>
        <div className="content">
          <section className="hero">
            <div className="hero-copy">
              <p className="eyebrow">{view.toUpperCase()}</p>
              <h1>{view === "Übersicht" ? "Alles im Fluss." : view}</h1>
              <p>
                {view === "Übersicht"
                  ? "Ein klarer Blick auf Druckaufträge, Lager und Partner."
                  : "Verwalte deine Druckproduktion ohne Umwege."}
              </p>
            </div>
            <div className="bauhaus-mark" aria-hidden="true">
              <span />
              <i />
              <b />
            </div>
          </section>
          {view === "Übersicht" && (
            <Overview
              documents={documents}
              customers={customers}
              referenceTime={backendNow}
              onOpenDocument={(documentId) => {
                setDocumentFocusId(documentId);
                setView("Belege");
              }}
            />
          )}
          {view === "Kunden" && (
            <CustomersView
              customers={customers}
              formMode={customerForm}
              setFormMode={setCustomerForm}
              onSave={saveCustomer}
              onDelete={deleteCustomer}
              onAddEmployee={addEmployee}
              onUpdateEmployee={updateEmployee}
              onDeleteEmployee={deleteEmployee}
              onSendEmployeeLogin={sendEmployeeLogin}
              onOpenPortal={openPortalPreview}
              documents={documents}
            />
          )}
          {view === "Lieferanten" && (
            <SuppliersView
              suppliers={suppliers}
              groups={groups}
              groupName={groupName}
              setGroupName={setGroupName}
              onAddGroup={addGroup}
              onDeleteGroup={deleteGroup}
              formMode={supplierForm}
              setFormMode={setSupplierForm}
              onSave={saveSupplier}
              onDelete={deleteSupplier}
            />
          )}
          {view === "Belege" && (
            <DocumentsView
              key={documentFocusId ?? "all-documents"}
              documents={documents}
              customers={customers}
              articles={articles}
              focusId={documentFocusId}
              formType={documentForm}
              setFormType={setDocumentForm}
              onCreate={createDocument}
            />
          )}
          {view === "Artikel" && (
            <ArticlesView
              articles={articles}
              customers={customers}
              suppliers={suppliers}
              groups={groups}
              formMode={articleForm}
              setFormMode={setArticleForm}
              onSave={saveArticle}
              onDelete={deleteArticle}
              onAttachTemplate={attachTemplate}
              documents={documents}
              onOpenDocument={(documentId) => {
                setDocumentFocusId(documentId);
                setView("Belege");
              }}
            />
          )}
          {view === "Einstellungen" && (
            <SettingsView
              users={backendUsers}
              currentUser={backendSession}
              workflow={workflowSettings}
              onStateImported={(state) => {
                const normalizedArticles = state.articles.map(normalizeArticle);
                setCustomers(state.customers);
                setSuppliers(state.suppliers);
                setGroups(state.groups);
                setArticles(normalizedArticles);
                setDocuments(state.documents);
                setBackendUsers(state.backendUsers);
                setWorkflowSettings({
                  ...initialWorkflowSettings,
                  ...(state.workflowSettings ?? {}),
                });
              }}
              onWorkflowSave={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                setWorkflowSettings({
                  requestTemplate: String(data.get("requestTemplate") || ""),
                  offerTemplate: String(data.get("offerTemplate") || ""),
                  orderTemplate: String(data.get("orderTemplate") || ""),
                  confirmationTemplate: String(
                    data.get("confirmationTemplate") || "",
                  ),
                  employeeLoginSubject: String(
                    data.get("employeeLoginSubject") || "",
                  ),
                  employeeLoginTemplate: String(
                    data.get("employeeLoginTemplate") || "",
                  ),
                  supplierOfferSubject: String(
                    data.get("supplierOfferSubject") || "",
                  ),
                  offerEmail: String(data.get("offerEmail") || ""),
                  orderEmail: workflowSettings.orderEmail,
                  attachRequestDocument:
                    data.get("attachRequestDocument") === "on",
                  attachRequestGzd: data.get("attachRequestGzd") === "on",
                  attachOfferDocument: data.get("attachOfferDocument") === "on",
                  attachOfferGzd: data.get("attachOfferGzd") === "on",
                  attachOrderDocument: data.get("attachOrderDocument") === "on",
                  attachOrderGzd: data.get("attachOrderGzd") === "on",
                  attachConfirmationDocument:
                    data.get("attachConfirmationDocument") === "on",
                  attachConfirmationGzd:
                    data.get("attachConfirmationGzd") === "on",
                });
                setNotice(
                  "Anfrage-, Angebots-, Bestell- und Auftragsbestätigungsvorlagen wurden gespeichert.",
                );
              }}
              onCreate={createBackendUser}
              onEdit={updateBackendUser}
              onToggle={toggleBackendUser}
              onDelete={deleteBackendUser}
            />
          )}
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  return <PrintcenterApp initialRoute="customer-home" />;
}

function Overview({
  documents,
  customers,
  referenceTime,
  onOpenDocument,
}: {
  documents: DocumentRecord[];
  customers: Customer[];
  referenceTime: number;
  onOpenDocument: (documentId: number) => void;
}) {
  const cutoff = referenceTime - 24 * 60 * 60 * 1000;
  const recentDocuments = referenceTime
    ? documents.filter((document) => {
        const timestamp = documentCreatedAt(document);
        return timestamp >= cutoff && timestamp <= referenceTime;
      })
    : [];
  const requests = recentDocuments.filter(
    (document) => document.type === "Anfrage",
  );
  const orders = recentDocuments.filter(
    (document) => document.type === "Bestellung",
  );
  const orderVolume = orders.reduce((sum, document) => sum + document.total, 0);
  const markupProfit = orders.reduce((sum, order) => {
    const relatedCustomerDocument = documents.find(
      (document) =>
        document.projectId === order.projectId &&
        (document.type === "Auftragsbestätigung" ||
          document.type === "Angebot") &&
        document.markupAmount > 0,
    );
    return sum + (relatedCustomerDocument?.markupAmount ?? order.markupAmount);
  }, 0);
  const activities = recentDocuments
    .filter(
      (document) =>
        document.type === "Anfrage" || document.type === "Bestellung",
    )
    .sort((left, right) => documentCreatedAt(right) - documentCreatedAt(left));
  const activityActor = (document: DocumentRecord) => {
    const customer = customers.find((item) => item.id === document.customerId);
    const employee = customer?.employees.find(
      (item) => item.id === document.employeeId,
    );
    if (employee) {
      const lastName =
        employee.lastName || splitPersonName(employee.name).lastName;
      if (employee.salutation === "Frau" && lastName) return `Frau ${lastName}`;
      if (employee.salutation === "Herr" && lastName) return `Herr ${lastName}`;
      return employeeDisplayName(employee);
    }
    const contactName = [customer?.contactFirstName, customer?.contactLastName]
      .filter(Boolean)
      .join(" ");
    if (customer?.contactSalutation === "Frau" && customer.contactLastName)
      return `Frau ${customer.contactLastName}`;
    if (customer?.contactSalutation === "Herr" && customer.contactLastName)
      return `Herr ${customer.contactLastName}`;
    return contactName || document.employee || document.customer;
  };
  const activityTime = (document: DocumentRecord) =>
    new Intl.DateTimeFormat("de-CH", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Zurich",
    }).format(new Date(documentCreatedAt(document)));
  return (
    <>
      <section className="metrics-grid overview-kpis">
        <article className="metric metric--red">
          <p>Anfragen letzte 24h</p>
          <strong>{requests.length}</strong>
          <span>neu eingegangene Kundenanfragen</span>
        </article>
        <article className="metric">
          <p>Bestellungen letzte 24h</p>
          <strong>{orders.length}</strong>
          <span>aus bestätigten Angeboten</span>
        </article>
        <article className="metric metric--black">
          <p>Bestellvolumen letzte 24h</p>
          <strong>{formatMoney(orderVolume)}</strong>
          <span className="metric-profit">
            Gewinn aus Markup: {formatMoney(markupProfit)}
          </span>
        </article>
      </section>
      <section className="panel customer-activity-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">LETZTE 24 STUNDEN</p>
            <h2>Kundenaktivitäten</h2>
          </div>
          <span className="muted">{activities.length} Aktivitäten</span>
        </div>
        <div className="customer-activity-list">
          {activities.length ? (
            activities.map((document) => (
              <button
                className="customer-activity-row"
                key={document.id}
                onClick={() => onOpenDocument(document.id)}
              >
                <span className="activity-time">{activityTime(document)}</span>
                <span
                  className={`activity-type activity-type--${document.type === "Anfrage" ? "request" : "order"}`}
                >
                  {document.type === "Anfrage" ? "AF" : "BE"}
                </span>
                <span>
                  <strong>{activityActor(document)}</strong> hat{" "}
                  {document.type === "Anfrage"
                    ? "eine Anfrage erstellt"
                    : "eine Bestellung getätigt"}
                  .
                  <small>
                    {document.article} · {document.customer}
                  </small>
                </span>
                <span className="activity-document">{document.number} →</span>
              </button>
            ))
          ) : (
            <p className="empty-copy">
              In den letzten 24 Stunden wurden noch keine Kundenanfragen oder
              Bestellungen erfasst.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

function CustomersView({
  customers,
  formMode,
  setFormMode,
  onSave,
  onDelete,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onSendEmployeeLogin,
  onOpenPortal,
  documents,
}: {
  customers: Customer[];
  formMode: "new" | number | null;
  setFormMode: (mode: "new" | number | null) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onDelete: (customer: Customer) => void | Promise<void>;
  onAddEmployee: (
    event: FormEvent<HTMLFormElement>,
    customerId: number,
  ) => void | Promise<void>;
  onUpdateEmployee: (
    customerId: number,
    employeeId: number,
    data: {
      name: string;
      salutation: Salutation;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      password: string;
      mailToMain: boolean;
    },
  ) => Promise<boolean>;
  onDeleteEmployee: (
    customerId: number,
    employee: Employee,
  ) => void | Promise<void>;
  onSendEmployeeLogin: (
    customerId: number,
    employeeId: number,
  ) => Promise<void>;
  onOpenPortal: (customerId: number, employee: Employee) => void;
  documents: DocumentRecord[];
}) {
  const editing =
    typeof formMode === "number"
      ? customers.find((customer) => customer.id === formMode)
      : undefined;
  const [expandedCustomerId, setExpandedCustomerId] = useState<number | null>(
    null,
  );
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(
    null,
  );
  function toggleCustomer(customer: Customer) {
    const open = expandedCustomerId === customer.id;
    setExpandedCustomerId(open ? null : customer.id);
    setEditingEmployeeId(null);
  }
  return (
    <section className="customer-addressbook panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">ADRESSBUCH</p>
          <h2>{customers.length} Kunden &amp; Portalzugänge</h2>
        </div>
        <button className="primary-button" onClick={() => setFormMode("new")}>
          + Neuer Kunde
        </button>
      </div>
      {formMode && (
        <CustomerForm
          key={formMode}
          customer={editing}
          onSubmit={onSave}
          onCancel={() => setFormMode(null)}
        />
      )}
      {customers.length === 0 ? (
        <div className="directory-empty">
          <strong>Noch keine Kunden vorhanden.</strong>
          <p>
            Lege den ersten Kunden direkt hier an. Das funktioniert auch bei
            einem vollständig leeren Adressbuch.
          </p>
          <button className="primary-button" onClick={() => setFormMode("new")}>
            Ersten Kunden anlegen
          </button>
        </div>
      ) : (
        <>
          <div className="customer-accordion-head">
            <span>Nr.</span>
            <span>Kunde &amp; Adresse</span>
            <span>Hauptmail / Telefon</span>
            <span>Markup</span>
            <span>Mitarbeitende</span>
            <span />
          </div>
          <div className="customer-accordion-list">
            {customers.map((customer) => {
              const expanded = expandedCustomerId === customer.id;
              const editingEmployee = customer.employees.find(
                (employee) => employee.id === editingEmployeeId,
              );
              return (
                <article
                  className={`customer-accordion ${expanded ? "is-expanded" : ""}`}
                  key={customer.id}
                >
                  <button
                    className="customer-summary"
                    onClick={() => toggleCustomer(customer)}
                    aria-expanded={expanded}
                  >
                    <span className="mono">{customer.number}</span>
                    <span>
                      <strong>{customer.name}</strong>
                      <small>
                        {customer.street}, {customer.postalCode} {customer.city}
                      </small>
                    </span>
                    <span>
                      {customer.email}
                      <small>{customer.phone}</small>
                    </span>
                    <strong>{customer.markup}%</strong>
                    <span>{customer.employees.length} MA</span>
                    <b>{expanded ? "−" : "+"}</b>
                  </button>
                  {expanded && (
                    <div className="customer-expanded">
                      <div className="customer-expanded-top">
                        <div>
                          <p className="eyebrow">KUNDENADRESSE</p>
                          <strong>{customer.name}</strong>
                          <p>
                            {customer.street}
                            <br />
                            {customer.postalCode} {customer.city}
                            <br />
                            {customer.country}
                          </p>
                        </div>
                        <div>
                          <p className="eyebrow">KONTAKT</p>
                          {(customer.contactFirstName ||
                            customer.contactLastName) && (
                            <strong>
                              {customer.contactSalutation &&
                              customer.contactSalutation !== "Divers"
                                ? `${customer.contactSalutation} `
                                : ""}
                              {[
                                customer.contactFirstName,
                                customer.contactLastName,
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            </strong>
                          )}
                          <p>
                            {customer.email}
                            <br />
                            {customer.phone}
                          </p>
                          <small>Portal: /{customer.number}</small>
                        </div>
                        <div className="expanded-actions">
                          <button
                            className="secondary-button"
                            onClick={() => setFormMode(customer.id)}
                          >
                            Kunde bearbeiten
                          </button>
                          <button
                            className="danger-button"
                            onClick={() => onDelete(customer)}
                          >
                            Kunde löschen
                          </button>
                        </div>
                      </div>
                      <div className="employee-heading">
                        <div>
                          <p className="eyebrow">MITARBEITENDE</p>
                          <h3>{customer.employees.length} Portalzugänge</h3>
                        </div>
                        <span className="login-hint">
                          Login ist immer die persönliche Mailadresse
                        </span>
                      </div>
                      {editingEmployee && (
                        <EmployeeEditForm
                          employee={editingEmployee}
                          onCancel={() => setEditingEmployeeId(null)}
                          onSendLogin={() =>
                            onSendEmployeeLogin(
                              customer.id,
                              editingEmployee.id,
                            )
                          }
                          onSubmit={async (data) => {
                            if (
                              await onUpdateEmployee(
                                customer.id,
                                editingEmployee.id,
                                data,
                              )
                            )
                              setEditingEmployeeId(null);
                          }}
                        />
                      )}
                      <div className="employee-list employee-list--wide">
                        {customer.employees.map((employee) => (
                          <article className="employee-row" key={employee.id}>
                            <span className="employee-initial">
                              {employee.name
                                .split(" ")
                                .map((part) => part[0])
                                .join("")}
                            </span>
                            <div>
                              <strong>
                                {employee.salutation &&
                                employee.salutation !== "Divers"
                                  ? `${employee.salutation} `
                                  : ""}
                                {employeeDisplayName(employee)}
                              </strong>
                              <p>
                                {employee.email} ·{" "}
                                {employee.phone || "kein Telefon"}
                              </p>
                              <small>
                                {employee.mailToMain
                                  ? "Mails an Hauptmail + MA-Mail"
                                  : "Mails nur an MA-Mail"}{" "}
                                ·{" "}
                                {
                                  documents.filter(
                                    (document) =>
                                      document.employeeId === employee.id,
                                  ).length
                                }{" "}
                                Belege
                              </small>
                            </div>
                            <div className="employee-actions">
                              <button
                                className="text-button"
                                onClick={() =>
                                  onOpenPortal(customer.id, employee)
                                }
                              >
                                Portal öffnen ↗
                              </button>
                              <button
                                className="text-button"
                                onClick={() =>
                                  setEditingEmployeeId(employee.id)
                                }
                              >
                                Bearbeiten
                              </button>
                              <button
                                className="icon-action"
                                aria-label={`${employee.name} entfernen`}
                                onClick={() =>
                                  onDeleteEmployee(customer.id, employee)
                                }
                              >
                                ×
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                      <form
                        className="employee-form employee-form--wide"
                        onSubmit={(event) => onAddEmployee(event, customer.id)}
                      >
                        <p className="eyebrow">MITARBEITER HINZUFÜGEN</p>
                        <div>
                          <label>
                            Anrede
                            <select name="salutation" defaultValue="Frau">
                              <option>Frau</option>
                              <option>Herr</option>
                              <option>Divers</option>
                            </select>
                          </label>
                          <label>
                            Vorname
                            <input
                              name="firstName"
                              required
                              placeholder="Vorname"
                            />
                          </label>
                          <label>
                            Nachname
                            <input
                              name="lastName"
                              required
                              placeholder="Nachname"
                            />
                          </label>
                          <label>
                            Login-Mail
                            <input
                              name="email"
                              type="email"
                              required
                              placeholder="name@kunde.ch"
                            />
                          </label>
                          <label>
                            Telefon
                            <input name="phone" placeholder="+41 …" />
                          </label>
                        </div>
                        <div>
                          <label>
                            Initialpasswort
                            <input
                              name="initialPassword"
                              type="password"
                              minLength={8}
                              required
                              placeholder="Mindestens 8 Zeichen"
                            />
                          </label>
                          <label>
                            Mailzustellung
                            <select name="mailDelivery" defaultValue="employee">
                              <option value="employee">
                                Nur MA-spezifische Mail
                              </option>
                              <option value="main-and-employee">
                                Hauptmail + MA-spezifische Mail
                              </option>
                            </select>
                          </label>
                        </div>
                        <button className="primary-button" type="submit">
                          Zugang anlegen
                        </button>
                      </form>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
function EmployeeEditForm({
  employee,
  onCancel,
  onSendLogin,
  onSubmit,
}: {
  employee: Employee;
  onCancel: () => void;
  onSendLogin: () => Promise<void>;
  onSubmit: (data: {
    name: string;
    salutation: Salutation;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    mailToMain: boolean;
  }) => void;
}) {
  const [sendingLogin, setSendingLogin] = useState(false);
  const [sendError, setSendError] = useState("");
  return (
    <form
      className="employee-edit-form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const firstName = String(data.get("firstName") || "").trim();
        const lastName = String(data.get("lastName") || "").trim();
        onSubmit({
          name: [firstName, lastName].filter(Boolean).join(" "),
          salutation: String(data.get("salutation") || "Divers") as Salutation,
          firstName,
          lastName,
          email: String(data.get("email") || "").trim(),
          phone: String(data.get("phone") || "").trim(),
          password: String(data.get("password") || ""),
          mailToMain: String(data.get("mailDelivery")) === "main-and-employee",
        });
      }}
    >
      <p className="eyebrow">PORTALZUGANG BEARBEITEN</p>
      <label>
        Anrede
        <select
          name="salutation"
          defaultValue={employee.salutation ?? "Divers"}
        >
          <option>Frau</option>
          <option>Herr</option>
          <option>Divers</option>
        </select>
      </label>
      <label>
        Vorname
        <input
          name="firstName"
          defaultValue={
            employee.firstName ?? splitPersonName(employee.name).firstName
          }
          required
        />
      </label>
      <label>
        Nachname
        <input
          name="lastName"
          defaultValue={
            employee.lastName ?? splitPersonName(employee.name).lastName
          }
          required
        />
      </label>
      <label>
        Login-Mail
        <input
          name="email"
          type="email"
          defaultValue={employee.email}
          required
        />
      </label>
      <label>
        Telefon
        <input name="phone" defaultValue={employee.phone} />
      </label>
      <label>
        Mailzustellung
        <select
          name="mailDelivery"
          defaultValue={employee.mailToMain ? "main-and-employee" : "employee"}
        >
          <option value="employee">Nur MA-spezifische Mail</option>
          <option value="main-and-employee">
            Hauptmail + MA-spezifische Mail
          </option>
        </select>
      </label>
      <label>
        Neues Passwort
        <input
          name="password"
          type="password"
          minLength={8}
          placeholder="leer = unverändert"
        />
      </label>
      <button className="primary-button" type="submit">
        Zugang speichern
      </button>
      <button className="secondary-button" type="button" onClick={onCancel}>
        Abbrechen
      </button>
      <div className="employee-login-mail-action">
        <button
          className="secondary-button"
          type="button"
          disabled={sendingLogin}
          onClick={async () => {
            setSendingLogin(true);
            setSendError("");
            try {
              await onSendLogin();
            } catch (error) {
              setSendError(
                error instanceof Error
                  ? error.message
                  : "Die Zugangsdaten konnten nicht versendet werden.",
              );
            } finally {
              setSendingLogin(false);
            }
          }}
        >
          {sendingLogin ? "Wird versendet…" : "Logindaten per E-Mail senden"}
        </button>
        <small>
          Sendet Login, gespeichertes Passwort und den Firmenportal-Link an
          {" "}{employee.email}.
        </small>
        {sendError && <p className="form-error">{sendError}</p>}
      </div>
    </form>
  );
}
function CustomerForm({
  customer,
  onSubmit,
  onCancel,
}: {
  customer?: Customer;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <form
      className="quick-form customer-form customer-form--large"
      onSubmit={onSubmit}
    >
      <div className="form-section-title">Firma &amp; Hauptkontakt</div>
      <label>
        Firma
        <input name="name" defaultValue={customer?.name} required />
      </label>
      <label>
        Anrede
        <select
          name="contactSalutation"
          defaultValue={customer?.contactSalutation ?? "Frau"}
        >
          <option>Frau</option>
          <option>Herr</option>
          <option>Divers</option>
        </select>
      </label>
      <label>
        Vorname
        <input
          name="contactFirstName"
          defaultValue={customer?.contactFirstName}
          required
        />
      </label>
      <label>
        Nachname
        <input
          name="contactLastName"
          defaultValue={customer?.contactLastName}
          required
        />
      </label>
      <label>
        Hauptmail
        <input
          name="email"
          type="email"
          defaultValue={customer?.email}
          required
        />
      </label>
      <label>
        Telefon
        <input name="phone" defaultValue={customer?.phone} />
      </label>
      <label>
        Markup in %
        <input
          name="markup"
          type="number"
          min="0"
          step="0.1"
          defaultValue={customer?.markup ?? 0}
          required
        />
      </label>
      <div className="form-section-title">Rechnungs- und Lieferadresse</div>
      <label className="field-span-2">
        Strasse / Hausnummer
        <input name="street" defaultValue={customer?.street} required />
      </label>
      <label>
        PLZ
        <input name="postalCode" defaultValue={customer?.postalCode} required />
      </label>
      <label>
        Ort
        <input name="city" defaultValue={customer?.city} required />
      </label>
      <label>
        Land
        <input
          name="country"
          defaultValue={customer?.country ?? "Schweiz"}
          required
        />
      </label>
      <div className="form-actions-wide">
        <button className="primary-button" type="submit">
          {customer ? "Änderungen speichern" : "Kunde anlegen"}
        </button>
        <button className="secondary-button" type="button" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function SuppliersView({
  suppliers,
  groups,
  groupName,
  setGroupName,
  onAddGroup,
  onDeleteGroup,
  formMode,
  setFormMode,
  onSave,
  onDelete,
}: {
  suppliers: Supplier[];
  groups: string[];
  groupName: string;
  setGroupName: (value: string) => void;
  onAddGroup: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onDeleteGroup: (name: string) => void | Promise<void>;
  formMode: "new" | number | null;
  setFormMode: (mode: "new" | number | null) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onDelete: (supplier: Supplier) => void | Promise<void>;
}) {
  const editing =
    typeof formMode === "number"
      ? suppliers.find((supplier) => supplier.id === formMode)
      : undefined;
  const [expandedSupplierId, setExpandedSupplierId] = useState<number | null>(
    null,
  );
  function toggleSupplier(supplier: Supplier) {
    const open = expandedSupplierId === supplier.id;
    setExpandedSupplierId(open ? null : supplier.id);
  }
  return (
    <section className="supplier-workspace">
      <section className="panel group-panel group-panel--wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">LIEFERANTENGRUPPEN</p>
            <h2>Material &amp; Produktion</h2>
          </div>
          <form className="inline-form" onSubmit={onAddGroup}>
            <input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Neue Gruppe"
            />
            <button type="submit">Hinzufügen</button>
          </form>
        </div>
        <div className="group-list group-list--managed">
          {groups.map((group, index) => (
            <div className="group-card" key={group}>
              <span className={`group-mark group-mark--${index % 3}`} />
              <strong>{group}</strong>
              <small>
                {
                  suppliers.filter((supplier) => supplier.group === group)
                    .length
                }{" "}
                Lieferanten
              </small>
              <button
                className="danger-button"
                onClick={() => onDeleteGroup(group)}
              >
                Gruppe löschen
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="panel supplier-addressbook">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">PARTNER</p>
            <h2>{suppliers.length} Lieferanten</h2>
          </div>
          <button className="primary-button" onClick={() => setFormMode("new")}>
            + Neuer Lieferant
          </button>
        </div>
        {formMode && (
          <SupplierForm
            key={formMode}
            supplier={editing}
            groups={groups}
            onSubmit={onSave}
            onCancel={() => setFormMode(null)}
          />
        )}
        {suppliers.length === 0 && (
          <div className="directory-empty">
            <strong>Noch keine Lieferanten vorhanden.</strong>
            <p>
              Lege den ersten Lieferanten direkt hier an – unabhängig davon, ob
              bereits Kunden erfasst sind.
            </p>
            <button
              className="primary-button"
              onClick={() => setFormMode("new")}
            >
              Ersten Lieferanten anlegen
            </button>
          </div>
        )}
        <div className="supplier-accordion-head">
          <span>Nr.</span>
          <span>Lieferant</span>
          <span>Kontakt</span>
          <span>Gruppe</span>
          <span />
        </div>
        <div className="supplier-accordion-list">
          {suppliers.map((supplier) => {
            const expanded = expandedSupplierId === supplier.id;
            return (
              <article
                className={`supplier-accordion ${expanded ? "is-expanded" : ""}`}
                key={supplier.id}
              >
                <button
                  className="supplier-summary"
                  onClick={() => toggleSupplier(supplier)}
                  aria-expanded={expanded}
                >
                  <span className="mono">{supplier.number}</span>
                  <span>
                    <strong>{supplier.name}</strong>
                    <small>{supplier.email}</small>
                  </span>
                  <span>
                    {supplier.contact}
                    <small>{supplier.phone}</small>
                  </span>
                  <span className="group-tag">
                    {supplier.group || "Ohne Gruppe"}
                  </span>
                  <b>{expanded ? "−" : "+"}</b>
                </button>
                {expanded && (
                  <div className="supplier-expanded">
                    <div>
                      <p className="eyebrow">ANSPRECHPERSON</p>
                      <strong>{supplier.contact}</strong>
                      <p>
                        {supplier.email}
                        <br />
                        {supplier.phone}
                      </p>
                    </div>
                    <div>
                      <p className="eyebrow">PRODUKTION</p>
                      <p>
                        Gruppe: {supplier.group || "Ohne Gruppe"}
                      </p>
                    </div>
                    <div className="expanded-actions">
                      <button
                        className="secondary-button"
                        onClick={() => setFormMode(supplier.id)}
                      >
                        Lieferant bearbeiten
                      </button>
                      <button
                        className="danger-button"
                        onClick={() => onDelete(supplier)}
                      >
                        Lieferant löschen
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
function SupplierForm({
  supplier,
  groups,
  onSubmit,
  onCancel,
}: {
  supplier?: Supplier;
  groups: string[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <form
      className="quick-form supplier-form supplier-form--extended"
      onSubmit={onSubmit}
    >
      <label>
        Firma
        <input name="name" defaultValue={supplier?.name} required />
      </label>
      <label>
        Gruppe
        <select name="group" defaultValue={supplier?.group || "Ohne Gruppe"}>
          <option>Ohne Gruppe</option>
          {groups.map((group) => (
            <option key={group}>{group}</option>
          ))}
        </select>
      </label>
      <label>
        Kontakt
        <input name="contact" defaultValue={supplier?.contact} />
      </label>
      <label>
        Mail
        <input name="email" type="email" defaultValue={supplier?.email} />
      </label>
      <label>
        Telefon
        <input name="phone" defaultValue={supplier?.phone} />
      </label>
      <button className="primary-button" type="submit">
        {supplier ? "Speichern" : "Lieferant anlegen"}
      </button>
      <button className="secondary-button" type="button" onClick={onCancel}>
        Abbrechen
      </button>
    </form>
  );
}

function DocumentsView({
  documents,
  customers,
  articles,
  focusId,
  formType,
  setFormType,
  onCreate,
}: {
  documents: DocumentRecord[];
  customers: Customer[];
  articles: Article[];
  focusId?: number | null;
  formType: DocumentType | null;
  setFormType: (type: DocumentType | null) => void;
  onCreate: (data: {
    type: DocumentType;
    customerId: number;
    employeeId?: number;
    articleId: number;
    quantity: number;
    unitPrice: number;
  }) => void;
}) {
  const focusedDocument = documents.find((document) => document.id === focusId);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [documentNumberQuery, setDocumentNumberQuery] = useState(
    focusedDocument?.number ?? "",
  );
  const [projectQuery, setProjectQuery] = useState("");
  const [articleQuery, setArticleQuery] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [documentTypeFilter, setDocumentTypeFilter] = useState<
    DocumentType | "Alle"
  >("Alle");
  const [projectFilter, setProjectFilter] = useState<number | null>(null);
  const editing = documents.find((document) => document.id === editingId);
  const articleById = new Map(articles.map((article) => [article.id, article]));
  const normalize = (value: string) => value.trim().toLocaleLowerCase("de-CH");
  const visibleDocuments = documents.filter((document) => {
    if (
      projectFilter !== null &&
      (document.projectId ?? document.id) !== projectFilter
    )
      return false;
    const article = document.articleId
      ? articleById.get(document.articleId)
      : undefined;
    if (
      documentNumberQuery &&
      !normalize(document.number).includes(normalize(documentNumberQuery))
    )
      return false;
    if (
      projectQuery &&
      !String(document.projectId ?? document.id).includes(projectQuery.trim())
    )
      return false;
    if (
      articleQuery &&
      ![article?.sku ?? "", document.article].some((value) =>
        normalize(value).includes(normalize(articleQuery)),
      )
    )
      return false;
    if (
      customerQuery &&
      !normalize(document.customer).includes(normalize(customerQuery))
    )
      return false;
    return (
      documentTypeFilter === "Alle" || document.type === documentTypeFilter
    );
  });
  return (
    <section className="documents-layout">
      <div className="document-types">
        {documentTypes.map((type, index) => (
          <button
            className="document-type"
            onClick={() => setFormType(type)}
            key={type}
          >
            <span>0{index + 1}</span>
            <strong>{type}</strong>
            <small>
              {type === "Anfrage"
                ? "Neue Anfrage starten +"
                : "Manuell anlegen +"}
            </small>
          </button>
        ))}
      </div>
      {formType && (
        <ManualDocumentForm
          type={formType}
          customers={customers}
          articles={articles}
          onCancel={() => setFormType(null)}
          onSubmit={onCreate}
        />
      )}{" "}
      {editing && (
        <EditDocumentForm
          document={editing}
          customers={customers}
          articles={articles}
          onCancel={() => setEditingId(null)}
          onSubmit={(data) => {
            window.dispatchEvent(
              new CustomEvent("printcenter:document-edit", { detail: data }),
            );
            setEditingId(null);
          }}
        />
      )}
      <section className="panel table-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">BELEGCENTER</p>
            <h2>Alle Belege</h2>
          </div>
          <button
            className="primary-button"
            onClick={() => setFormType("Anfrage")}
          >
            Neue Anfrage starten
          </button>
        </div>
        <div className="document-filter-bar">
          <label>
            Belegnummer
            <input
              type="search"
              value={documentNumberQuery}
              onChange={(event) => setDocumentNumberQuery(event.target.value)}
              placeholder="z. B. AN-2026-113"
            />
          </label>
          <label>
            Projektnummer
            <input
              type="search"
              value={projectQuery}
              onChange={(event) => setProjectQuery(event.target.value)}
              placeholder="Projekt-ID"
            />
          </label>
          <label>
            Artikel / SKU
            <input
              type="search"
              value={articleQuery}
              onChange={(event) => setArticleQuery(event.target.value)}
              placeholder="Artikelname oder Nummer"
            />
          </label>
          <label>
            Kunde
            <input
              type="search"
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
              placeholder="Kundenname"
            />
          </label>
          <label>
            Belegtyp
            <select
              value={documentTypeFilter}
              onChange={(event) =>
                setDocumentTypeFilter(
                  event.target.value as DocumentType | "Alle",
                )
              }
            >
              <option>Alle</option>
              {documentTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          {projectFilter !== null && (
            <button
              className="secondary-button"
              onClick={() => setProjectFilter(null)}
            >
              Projekt {projectFilter} entfernen ×
            </button>
          )}
          <button
            className="secondary-button"
            onClick={() => {
              setDocumentNumberQuery("");
              setProjectQuery("");
              setArticleQuery("");
              setCustomerQuery("");
              setDocumentTypeFilter("Alle");
              setProjectFilter(null);
            }}
          >
            Filter zurücksetzen
          </button>
          <span>
            {visibleDocuments.length} von {documents.length} Belegen
          </span>
        </div>
        <div className="data-table document-table">
          <div className="table-head">
            <span>Beleg</span>
            <span>Kunde / Login</span>
            <span>Artikel</span>
            <span>Total</span>
            <span>Status</span>
            <span>Aktionen</span>
          </div>
          {visibleDocuments.map((document) => {
            const customerDocument =
              document.type === "Angebot" ||
              document.type === "Auftragsbestätigung";
            const article = document.articleId
              ? articleById.get(document.articleId)
              : undefined;
            const projectId = document.projectId ?? document.id;
            return (
              <div className="table-row" key={document.id}>
                <strong className="mono">
                  {document.number}
                  <small>{document.type}</small>
                </strong>
                <span>
                  {document.customer}
                  <small>{document.employee}</small>
                  <small>
                    →{" "}
                    {document.type === "Anfrage" ||
                    document.type === "Bestellung"
                      ? (document.supplier ?? "Lieferant offen")
                      : document.customer}
                  </small>
                </span>
                <span>
                  {document.article}
                  <small>
                    {article?.sku ?? "Ohne SKU"} ·{" "}
                    <button
                      className="project-filter-button"
                      onClick={() => setProjectFilter(projectId)}
                    >
                      Projekt {projectId}
                    </button>{" "}
                    ·{" "}
                    {(document.requestedQuantities ?? [document.quantity]).join(
                      " / ",
                    )}{" "}
                    Stück
                  </small>
                  <small>
                    {document.pdfUrl ? "PDF bereit" : "PDF wird erstellt"} ·{" "}
                    {document.attachGzd !== false ? "GzD an" : "GzD aus"}
                  </small>
                </span>
                {document.type === "Anfrage" ? (
                  <strong className="price-pending">
                    Preis offen<small>folgt mit Angebot</small>
                  </strong>
                ) : (
                  <strong>
                    {formatMoney(document.total)}
                    <small>
                      {customerDocument
                        ? "exkl. MwSt."
                        : `Subt. ${formatMoney(document.subtotal)}`}
                    </small>
                  </strong>
                )}
                <Status>{document.status}</Status>
                <span className="row-actions">
                  {document.pdfUrl && (
                    <button
                      className="text-button"
                      onClick={() =>
                        downloadDocumentPdf(document.pdfUrl!, document.number)
                      }
                    >
                      PDF herunterladen
                    </button>
                  )}
                  {document.type === "Anfrage" && document.supplierToken && (
                    <button
                      className="text-button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("printcenter:supplier-open", {
                            detail: { token: document.supplierToken },
                          }),
                        )
                      }
                    >
                      Lieferantenlink
                    </button>
                  )}
                  <button
                    className="text-button"
                    onClick={() => setEditingId(document.id)}
                  >
                    Bearbeiten
                  </button>
                  <button
                    className="danger-button"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("printcenter:document-delete", {
                          detail: { id: document.id },
                        }),
                      )
                    }
                  >
                    Löschen
                  </button>
                </span>
              </div>
            );
          })}
          {visibleDocuments.length === 0 && (
            <p className="empty-copy">Keine Belege entsprechen dem Filter.</p>
          )}
        </div>
      </section>
    </section>
  );
}
function EditDocumentForm({
  document,
  customers,
  articles,
  onCancel,
  onSubmit,
}: {
  document: DocumentRecord;
  customers: Customer[];
  articles: Article[];
  onCancel: () => void;
  onSubmit: (data: {
    id: number;
    customerId: number;
    employeeId?: number;
    articleId: number;
    quantity: number;
    unitPrice: number;
    deliveryDate?: string;
    note?: string;
    status: DocumentRecord["status"];
  }) => void;
}) {
  const initialArticle =
    articles.find((article) => article.id === document.articleId) ??
    articles.find((article) => article.name === document.article) ??
    articles[0];
  const [customerId, setCustomerId] = useState(document.customerId);
  const [employeeId, setEmployeeId] = useState<number | undefined>(
    document.employeeId,
  );
  const [articleId, setArticleId] = useState(initialArticle?.id ?? 0);
  const [quantity, setQuantity] = useState(document.quantity);
  const [unitPrice, setUnitPrice] = useState(document.unitPrice);
  const [deliveryDate, setDeliveryDate] = useState(document.deliveryDate ?? "");
  const [note, setNote] = useState(document.note ?? "");
  const [status, setStatus] = useState<DocumentRecord["status"]>(
    document.status,
  );
  const customer = customers.find((item) => item.id === customerId);
  const isRequest = document.type === "Anfrage";
  const customerPriceDocument =
    document.type === "Angebot" || document.type === "Auftragsbestätigung";
  const markupPercent =
    document.type === "Bestellung"
      ? 0
      : (customer?.markup ?? document.markupPercent);
  const total = quantity * unitPrice * (1 + markupPercent / 100);
  const eligibleArticles = articles.filter(
    (article) => article.customerId === customerId,
  );
  function changeCustomer(id: number) {
    const nextCustomer = customers.find((item) => item.id === id);
    const nextArticle =
      articles.find((article) => article.customerId === id) ?? articles[0];
    setCustomerId(id);
    setEmployeeId(nextCustomer?.employees[0]?.id);
    setArticleId(nextArticle?.id ?? 0);
    setUnitPrice(nextArticle?.unitPrice ?? 0);
  }
  return (
    <form
      className="panel document-form edit-document-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          id: document.id,
          customerId,
          employeeId,
          articleId,
          quantity,
          unitPrice: isRequest ? 0 : unitPrice,
          deliveryDate: deliveryDate || undefined,
          note,
          status,
        });
      }}
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">BELEG BEARBEITEN</p>
          <h2>{document.number}</h2>
        </div>
        <button className="secondary-button" type="button" onClick={onCancel}>
          Schliessen
        </button>
      </div>
      <div className="document-form-grid">
        <label>
          Kunde
          <select
            value={customerId}
            onChange={(event) => changeCustomer(Number(event.target.value))}
          >
            {customers.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mitarbeiter / Login
          <select
            value={employeeId ?? ""}
            onChange={(event) =>
              setEmployeeId(Number(event.target.value) || undefined)
            }
          >
            <option value="">Nicht zugeordnet</option>
            {customer?.employees.map((employee) => (
              <option value={employee.id} key={employee.id}>
                {employee.name} · {employee.login}
              </option>
            ))}
          </select>
        </label>
        <label>
          Artikel
          <select
            value={articleId}
            onChange={(event) => {
              const id = Number(event.target.value);
              setArticleId(id);
              if (!isRequest)
                setUnitPrice(
                  articles.find((article) => article.id === id)?.unitPrice ?? 0,
                );
            }}
          >
            {(eligibleArticles.length ? eligibleArticles : articles).map(
              (article) => (
                <option value={article.id} key={article.id}>
                  {article.name}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          Menge
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value) || 0)}
          />
        </label>
        {!isRequest && (
          <label>
            Preis / Stück
            <input
              type="number"
              min="0"
              step="0.01"
              value={unitPrice}
              onChange={(event) =>
                setUnitPrice(Number(event.target.value) || 0)
              }
            />
          </label>
        )}
        <label>
          Status
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as DocumentRecord["status"])
            }
          >
            <option>Offen</option>
            <option>Versendet</option>
            <option>Bestätigt</option>
          </select>
        </label>
        <label>
          Wunsch-Lieferdatum
          <input
            type="date"
            value={deliveryDate}
            onChange={(event) => setDeliveryDate(event.target.value)}
          />
        </label>
        <label>
          Bemerkung
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
          />
        </label>
      </div>
      {isRequest ? (
        <div className="request-price-note">
          <strong>Keine Preisangaben</strong>
          <span>Der Lieferant ergänzt die Preise erst mit dem Angebot.</span>
          <button className="primary-button" type="submit">
            Speichern &amp; PDF neu erzeugen
          </button>
        </div>
      ) : customerPriceDocument ? (
        <div className="request-price-note customer-price-summary">
          <strong>Preis exkl. MwSt.</strong>
          <span>{formatMoney(total)}</span>
          <button className="primary-button" type="submit">
            Speichern &amp; PDF neu erzeugen
          </button>
        </div>
      ) : (
        <div className="calculation">
          <div>
            <span>Subtotal</span>
            <strong>{formatMoney(quantity * unitPrice)}</strong>
          </div>
          <div className="total-cell">
            <span>Gesamt</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <button className="primary-button" type="submit">
            Speichern &amp; PDF neu erzeugen
          </button>
        </div>
      )}
    </form>
  );
}
function ManualDocumentForm({
  type,
  customers,
  articles,
  onCancel,
  onSubmit,
}: {
  type: DocumentType;
  customers: Customer[];
  articles: Article[];
  onCancel: () => void;
  onSubmit: (data: {
    type: DocumentType;
    customerId: number;
    employeeId?: number;
    articleId: number;
    quantity: number;
    unitPrice: number;
  }) => void;
}) {
  const [currentType, setCurrentType] = useState<DocumentType>(type);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? 0);
  const [articleId, setArticleId] = useState(
    articles.find((article) => article.customerId === customers[0]?.id)?.id ??
      articles[0]?.id ??
      0,
  );
  const [employeeId, setEmployeeId] = useState<number | undefined>(
    customers[0]?.employees[0]?.id,
  );
  const [quantity, setQuantity] = useState(100);
  const [unitPrice, setUnitPrice] = useState(
    articles.find((article) => article.id === articleId)?.unitPrice ?? 0,
  );
  const customer = customers.find((item) => item.id === customerId);
  const eligibleArticles = articles.filter(
    (article) => article.customerId === customerId,
  );
  const article = articles.find((item) => item.id === articleId);
  const isRequest = currentType === "Anfrage";
  const customerPriceDocument =
    currentType === "Angebot" || currentType === "Auftragsbestätigung";
  const subtotal = quantity * unitPrice;
  const markupPercent =
    currentType === "Bestellung" ? 0 : (customer?.markup ?? 0);
  const markup = (subtotal * markupPercent) / 100;
  function changeCustomer(id: number) {
    setCustomerId(id);
    const firstArticle =
      articles.find((article) => article.customerId === id) ?? articles[0];
    setArticleId(firstArticle?.id ?? 0);
    setUnitPrice(firstArticle?.unitPrice ?? 0);
    setEmployeeId(customers.find((item) => item.id === id)?.employees[0]?.id);
  }
  function changeArticle(id: number) {
    setArticleId(id);
    setUnitPrice(articles.find((article) => article.id === id)?.unitPrice ?? 0);
  }
  return (
    <form
      className="panel document-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          type: currentType,
          customerId,
          employeeId,
          articleId,
          quantity,
          unitPrice: isRequest ? 0 : unitPrice,
        });
      }}
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">MANUELLER BELEG</p>
          <h2>{currentType} anlegen</h2>
        </div>
        <button className="secondary-button" type="button" onClick={onCancel}>
          Schliessen
        </button>
      </div>
      <div className="document-form-grid">
        <label>
          Belegtyp
          <select
            value={currentType}
            onChange={(event) =>
              setCurrentType(event.target.value as DocumentType)
            }
          >
            {documentTypes.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Kunde
          <select
            value={customerId}
            onChange={(event) => changeCustomer(Number(event.target.value))}
          >
            {customers.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mitarbeiter / Login
          <select
            value={employeeId ?? ""}
            onChange={(event) =>
              setEmployeeId(Number(event.target.value) || undefined)
            }
          >
            <option value="">Nicht zugeordnet</option>
            {customer?.employees.map((employee) => (
              <option value={employee.id} key={employee.id}>
                {employee.name} · {employee.login}
              </option>
            ))}
          </select>
        </label>
        <label>
          Artikel
          <select
            value={articleId}
            onChange={(event) => changeArticle(Number(event.target.value))}
          >
            {(eligibleArticles.length ? eligibleArticles : articles).map(
              (item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          Menge
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value) || 0)}
            required
          />
        </label>
        {!isRequest && (
          <label>
            Preis / Stück
            <input
              type="number"
              min="0"
              step="0.01"
              value={unitPrice}
              onChange={(event) =>
                setUnitPrice(Number(event.target.value) || 0)
              }
              required
            />
          </label>
        )}
      </div>
      {isRequest ? (
        <div className="request-price-note">
          <strong>Anfrage ohne Preis</strong>
          <span>
            Der Lieferant offeriert den Einkaufspreis erst über seinen
            einmaligen Anfrage-Link.
          </span>
          <button className="primary-button" type="submit">
            Anfrage &amp; PDF erstellen
          </button>
        </div>
      ) : customerPriceDocument ? (
        <div className="request-price-note customer-price-summary">
          <strong>Preis exkl. MwSt.</strong>
          <span>{formatMoney(subtotal + markup)}</span>
          <button className="primary-button" type="submit">
            {currentType} &amp; PDF erstellen
          </button>
        </div>
      ) : (
        <div className="calculation">
          <div>
            <span>Artikel</span>
            <strong>{article?.name ?? "-"}</strong>
          </div>
          <div>
            <span>Subtotal</span>
            <strong>{formatMoney(subtotal)}</strong>
          </div>
          <div className="total-cell">
            <span>Gesamt</span>
            <strong>{formatMoney(subtotal)}</strong>
          </div>
          <button className="primary-button" type="submit">
            {currentType} &amp; PDF erstellen
          </button>
        </div>
      )}
    </form>
  );
}

function ArticlesView({
  articles,
  customers,
  suppliers,
  groups,
  formMode,
  setFormMode,
  onSave,
  onDelete,
  onAttachTemplate,
  documents,
  onOpenDocument,
}: {
  articles: Article[];
  customers: Customer[];
  suppliers: Supplier[];
  groups: string[];
  formMode: "new" | number | null;
  setFormMode: (mode: "new" | number | null) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (article: Article) => void;
  onAttachTemplate: (
    event: ChangeEvent<HTMLInputElement>,
    articleId: number,
  ) => void;
  documents: DocumentRecord[];
  onOpenDocument: (documentId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<
    | "designation1"
    | "designation2"
    | "sku"
    | "customer"
    | "supplier"
    | "stock"
    | "minimum"
  >("designation1");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [expandedArticleId, setExpandedArticleId] = useState<number | null>(
    null,
  );
  const visibleArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("de-CH");
    const valueFor = (article: Article) => {
      if (sortKey === "customer")
        return (
          customers.find((customer) => customer.id === article.customerId)
            ?.name ?? ""
        );
      return article[sortKey];
    };
    return articles
      .filter((article) => {
        const customer =
          customers.find((item) => item.id === article.customerId)?.name ?? "";
        return (
          !normalizedQuery ||
          [
            article.sku,
            article.designation1,
            article.designation2,
            customer,
            article.supplier,
          ].some((value) =>
            value.toLocaleLowerCase("de-CH").includes(normalizedQuery),
          )
        );
      })
      .sort((left, right) => {
        const a = valueFor(left);
        const b = valueFor(right);
        const result =
          typeof a === "number" && typeof b === "number"
            ? a - b
            : String(a).localeCompare(String(b), "de-CH", {
                numeric: true,
                sensitivity: "base",
              });
        return sortDirection === "asc" ? result : -result;
      });
  }, [articles, customers, query, sortDirection, sortKey]);
  return (
    <section className="articles-layout">
      <div className="article-actions">
        <div>
          <p className="eyebrow">SORTIMENT</p>
          <h2>Artikel &amp; GzD-Vorlagen</h2>
        </div>
        <div>
          <button className="primary-button" onClick={() => setFormMode("new")}>
            + Neuer Artikel
          </button>
        </div>
      </div>
      {formMode === "new" && (
        <ArticleForm
          key={formMode}
          customers={customers}
          suppliers={suppliers}
          groups={groups}
          onSubmit={onSave}
          onCancel={() => setFormMode(null)}
        />
      )}
      <div className="panel article-list-panel">
        <div className="article-list-tools">
          <label>
            Artikel suchen
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Bezeichnung, SKU, Kunde oder Lieferant"
            />
          </label>
          <label>
            Sortieren nach
            <select
              value={sortKey}
              onChange={(event) =>
                setSortKey(event.target.value as typeof sortKey)
              }
            >
              <option value="designation1">Bezeichnung 1</option>
              <option value="designation2">Bezeichnung 2</option>
              <option value="sku">Artikelnummer</option>
              <option value="customer">Kunde</option>
              <option value="supplier">Lieferant / Gruppe</option>
              <option value="stock">Bestand</option>
              <option value="minimum">Meldebestand</option>
            </select>
          </label>
          <button
            className="secondary-button sort-direction"
            onClick={() =>
              setSortDirection((current) =>
                current === "asc" ? "desc" : "asc",
              )
            }
          >
            {sortDirection === "asc" ? "A–Z / aufsteigend" : "Z–A / absteigend"}
          </button>
          <span>
            {visibleArticles.length} von {articles.length} Artikeln
          </span>
        </div>
        <div className="article-list">
          <div className="article-list-head">
            <span>SKU</span>
            <span>Bezeichnung 1 / 2</span>
            <span>Kunde</span>
            <span>Lieferant / Gruppe</span>
            <span>Bestand</span>
            <span>GzD</span>
            <span>Details</span>
          </div>
          {visibleArticles.map((article) => {
            const customer = customers.find(
              (item) => item.id === article.customerId,
            );
            const expanded = expandedArticleId === article.id;
            const articleDocuments = documents
              .filter(
                (document) =>
                  document.articleId === article.id ||
                  document.items?.some((item) => item.articleId === article.id) ||
                  (!document.articleId && document.article === article.name),
              )
              .sort(
                (left, right) =>
                  documentCreatedAt(right) - documentCreatedAt(left),
              );
            return (
              <article
                className={`article-list-entry ${expanded ? "is-expanded" : ""}`}
                key={article.id}
              >
                <div
                  className={`article-list-row ${article.stock <= article.minimum ? "low" : ""}`}
                >
                  <span>
                    <b className="sku">{article.sku}</b>
                    {article.stock <= article.minimum && (
                      <small className="low-tag">Meldebestand</small>
                    )}
                  </span>
                  <span>
                    <strong>{article.designation1}</strong>
                    <small>{article.designation2 || "Keine Bezeichnung 2"}</small>
                    <small>{formatMoney(article.unitPrice)} / Stück</small>
                  </span>
                  <span>{customer?.name ?? "Nicht zugeordnet"}</span>
                  <span>
                    {article.supplier.startsWith("group:")
                      ? `Gruppe · ${article.supplier.slice(6)}`
                      : article.supplier}
                  </span>
                  <span>
                    <strong>{article.stock} Stück</strong>
                    <small>Meldebestand {article.minimum}</small>
                  </span>
                  <span>
                    <strong>{article.templates.length} Dateien</strong>
                    <small>am Artikel hinterlegt</small>
                  </span>
                  <span className="article-list-actions">
                    <button
                      className="secondary-button article-expand-button"
                      aria-expanded={expanded}
                      onClick={() =>
                        setExpandedArticleId(expanded ? null : article.id)
                      }
                    >
                      {expanded ? "Schliessen" : "Aufklappen"}
                    </button>
                  </span>
                </div>
                {expanded && (
                  <div className="article-expanded-detail">
                    <ArticleForm
                      article={article}
                      customers={customers}
                      suppliers={suppliers}
                      groups={groups}
                      onSubmit={onSave}
                      onCancel={() => setExpandedArticleId(null)}
                    />
                    <section className="article-expanded-side">
                      <div className="article-gzd-detail">
                        <div className="panel-heading compact-heading">
                          <div>
                            <p className="eyebrow">GUT ZUM DRUCK</p>
                            <h3>{article.templates.length} Dateien</h3>
                          </div>
                          <label className="file-label">
                            GzD hinzufügen
                            <input
                              type="file"
                              accept=".pdf,image/*,.ai,.eps,.zip"
                              onChange={(event) =>
                                onAttachTemplate(event, article.id)
                              }
                            />
                          </label>
                        </div>
                        {article.templates.length ? (
                          <div className="article-gzd-files">
                            {article.templates.map((template) => (
                              <span className="file-badge" key={template.id}>
                                <strong>{template.file}</strong>
                                <small>{template.addedAt}</small>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="empty-copy">
                            Noch keine GzD-Datei hinterlegt.
                          </p>
                        )}
                      </div>
                      <div className="article-document-history">
                        <div className="panel-heading compact-heading">
                          <div>
                            <p className="eyebrow">BELEGVERLAUF</p>
                            <h3>{articleDocuments.length} Belege</h3>
                          </div>
                        </div>
                        <div className="article-document-history-list">
                          {articleDocuments.length ? (
                            articleDocuments.map((document) => (
                              <button
                                key={document.id}
                                onClick={() => onOpenDocument(document.id)}
                              >
                                <span>
                                  <strong>{document.number}</strong>
                                  <small>
                                    Projekt {document.projectId ?? "–"} · {document.date}
                                  </small>
                                </span>
                                <span>{document.type}</span>
                                <Status>{document.status}</Status>
                                <b>→</b>
                              </button>
                            ))
                          ) : (
                            <p className="empty-copy">
                              Zu diesem Artikel bestehen noch keine Belege.
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        className="danger-button article-delete-button"
                        onClick={() => onDelete(article)}
                      >
                        Artikel löschen
                      </button>
                    </section>
                  </div>
                )}
              </article>
            );
          })}
          {visibleArticles.length === 0 && (
            <p className="empty-copy">Keine Artikel entsprechen der Suche.</p>
          )}
        </div>
      </div>
    </section>
  );
}
function ArticleForm({
  article,
  customers,
  suppliers,
  groups,
  onSubmit,
  onCancel,
}: {
  article?: Article;
  customers: Customer[];
  suppliers: Supplier[];
  groups: string[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="quick-form article-form article-form--extended"
      onSubmit={onSubmit}
    >
      {article && <input type="hidden" name="articleId" value={article.id} />}
      <div className="form-section-title">Stammdaten</div>
      <label>
        Bezeichnung 1
        <input
          name="designation1"
          defaultValue={article?.designation1}
          required
        />
      </label>
      <label>
        Bezeichnung 2
        <input name="designation2" defaultValue={article?.designation2} />
      </label>
      <label>
        SKU <small>leer = automatisch</small>
        <input name="sku" defaultValue={article?.sku} />
      </label>
      <label>
        Kunde
        <select name="customerId" defaultValue={article?.customerId ?? ""}>
          <option value="">Nicht zugeordnet</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Lieferant oder Gruppe
        <select
          name="supplier"
          defaultValue={article?.supplier ?? "Nicht zugeordnet"}
        >
          <option>Nicht zugeordnet</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id}>{supplier.name}</option>
          ))}
          {groups.map((group) => (
            <option key={`group-${group}`} value={`group:${group}`}>
              Gruppe · {group}
            </option>
          ))}
        </select>
      </label>
      <label>
        Bestand
        <input
          name="stock"
          type="number"
          defaultValue={article?.stock ?? 0}
        />
      </label>
      <label>
        Meldebestand
        <input
          name="minimum"
          type="number"
          min="0"
          defaultValue={article?.minimum ?? 0}
        />
      </label>
      <label>
        Preis / Stück
        <input
          name="unitPrice"
          type="number"
          min="0"
          step="0.01"
          defaultValue={article?.unitPrice ?? 0}
        />
      </label>
      <button className="primary-button" type="submit">
        {article ? "Änderungen speichern" : "Artikel eröffnen"}
      </button>
      <button className="secondary-button" type="button" onClick={onCancel}>
        Abbrechen
      </button>
    </form>
  );
}

function ReorderModal({
  article,
  templates,
  onCancel,
  onCollective,
  onSubmit,
}: {
  article: Article;
  templates: GzdTemplate[];
  onCancel: () => void;
  onCollective: () => void;
  onSubmit: (data: {
    quantities: number[];
    deliveryDate: string;
    note: string;
    printFile?: string;
    printFileUrl?: string;
  }) => void;
}) {
  const [quantities, setQuantities] = useState(["", "", "", "", ""]);
  const [quantityError, setQuantityError] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [note, setNote] = useState("");
  const [template, setTemplate] = useState(
    templates[0] ? String(templates[0].id) : "",
  );
  const [upload, setUpload] = useState<{ name: string; url: string } | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  return (
    <div className="modal-backdrop">
      <form
        className="modal-card reorder-modal"
        onSubmit={(event) => {
          event.preventDefault();
          const values = quantities.map(Number).filter((value) => value > 0);
          if (!values.length) {
            setQuantityError("Bitte mindestens eine Staffelmenge eintragen.");
            return;
          }
          const selectedTemplate = templates.find(
            (item) => String(item.id) === template,
          );
          onSubmit({
            quantities: values,
            deliveryDate,
            note,
            printFile: upload?.name || selectedTemplate?.file || undefined,
            printFileUrl: upload?.url || selectedTemplate?.url,
          });
        }}
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">ANFRAGE STARTEN</p>
            <h2>{article.name}</h2>
          </div>
          <div className="reorder-heading-actions">
            <button
              className="primary-button collective-start-button"
              type="button"
              onClick={onCollective}
            >
              + Sammelanfrage starten
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={onCancel}
            >
              Schliessen
            </button>
          </div>
        </div>
        <p className="muted">
          Artikel {article.sku} · bis zu fünf frei definierbare Anfrage-Staffeln
        </p>
        <div className="reorder-tier-grid">
          {quantities.map((quantity, index) => (
            <label key={index}>
              Staffel {index + 1}
              <input
                type="number"
                min="1"
                value={quantity}
                placeholder="Menge"
                onChange={(event) => {
                  setQuantityError("");
                  setQuantities((current) =>
                    current.map((value, quantityIndex) =>
                      quantityIndex === index ? event.target.value : value,
                    ),
                  );
                }}
              />
            </label>
          ))}
        </div>
        {quantityError && (
          <p className="login-error" role="alert">
            {quantityError}
          </p>
        )}
        <label>
          Wunsch-Lieferdatum
          <input
            type="date"
            value={deliveryDate}
            onChange={(event) => setDeliveryDate(event.target.value)}
            required
          />
        </label>
        <label>
          Bemerkung
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="z. B. gewünschte Ausführung, Verpackung oder Rückfrage"
            rows={3}
          />
        </label>
        {templates.length > 0 && (
          <label>
            Bestehende GzD-Vorlage
            <select
              value={template}
              onChange={(event) => {
                setTemplate(event.target.value);
                setUpload(null);
              }}
            >
              <option value="">Keine Vorlage</option>
              {templates.map((item, index) => (
                <option value={item.id} key={item.id}>
                  {item.file} · {item.addedAt}
                  {index === 0 ? " · Letztes GzD" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Neue Druckdatei hochladen
          <input
            type="file"
            accept=".pdf,image/*,.ai,.eps,.zip"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) {
                setUpload(null);
                return;
              }
              setUploading(true);
              try {
                setUpload(await uploadStoredFile(file));
                setTemplate("");
              } catch (error) {
                setQuantityError(
                  error instanceof Error
                    ? error.message
                    : "Die Datei konnte nicht gespeichert werden.",
                );
              } finally {
                setUploading(false);
              }
            }}
          />
          <small className="muted">
            {uploading
              ? "Datei wird gespeichert…"
              : upload
                ? `${upload.name} ist gespeichert und wird angehängt.`
                : "PDF, JPG, PNG, SVG, AI, EPS oder ZIP"}
          </small>
        </label>
        <div className="reorder-submit">
          <span className="muted">
            Die Anfrage enthält keine Preise. Diese folgen erst mit dem
            Lieferantenangebot.
          </span>
          <button className="primary-button" type="submit" disabled={uploading}>
            {uploading ? "Datei speichern…" : "Anfrage erzeugen"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CollectiveRequestModal({
  articles,
  documents,
  onCancel,
  onSubmit,
}: {
  articles: Article[];
  documents: DocumentRecord[];
  onCancel: () => void;
  onSubmit: (data: {
    items: Array<{
      articleId: number;
      quantities: number[];
      printFile?: string;
      printFileUrl?: string;
    }>;
    deliveryDate: string;
    note: string;
  }) => void;
}) {
  type Draft = {
    quantities: string[];
    template: string;
    upload?: { name: string; url: string };
    uploading: boolean;
  };
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() =>
    Object.fromEntries(
      articles.map((article) => {
        const templates = collectArticleGzdFiles(article, documents);
        return [
          article.id,
          {
            quantities: ["", "", "", "", ""],
            template: templates[0]?.key ?? "",
            uploading: false,
          },
        ];
      }),
    ),
  );
  const [deliveryDate, setDeliveryDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const updateDraft = (articleId: number, update: Partial<Draft>) =>
    setDrafts((current) => ({
      ...current,
      [articleId]: { ...current[articleId], ...update },
    }));
  return (
    <div className="modal-backdrop collective-request-backdrop">
      <form
        className="modal-card collective-request-modal"
        onSubmit={(event) => {
          event.preventDefault();
          const items = articles.map((article) => {
            const draft = drafts[article.id];
            const templates = collectArticleGzdFiles(article, documents);
            const selectedTemplate = templates.find(
              (template) => template.key === draft.template,
            );
            return {
              articleId: article.id,
              quantities: draft.quantities
                .map(Number)
                .filter((quantity) => quantity > 0),
              printFile: draft.upload?.name || selectedTemplate?.name,
              printFileUrl: draft.upload?.url || selectedTemplate?.url,
            };
          });
          if (items.some((item) => !item.quantities.length)) {
            setError(
              "Bitte bei jedem Artikel mindestens eine Staffelmenge eintragen.",
            );
            return;
          }
          onSubmit({ items, deliveryDate, note });
        }}
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">SAMMELANFRAGE</p>
            <h2>{articles.length} Artikel gemeinsam anfragen</h2>
          </div>
          <button className="secondary-button" type="button" onClick={onCancel}>
            Zurück zur Auswahl
          </button>
        </div>
        <p className="muted">
          Staffelmengen und Gut zum Druck werden pro Artikel festgelegt. Das
          Wunsch-Lieferdatum gilt für die gesamte Sammelanfrage.
        </p>
        <div className="collective-request-items">
          {articles.map((article, articleIndex) => {
            const draft = drafts[article.id];
            const templates = collectArticleGzdFiles(article, documents);
            return (
              <fieldset key={article.id}>
                <legend>
                  {articleIndex + 1}. {article.name} · {article.sku}
                </legend>
                <div className="reorder-tier-grid">
                  {draft.quantities.map((quantity, quantityIndex) => (
                    <label key={quantityIndex}>
                      Staffel {quantityIndex + 1}
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        placeholder="Menge"
                        onChange={(event) => {
                          setError("");
                          updateDraft(article.id, {
                            quantities: draft.quantities.map((value, index) =>
                              index === quantityIndex
                                ? event.target.value
                                : value,
                            ),
                          });
                        }}
                      />
                    </label>
                  ))}
                </div>
                <div className="collective-gzd-fields">
                  <label>
                    Gut zum Druck für diesen Artikel
                    <select
                      value={draft.template}
                      onChange={(event) =>
                        updateDraft(article.id, {
                          template: event.target.value,
                          upload: undefined,
                        })
                      }
                    >
                      <option value="">Kein GzD auswählen</option>
                      {templates.map((template, index) => (
                        <option value={template.key} key={template.key}>
                          {template.name}
                          {index === 0 ? " · Letztes GzD" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Neues GzD hochladen
                    <input
                      type="file"
                      accept=".pdf,image/*,.ai,.eps,.zip"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        updateDraft(article.id, { uploading: true });
                        try {
                          const upload = await uploadStoredFile(file);
                          updateDraft(article.id, {
                            upload,
                            template: "",
                            uploading: false,
                          });
                        } catch (uploadError) {
                          updateDraft(article.id, { uploading: false });
                          setError(
                            uploadError instanceof Error
                              ? uploadError.message
                              : "Das GzD konnte nicht gespeichert werden.",
                          );
                        }
                      }}
                    />
                    <small className="muted">
                      {draft.uploading
                        ? "Datei wird gespeichert …"
                        : draft.upload?.name || "Optional"}
                    </small>
                  </label>
                </div>
              </fieldset>
            );
          })}
        </div>
        <div className="collective-request-footer-fields">
          <label>
            Gemeinsames Wunsch-Lieferdatum
            <input
              type="date"
              value={deliveryDate}
              onChange={(event) => setDeliveryDate(event.target.value)}
              required
            />
          </label>
          <label>
            Bemerkung zur Sammelanfrage
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
            />
          </label>
        </div>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button"
          type="submit"
          disabled={Object.values(drafts).some((draft) => draft.uploading)}
        >
          Sammelanfrage jetzt senden →
        </button>
      </form>
    </div>
  );
}

function StockArticleDetail({
  article,
  documents,
  onMinimumChange,
}: {
  article: Article;
  documents: DocumentRecord[];
  onMinimumChange: (articleId: number, minimum: number) => void;
}) {
  const [minimum, setMinimum] = useState(article.minimum);
  const articleDocuments = documents.filter(
    (document) =>
      (document.articleId === article.id ||
        document.items?.some((item) => item.articleId === article.id) ||
        (!document.articleId && document.article === article.name)) &&
      ["Anfrage", "Angebot", "Auftragsbestätigung"].includes(document.type),
  );
  const gzdFiles = collectArticleGzdFiles(article, articleDocuments);
  return (
    <div className="stock-detail-content">
      <div className="stock-detail-toolbar">
        <span>
          <b>Artikelgebundene GzD-Dateien</b>
          {gzdFiles.length
            ? `${gzdFiles.length} Dateien aus Artikel, Kundenanfragen und Lieferantenangeboten`
            : "Keine Dateien hinterlegt"}
        </span>
        <form
          className="minimum-editor"
          onSubmit={(event) => {
            event.preventDefault();
            onMinimumChange(article.id, minimum);
          }}
        >
          <label>
            Meldebestand anpassen
            <input
              type="number"
              min="0"
              value={minimum}
              onChange={(event) =>
                setMinimum(Math.max(0, Number(event.target.value) || 0))
              }
            />
          </label>
          <button type="submit">Speichern</button>
        </form>
      </div>
      <div className="stock-detail-grid">
        <div>
          <p className="eyebrow">BESTANDSVERLAUF</p>
          <div className="stock-history">
            {article.stockHistory.length ? (
              article.stockHistory.map((event, index) => (
                <div key={`${event.date}-${index}`}>
                  <span>{event.date}</span>
                  <strong>{event.stock}</strong>
                  <small>
                    {event.change > 0 ? "+" : ""}
                    {event.change} · {event.reason}
                  </small>
                </div>
              ))
            ) : (
              <p className="empty-copy">Noch kein Verlauf vorhanden.</p>
            )}
          </div>
        </div>
        <div>
          <p className="eyebrow">PROJEKTBELEGE</p>
          <div className="stock-history">
            {articleDocuments.length ? (
              articleDocuments.map((document) => (
                <div key={document.id}>
                  <span>{document.number}</span>
                  <strong>{document.type}</strong>
                  <small>
                    Projekt {document.projectId ?? "-"} · Artikel-Nr. {article.sku}
                    {" · "}
                    {document.items?.find(
                      (item) => item.articleId === article.id,
                    )?.quantity ?? document.quantity}{" "}
                    Stück · {document.status}
                  </small>
                  {document.type !== "Anfrage" && document.pdfUrl && (
                    <button
                      className="text-button"
                      onClick={() =>
                        downloadDocumentPdf(document.pdfUrl!, document.number)
                      }
                    >
                      PDF herunterladen
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="empty-copy">Noch keine Anfrage oder Folgebelege.</p>
            )}
          </div>
        </div>
        <div>
          <p className="eyebrow">GUT ZUM DRUCK</p>
          <div className="article-gzd-files customer-gzd-files">
            {gzdFiles.length ? (
              gzdFiles.map((file, index) => (
                <span
                  className={`file-badge ${index === 0 ? "is-latest-gzd" : ""}`}
                  key={file.key}
                >
                  {index === 0 && (
                    <em className="latest-gzd-badge">Letztes GzD</em>
                  )}
                  <strong>{file.name}</strong>
                  <small>
                    {file.source} · {file.addedAt}
                  </small>
                  {file.url ? (
                    <a
                      className="text-button"
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Datei öffnen ↗
                    </a>
                  ) : (
                    <small>Nur Dateiname gespeichert</small>
                  )}
                </span>
              ))
            ) : (
              <p className="empty-copy">
                Noch keine GzD-Datei an diesem Artikel.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerPortal({
  customer,
  employee,
  articles,
  documents,
  onExit,
  onReorder,
  onMinimumChange,
  backendPreview,
}: {
  customer: Customer;
  employee: Employee;
  articles: Article[];
  documents: DocumentRecord[];
  onExit: () => void;
  onReorder: (article: Article) => void;
  onMinimumChange: (articleId: number, minimum: number) => void;
  backendPreview: boolean;
}) {
  const [reorderArticle, setReorderArticle] = useState<Article | null>(null);
  const [collectiveSupplier, setCollectiveSupplier] = useState<string | null>(
    null,
  );
  const [collectiveArticleIds, setCollectiveArticleIds] = useState<number[]>(
    [],
  );
  const [collectiveReviewOpen, setCollectiveReviewOpen] = useState(false);
  const [filter, setFilter] = useState<DocumentType | null>(null);
  const [offerQuantities, setOfferQuantities] = useState<
    Record<string, number>
  >({});
  const [stockOpen, setStockOpen] = useState(false);
  const [selectedStockArticleId, setSelectedStockArticleId] = useState<
    number | null
  >(null);
  const [stockSkuQuery, setStockSkuQuery] = useState("");
  const [stockNameQuery, setStockNameQuery] = useState("");
  const [stockSignal, setStockSignal] = useState<StockSignal | "alle">("alle");
  const [stockSort, setStockSort] = useState<
    "name" | "sku" | "stock-asc" | "stock-desc"
  >("name");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [requestConfirmation, setRequestConfirmation] = useState<{
    article: string;
    sku: string;
    mailStatus: "sending" | "sent" | "error";
    mailMessage?: string;
  } | null>(null);
  useEffect(() => {
    const onMailStatus = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          status: "sent" | "error";
          message: string;
        }>
      ).detail;
      setRequestConfirmation((current) =>
        current
          ? {
              ...current,
              mailStatus: detail.status,
              mailMessage: detail.message,
            }
          : current,
      );
    };
    window.addEventListener("printcenter:request-mail-status", onMailStatus);
    return () =>
      window.removeEventListener(
        "printcenter:request-mail-status",
        onMailStatus,
      );
  }, []);
  const ownArticles = articles.filter(
    (article) => article.customerId === customer.id,
  );
  const normalizePortalFilter = (value: string) =>
    value.trim().toLocaleLowerCase("de-CH");
  const visibleStockArticles = ownArticles
    .filter((article) => {
      const signal = stockSignalFor(article);
      return (
        (stockSignal === "alle" || signal === stockSignal) &&
        (!stockSkuQuery ||
          normalizePortalFilter(article.sku).includes(
            normalizePortalFilter(stockSkuQuery),
          )) &&
        (!stockNameQuery ||
          normalizePortalFilter(article.name).includes(
            normalizePortalFilter(stockNameQuery),
          ))
      );
    })
    .sort((left, right) => {
      if (stockSort === "sku")
        return left.sku.localeCompare(right.sku, "de-CH");
      if (stockSort === "stock-asc") return left.stock - right.stock;
      if (stockSort === "stock-desc") return right.stock - left.stock;
      return left.name.localeCompare(right.name, "de-CH");
    });
  const ownDocuments = documents.filter(
    (document) =>
      document.employeeId === employee.id && document.type !== "Bestellung",
  );
  const newOffers = ownDocuments.filter(
    (document) => document.type === "Angebot" && document.status === "Offen",
  );
  const customerArticleDocuments = documents.filter(
    (document) => document.customerId === customer.id,
  );
  const shownDocuments = filter
    ? ownDocuments.filter((document) => document.type === filter)
    : ownDocuments;
  function submitRequest(data: {
    quantities: number[];
    deliveryDate: string;
    note: string;
    printFile?: string;
    printFileUrl?: string;
  }) {
    if (!reorderArticle) return;
    window.dispatchEvent(
      new CustomEvent("printcenter:request", {
        detail: {
          customerId: customer.id,
          employeeId: employee.id,
          articleId: reorderArticle.id,
          ...data,
        },
      }),
    );
    onReorder(reorderArticle);
    setRequestConfirmation({
      article: reorderArticle.name,
      sku: reorderArticle.sku,
      mailStatus: "sending",
    });
    setReorderArticle(null);
    setFilter("Anfrage");
  }
  function startCollectiveRequest(article: Article) {
    setCollectiveSupplier(article.supplier);
    setCollectiveArticleIds([article.id]);
    setCollectiveReviewOpen(false);
    setReorderArticle(null);
    setStockOpen(true);
    setSelectedStockArticleId(null);
  }
  function cancelCollectiveRequest() {
    setCollectiveSupplier(null);
    setCollectiveArticleIds([]);
    setCollectiveReviewOpen(false);
  }
  function toggleCollectiveArticle(article: Article) {
    if (article.supplier !== collectiveSupplier) return;
    setCollectiveArticleIds((current) =>
      current.includes(article.id)
        ? current.filter((articleId) => articleId !== article.id)
        : [...current, article.id],
    );
  }
  function submitCollectiveRequest(data: {
    items: Array<{
      articleId: number;
      quantities: number[];
      printFile?: string;
      printFileUrl?: string;
    }>;
    deliveryDate: string;
    note: string;
  }) {
    window.dispatchEvent(
      new CustomEvent("printcenter:collective-request", {
        detail: {
          customerId: customer.id,
          employeeId: employee.id,
          supplier: collectiveSupplier,
          ...data,
        },
      }),
    );
    setRequestConfirmation({
      article: `Sammelanfrage mit ${data.items.length} Artikeln`,
      sku: collectiveSupplier ?? "Lieferant",
      mailStatus: "sending",
    });
    cancelCollectiveRequest();
    setFilter("Anfrage");
  }
  function openTile(type: DocumentType) {
    cancelCollectiveRequest();
    setStockOpen(false);
    setSelectedStockArticleId(null);
    setReorderArticle(null);
    setFilter(type);
  }
  function accept(document: DocumentRecord) {
    const quantity = offerQuantities[document.id] ?? document.quantity;
    const itemQuantities = document.items?.length
      ? Object.fromEntries(
          document.items.map((item) => [
            String(item.articleId),
            offerQuantities[`${document.id}:${item.articleId}`] ?? item.quantity,
          ]),
        )
      : undefined;
    window.dispatchEvent(
      new CustomEvent("printcenter:offer-accept", {
        detail: { offerId: document.id, quantity, itemQuantities },
      }),
    );
  }
  return (
    <main className="portal-shell">
      <header className="portal-header">
        <div className="brand brand--portal">
          <Monogram small />
          <span>printcenter</span>
        </div>
        <div className="portal-header-actions">
          <div className="portal-notifications">
            <button
              className="portal-notification-button"
              type="button"
              aria-label={`${newOffers.length} neue Angebote`}
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((current) => !current)}
            >
              <span className="portal-bell-icon" aria-hidden="true" />
              {newOffers.length > 0 && <b>{newOffers.length}</b>}
            </button>
            {notificationsOpen && (
              <div className="portal-notification-menu">
                <strong>Neue Angebote</strong>
                {newOffers.length ? (
                  newOffers.map((offer) => (
                    <button
                      type="button"
                      key={offer.id}
                      onClick={() => {
                        openTile("Angebot");
                        setNotificationsOpen(false);
                      }}
                    >
                      <span>{offer.number}</span>
                      <small>
                        {offer.article} · Projekt {offer.projectId ?? offer.id}
                      </small>
                    </button>
                  ))
                ) : (
                  <small>Keine neuen Angebote vorhanden.</small>
                )}
              </div>
            )}
          </div>
          <span className="portal-customer">
            <strong>{customer.name}</strong>
            <small>
              {customer.number} · {employee.email}
            </small>
          </span>
          <button className="portal-button" onClick={onExit}>
            {backendPreview ? "Portalansicht schliessen" : "Abmelden"}
          </button>
        </div>
      </header>
      <section className="portal-tiles">
        <button
          className={`portal-tile portal-stock-tile ${stockOpen ? "is-active" : ""}`}
          onClick={() => {
            setFilter(null);
            setReorderArticle(null);
            setStockOpen(true);
            setSelectedStockArticleId(null);
          }}
        >
          <span>01</span>
          <strong>Meine Lagerartikel und Nachbestellung starten</strong>
          <small>Bestand prüfen oder direkt eine Anfrage starten →</small>
        </button>
        {portalDocumentTypes.map((type, index) => {
          const count = ownDocuments.filter(
            (document) => document.type === type,
          ).length;
          return (
            <button
              className={`portal-tile ${filter === type ? "is-active" : ""}`}
              key={type}
              onClick={() => openTile(type)}
            >
              <span>0{index + 2}</span>
              <strong>{type}</strong>
              <small>
                {count} {count === 1 ? "Beleg" : "Belege"} ansehen →
              </small>
            </button>
          );
        })}
      </section>
      {stockOpen && (
        <section className="portal-section stock-detail">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">MEINE LAGERARTIKEL</p>
              <h2>Alle Angaben auf einen Blick</h2>
            </div>
            <button
              className="secondary-button"
              onClick={() => {
                setStockOpen(false);
                setSelectedStockArticleId(null);
              }}
            >
              Schliessen
            </button>
          </div>
          {collectiveSupplier && (
            <div className="collective-selection-banner">
              <div>
                <p className="eyebrow">SAMMELANFRAGE AKTIV</p>
                <strong>{collectiveSupplier}</strong>
                <span>
                  Es können nur Artikel mit diesem Lieferanten hinzugefügt
                  werden.
                </span>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={cancelCollectiveRequest}
              >
                Sammelanfrage abbrechen
              </button>
            </div>
          )}
          <div className="stock-filter-bar">
            <label>
              Artikelnummer / SKU
              <input
                type="search"
                value={stockSkuQuery}
                onChange={(event) => setStockSkuQuery(event.target.value)}
                placeholder="z. B. ART-10024"
              />
            </label>
            <label>
              Artikelname
              <input
                type="search"
                value={stockNameQuery}
                onChange={(event) => setStockNameQuery(event.target.value)}
                placeholder="Artikelbezeichnung"
              />
            </label>
            <label>
              Ampelstatus
              <select
                value={stockSignal}
                onChange={(event) =>
                  setStockSignal(event.target.value as StockSignal | "alle")
                }
              >
                <option value="alle">Alle Ampeln</option>
                <option value="rot">Rot · Minusbestand</option>
                <option value="gelb">Gelb · bis Meldebestand</option>
                <option value="grün">Grün · über Meldebestand</option>
              </select>
            </label>
            <label>
              Sortierung
              <select
                value={stockSort}
                onChange={(event) =>
                  setStockSort(event.target.value as typeof stockSort)
                }
              >
                <option value="name">Artikelname A–Z</option>
                <option value="sku">Artikelnummer A–Z</option>
                <option value="stock-asc">Bestand aufsteigend</option>
                <option value="stock-desc">Bestand absteigend</option>
              </select>
            </label>
            <span>
              {visibleStockArticles.length} von {ownArticles.length} Artikeln
            </span>
          </div>
          <div className="stock-article-list">
            <div className="stock-article-list-head">
              <span>SKU</span>
              <span>Artikel</span>
              <span>Bestand</span>
              <span>Meldebestand</span>
              <span>Ampel</span>
              <span>Deckung</span>
              <span>GzD</span>
              <span>Details</span>
              <span>{collectiveSupplier ? "Sammelwahl" : "Anfrage"}</span>
            </div>
            {visibleStockArticles.map((article) => {
              const expanded = selectedStockArticleId === article.id;
              const signal = stockSignalFor(article);
              const coverage = article.stock - article.minimum;
              const articleGzdFiles = collectArticleGzdFiles(
                article,
                customerArticleDocuments,
              );
              const gzdCount = articleGzdFiles.length;
              const collectiveEligible = collectiveSupplier
                ? article.supplier === collectiveSupplier
                : false;
              const collectiveSelected = collectiveArticleIds.includes(
                article.id,
              );
              return (
                <article
                  className={`stock-article-item ${expanded ? "is-expanded" : ""}`}
                  key={article.id}
                >
                  <div
                    className={`stock-article-row ${expanded ? "is-selected" : ""}`}
                  >
                    <span className="sku" data-label="SKU">
                      {article.sku}
                    </span>
                    <strong>{article.name}</strong>
                    <span data-label="Bestand">{article.stock} Stück</span>
                    <span data-label="Meldebestand">
                      {article.minimum} Stück
                    </span>
                    <span
                      className="stock-signal-cell"
                      data-label="Ampel"
                      aria-label={`Ampelstatus ${signal}`}
                    >
                      <i
                        className={`stock-signal stock-signal--${signal}`}
                        aria-hidden="true"
                      />
                    </span>
                    <span
                      className={`stock-coverage stock-coverage--${signal}`}
                      data-label="Deckung"
                    >
                      {coverage > 0 ? "+" : ""}
                      {coverage} Stück
                    </span>
                    <span className="stock-gzd-summary" data-label="GzD">
                      {gzdCount} {gzdCount === 1 ? "Datei" : "Dateien"}
                      {articleGzdFiles[0] && (
                        <small title={articleGzdFiles[0].name}>
                          Letztes GzD
                        </small>
                      )}
                    </span>
                    <button
                      className="stock-expand-button"
                      aria-expanded={expanded}
                      onClick={() =>
                        setSelectedStockArticleId(expanded ? null : article.id)
                      }
                    >
                      {expanded ? "Einklappen ↑" : "Aufklappen ↓"}
                    </button>
                    <button
                      className={`stock-request-button ${collectiveSelected ? "is-selected" : ""}`}
                      disabled={Boolean(
                        collectiveSupplier && !collectiveEligible,
                      )}
                      onClick={() =>
                        collectiveSupplier
                          ? toggleCollectiveArticle(article)
                          : setReorderArticle(article)
                      }
                    >
                      {collectiveSupplier
                        ? collectiveEligible
                          ? collectiveSelected
                            ? "✓ Hinzugefügt"
                            : "+ Hinzufügen"
                          : "Anderer Lieferant"
                        : "Anfrage starten →"}
                    </button>
                  </div>
                  {expanded && (
                    <StockArticleDetail
                      article={article}
                      documents={customerArticleDocuments}
                      onMinimumChange={onMinimumChange}
                    />
                  )}
                </article>
              );
            })}
            {visibleStockArticles.length === 0 && (
              <p className="empty-copy">
                Keine Lagerartikel entsprechen der Suche oder dem Ampelfilter.
              </p>
            )}
          </div>
        </section>
      )}
      {collectiveSupplier && !collectiveReviewOpen && (
        <button
          className="collective-cart-button"
          type="button"
          disabled={!collectiveArticleIds.length}
          onClick={() => setCollectiveReviewOpen(true)}
        >
          <span>{collectiveArticleIds.length}</span>
          <strong>Sammelanfrage prüfen</strong>
          <small>{collectiveSupplier} →</small>
        </button>
      )}
      {filter && (
        <PortalDocuments
          documents={shownDocuments}
          articles={articles}
          offerQuantities={offerQuantities}
          setOfferQuantities={setOfferQuantities}
          onAccept={accept}
        />
      )}
      {reorderArticle && (
        <ReorderModal
          article={reorderArticle}
          templates={collectArticleGzdFiles(
            reorderArticle,
            customerArticleDocuments,
          ).map((file) => ({
            id: file.id,
            file: file.name,
            addedAt: file.addedAt,
            url: file.url,
          }))}
          onCancel={() => setReorderArticle(null)}
          onCollective={() => startCollectiveRequest(reorderArticle)}
          onSubmit={submitRequest}
        />
      )}
      {collectiveReviewOpen && collectiveSupplier && (
        <CollectiveRequestModal
          articles={collectiveArticleIds
            .map((articleId) =>
              ownArticles.find((article) => article.id === articleId),
            )
            .filter((article): article is Article => Boolean(article))}
          documents={customerArticleDocuments}
          onCancel={() => setCollectiveReviewOpen(false)}
          onSubmit={submitCollectiveRequest}
        />
      )}
      {requestConfirmation && (
        <div className="modal-backdrop request-confirmation-backdrop">
          <section
            className="modal-card request-confirmation-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-confirmation-title"
          >
            <span className="request-confirmation-mark" aria-hidden="true">
              ✓
            </span>
            <p className="eyebrow">ANFRAGE ERFOLGREICH</p>
            <h2 id="request-confirmation-title">Vielen Dank.</h2>
            <p>
              Ihre Anfrage für <strong>{requestConfirmation.article}</strong> (
              {requestConfirmation.sku}) wurde erstellt und wird nun bearbeitet.
            </p>
            <p
              className={`request-confirmation-mail request-confirmation-mail--${requestConfirmation.mailStatus}`}
              role={
                requestConfirmation.mailStatus === "error" ? "alert" : "status"
              }
            >
              {requestConfirmation.mailStatus === "sending" &&
                "Die Lieferantenmail wird gesendet …"}
              {requestConfirmation.mailStatus === "sent" &&
                (requestConfirmation.mailMessage ||
                  "Die Lieferantenmail wurde erfolgreich versendet.")}
              {requestConfirmation.mailStatus === "error" &&
                `Die Anfrage bleibt gespeichert. Mailversand fehlgeschlagen: ${requestConfirmation.mailMessage || "Unbekannter Fehler"}`}
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={() => setRequestConfirmation(null)}
            >
              Zu meinen Anfragen
            </button>
          </section>
        </div>
      )}
      <footer className="portal-footer">
        <span>printcenter</span>
        <span>Eine URL · eine persönliche Sicht · hello@printcenter.ch</span>
      </footer>
    </main>
  );
}
function PortalDocuments({
  documents,
  articles,
  offerQuantities,
  setOfferQuantities,
  onAccept,
}: {
  documents: DocumentRecord[];
  articles: Article[];
  offerQuantities: Record<string, number>;
  setOfferQuantities: (value: Record<string, number>) => void;
  onAccept: (document: DocumentRecord) => void;
}) {
  const [numberQuery, setNumberQuery] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [articleQuery, setArticleQuery] = useState("");
  const [historyStatus, setHistoryStatus] = useState<
    DocumentRecord["status"] | "Alle"
  >("Alle");
  const [historySort, setHistorySort] = useState<
    "newest" | "oldest" | "number"
  >("newest");
  const normalizeHistoryFilter = (value: string) =>
    value.trim().toLocaleLowerCase("de-CH");
  const articleSkuForDocument = (document: DocumentRecord) =>
    document.items?.length
      ? document.items.map((item) => item.sku).join(", ")
      : (articles.find(
          (article) =>
            article.id === document.articleId || article.name === document.article,
        )?.sku ?? "Nicht zugeordnet");
  const visibleDocuments = documents
    .filter(
      (document) =>
        (!numberQuery ||
          normalizeHistoryFilter(document.number).includes(
            normalizeHistoryFilter(numberQuery),
          )) &&
        (!projectQuery ||
          String(document.projectId ?? document.id).includes(
            projectQuery.trim(),
          )) &&
        (!articleQuery ||
          [
            document.article,
            articleSkuForDocument(document),
            ...(document.items?.flatMap((item) => [item.article, item.sku]) ?? []),
          ].some((value) =>
            normalizeHistoryFilter(value).includes(
              normalizeHistoryFilter(articleQuery),
            ),
          )) &&
        (historyStatus === "Alle" || document.status === historyStatus),
    )
    .sort((left, right) => {
      if (historySort === "oldest")
        return documentCreatedAt(left) - documentCreatedAt(right);
      if (historySort === "number")
        return left.number.localeCompare(right.number, "de-CH");
      return documentCreatedAt(right) - documentCreatedAt(left);
    });
  useEffect(() => {
    const openGzd = (event: MouseEvent) => {
      const button =
        event.target instanceof Element ? event.target.closest("button") : null;
      if (!button || button.textContent?.trim() !== "GzD ansehen") return;
      const number = button
        .closest("article")
        ?.querySelector("strong")
        ?.childNodes[0]?.textContent?.trim();
      const offer = documents.find((item) => item.number === number);
      if (!offer) return;
      event.preventDefault();
      event.stopPropagation();
      if (offer.supplierGzdUrl)
        window.open(offer.supplierGzdUrl, "_blank", "noopener,noreferrer");
      else
        window.alert(
          `Gut zum Druck: ${offer.supplierGzd}\nStatus: ${offer.gzdStatus ?? "In Prüfung"}\nFür ältere Dateien ist nur der Dateiname gespeichert.`,
        );
    };
    document.addEventListener("click", openGzd, true);
    return () => document.removeEventListener("click", openGzd, true);
  }, [documents]);
  return (
    <section className="portal-section portal-documents">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">MEINE BELEGE</p>
          <h2>Historie</h2>
        </div>
        <span className="muted">
          {visibleDocuments.length} von {documents.length} Belegen
        </span>
      </div>
      <div className="portal-history-filters">
        <label>
          Belegnummer
          <input
            type="search"
            value={numberQuery}
            onChange={(event) => setNumberQuery(event.target.value)}
            placeholder="z. B. AN-2026-114"
          />
        </label>
        <label>
          Projektnummer
          <input
            type="search"
            value={projectQuery}
            onChange={(event) => setProjectQuery(event.target.value)}
            placeholder="Projekt-ID"
          />
        </label>
        <label>
          Artikel / Artikelnummer
          <input
            type="search"
            value={articleQuery}
            onChange={(event) => setArticleQuery(event.target.value)}
            placeholder="Bezeichnung oder SKU"
          />
        </label>
        <label>
          Status
          <select
            value={historyStatus}
            onChange={(event) =>
              setHistoryStatus(
                event.target.value as DocumentRecord["status"] | "Alle",
              )
            }
          >
            <option>Alle</option>
            <option>Offen</option>
            <option>Versendet</option>
            <option>Bestätigt</option>
          </select>
        </label>
        <label>
          Sortierung
          <select
            value={historySort}
            onChange={(event) =>
              setHistorySort(event.target.value as typeof historySort)
            }
          >
            <option value="newest">Neueste zuerst</option>
            <option value="oldest">Älteste zuerst</option>
            <option value="number">Belegnummer A–Z</option>
          </select>
        </label>
      </div>
      <div className="portal-document-list">
        {visibleDocuments.length ? (
          visibleDocuments.map((document) => {
            const articleSku = articleSkuForDocument(document);
            const collectiveItems = document.items ?? [];
            const options = document.offerOptions ?? [
              { quantity: document.quantity, unitPrice: document.unitPrice },
            ];
            const selectedQuantity =
              offerQuantities[document.id] ?? document.quantity;
            const selectedOption =
              options.find((option) => option.quantity === selectedQuantity) ??
              options[0];
            const selectedTotal = collectiveItems.length
              ? collectiveItems.reduce((sum, item) => {
                  const itemOptions = item.offerOptions ?? [
                    {
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      supplierTotal: item.subtotal,
                    },
                  ];
                  const itemQuantity =
                    offerQuantities[`${document.id}:${item.articleId}`] ??
                    item.quantity;
                  const itemOption =
                    itemOptions.find(
                      (option) => option.quantity === itemQuantity,
                    ) ?? itemOptions[0];
                  return (
                    sum +
                    customerTotalForOption(
                      itemOption,
                      document.markupPercent,
                    )
                  );
                }, 0)
              : customerTotalForOption(selectedOption, document.markupPercent);
            const customerPriceDocument =
              document.type === "Angebot" ||
              document.type === "Auftragsbestätigung";
            const displayedTotal =
              document.type === "Angebot" ? selectedTotal : document.total;
            const displayedUnitPrice =
              collectiveItems.length
                ? 0
                : displayedTotal /
              (document.type === "Angebot"
                ? selectedOption.quantity
                : document.quantity);
            const requestOffered =
              document.type === "Anfrage" && document.status === "Bestätigt";
            const offerStatus =
              document.type === "Angebot"
                ? document.status === "Bestätigt"
                  ? "Bestellt"
                  : document.status === "Offen"
                    ? "Offen"
                    : document.status
                : null;
            const confirmationDeliveryDate =
              document.type === "Auftragsbestätigung"
                ? document.supplierDeliveryDate ?? document.deliveryDate
                : undefined;
            return (
              <article
                className={
                  collectiveItems.length > 0
                    ? "portal-document-item--collective"
                    : undefined
                }
                key={document.id}
              >
                <strong>
                  {document.number}
                  <small>Projekt {document.projectId ?? "-"}</small>
                </strong>
                <span>
                  {document.type} · {document.article}
                  <small className="portal-document-sku">
                    Artikel-Nr. {articleSku}
                  </small>
                  {collectiveItems.length > 0 && (
                    <div className="portal-collective-items">
                      {collectiveItems.map((item) => (
                        <span key={item.articleId}>
                          <strong>{item.article}</strong>
                          <small>{item.sku}</small>
                        </span>
                      ))}
                    </div>
                  )}
                  <small>
                    {document.supplierDeliveryDate &&
                    document.type !== "Auftragsbestätigung"
                      ? `Lieferdatum: ${document.supplierDeliveryDate}`
                      : document.supplierLeadTime
                        ? `Lieferzeit: ${document.supplierLeadTime}`
                        : document.deliveryDate
                          ? `Lieferung: ${document.deliveryDate}`
                          : ""}
                    {document.type === "Anfrage" && document.requestedQuantities
                      ? ` · Staffeln: ${document.requestedQuantities.join(" / ")}`
                      : ""}
                  </small>
                  {document.printFile && (
                    <small>GzD Kunde: {document.printFile}</small>
                  )}
                  {document.type === "Angebot" && document.supplierGzd && (
                    <div className="portal-gzd">
                      <span className="portal-gzd-file">
                        <b>Gut zum Druck</b>
                        <small>{document.supplierGzd}</small>
                      </span>
                      <label className="portal-gzd-status">
                        <span>Status</span>
                        <select
                          value={document.gzdStatus ?? "In Prüfung"}
                          onChange={(event) =>
                            window.dispatchEvent(
                              new CustomEvent("printcenter:gzd-status", {
                                detail: {
                                  documentId: document.id,
                                  status: event.target.value as GzdStatus,
                                },
                              }),
                            )
                          }
                        >
                          <option>In Prüfung</option>
                          <option>Freigegeben</option>
                          <option>Abgelehnt</option>
                        </select>
                      </label>
                    </div>
                  )}
                  {document.type === "Angebot" &&
                    collectiveItems.some((item) => item.supplierGzd) && (
                      <div className="portal-collective-gzds">
                        {collectiveItems
                          .filter((item) => item.supplierGzd)
                          .map((item) => (
                            <div
                              key={item.articleId}
                              className="portal-collective-gzd-row"
                            >
                              {item.supplierGzdUrl ? (
                                <a
                                  className="text-button"
                                  href={item.supplierGzdUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  GzD {item.sku}: {item.supplierGzd} ↗
                                </a>
                              ) : (
                                <span>
                                  GzD {item.sku}: {item.supplierGzd}
                                </span>
                              )}
                              <select
                                aria-label={`GzD-Status für ${item.sku}`}
                                value={item.gzdStatus ?? "In Prüfung"}
                                onChange={(event) =>
                                  window.dispatchEvent(
                                    new CustomEvent("printcenter:gzd-status", {
                                      detail: {
                                        documentId: document.id,
                                        articleId: item.articleId,
                                        status: event.target.value as GzdStatus,
                                      },
                                    }),
                                  )
                                }
                              >
                                <option>In Prüfung</option>
                                <option>Freigegeben</option>
                                <option>Abgelehnt</option>
                              </select>
                            </div>
                          ))}
                      </div>
                    )}
                </span>
                {document.type === "Anfrage" ? (
                  <b
                    className={`price-pending ${requestOffered ? "is-offered" : ""}`}
                  >
                    {requestOffered ? "Offeriert" : "Offen"}
                    <small>
                      {requestOffered
                        ? "Angebot ist verfügbar"
                        : "Preis folgt mit Angebot"}
                    </small>
                  </b>
                ) : (
                  <div className="portal-price-status">
                    {offerStatus && (
                      <span
                        className={`offer-status offer-status--${offerStatus.toLocaleLowerCase("de-CH")}`}
                      >
                        {offerStatus}
                      </span>
                    )}
                    <b>
                      {formatMoney(displayedTotal)}
                      {customerPriceDocument && (
                        <small>
                          {collectiveItems.length
                            ? `${collectiveItems.length} Artikel · exkl. MwSt.`
                            : `${formatUnitMoney(displayedUnitPrice)} / Stück · exkl. MwSt.`}
                        </small>
                      )}
                    </b>
                    {confirmationDeliveryDate && (
                      <span className="confirmation-delivery">
                        <span>
                          Liefertermin
                          <strong>
                            {formatPortalDate(confirmationDeliveryDate)}
                          </strong>
                        </span>
                        <button
                          className="delivery-info"
                          type="button"
                          aria-label="Hinweis zum Liefertermin"
                        >
                          i
                          <span role="tooltip">
                            Der angegebene Liefertermin bezeichnet die
                            Anlieferung in unserem Lager. Die anschliessende
                            Warenprüfung und Einlagerung können zusätzliche Zeit
                            beanspruchen.
                          </span>
                        </button>
                      </span>
                    )}
                  </div>
                )}
                <div className="portal-document-actions">
                  {document.type !== "Anfrage" &&
                    (document.pdfUrl ? (
                      <button
                        className="text-button"
                        onClick={() =>
                          downloadDocumentPdf(document.pdfUrl!, document.number)
                        }
                      >
                        {document.type === "Angebot"
                          ? "Angebot herunterladen"
                          : `${document.type} herunterladen`}
                      </button>
                    ) : (
                      <small>PDF wird erstellt…</small>
                    ))}
                  {document.type === "Angebot" && document.supplierGzd && (
                    <button
                      className="text-button"
                      onClick={() =>
                        window.alert(
                          `Gut zum Druck: ${document.supplierGzd}\nStatus: ${document.gzdStatus ?? "In Prüfung"}`,
                        )
                      }
                    >
                      GzD ansehen
                    </button>
                  )}
                  {document.type === "Angebot" &&
                    document.status === "Offen" && (
                      <div className="offer-actions">
                        {collectiveItems.length > 0 ? (
                          <div className="collective-offer-selection">
                            {collectiveItems.map((item) => {
                              const itemOptions = item.offerOptions ?? [];
                              const selected =
                                offerQuantities[
                                  `${document.id}:${item.articleId}`
                                ] ?? item.quantity;
                              return (
                                <label key={item.articleId}>
                                  <span>
                                    {item.article} <small>{item.sku}</small>
                                  </span>
                                  <select
                                    value={selected}
                                    onChange={(event) =>
                                      setOfferQuantities({
                                        ...offerQuantities,
                                        [`${document.id}:${item.articleId}`]:
                                          Number(event.target.value),
                                      })
                                    }
                                  >
                                    {itemOptions.map((option) => {
                                      const total = customerTotalForOption(
                                        option,
                                        document.markupPercent,
                                      );
                                      return (
                                        <option
                                          value={option.quantity}
                                          key={option.quantity}
                                        >
                                          {option.quantity} Stück · {formatMoney(total)}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </label>
                              );
                            })}
                          </div>
                        ) : options.length > 1 ? (
                          <select
                            aria-label={`Menge für ${document.number}`}
                            value={selectedQuantity}
                            onChange={(event) =>
                              setOfferQuantities({
                                ...offerQuantities,
                                [document.id]: Number(event.target.value),
                              })
                            }
                          >
                            {options.map((option) => {
                              const total = customerTotalForOption(
                                option,
                                document.markupPercent,
                              );
                              return (
                                <option
                                  value={option.quantity}
                                  key={option.quantity}
                                >
                                  {option.quantity} Stück ·{" "}
                                  {formatUnitMoney(total / option.quantity)} /
                                  Stück · {formatMoney(total)} exkl. MwSt.
                                </option>
                              );
                            })}
                          </select>
                        ) : null}
                        <button
                          className="primary-button"
                          onClick={() => onAccept(document)}
                        >
                          Angebot annehmen
                        </button>
                        <button
                          className="danger-button"
                          onClick={() =>
                            window.dispatchEvent(
                              new CustomEvent("printcenter:offer-reject", {
                                detail: { offerId: document.id },
                              }),
                            )
                          }
                        >
                          Ablehnen
                        </button>
                      </div>
                    )}
                </div>
              </article>
            );
          })
        ) : (
          <p className="empty-copy">
            {documents.length
              ? "Keine Belege entsprechen den gewählten Filtern."
              : "In der Historie liegen noch keine Belege vor."}
          </p>
        )}
      </div>
    </section>
  );
}

function CustomerEntryLogin({
  initialCustomerNumber = "",
  onSubmit,
}: {
  initialCustomerNumber?: string;
  onSubmit: (
    customerNumber: string,
    email: string,
    password: string,
  ) => boolean;
}) {
  const [error, setError] = useState("");
  return (
    <main className="portal-login customer-entry-login">
      <section className="login-panel portal-login-panel">
        <div className="brand brand--login">
          <Monogram />
          <span>
            print
            <br />
            center
          </span>
        </div>
        <p className="eyebrow">KUNDENPORTAL</p>
        <h1>Kundenlogin.</h1>
        <p className="login-copy">
          Melde dich mit Kundennummer, persönlicher Mailadresse und Passwort
          an.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const success = onSubmit(
              String(data.get("customerNumber") || ""),
              String(data.get("email") || ""),
              String(data.get("password") || ""),
            );
            setError(
              success
                ? ""
                : "Kundennummer, Mailadresse oder Passwort ist nicht korrekt.",
            );
          }}
        >
          <label>
            Kundennummer
            <input
              name="customerNumber"
              required
              defaultValue={initialCustomerNumber}
              autoComplete="organization"
              placeholder="z. B. K-10038"
            />
          </label>
          <label>
            Mailadresse
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="name@kunde.ch"
            />
          </label>
          <label>
            Passwort
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Passwort"
            />
          </label>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" type="submit">
            Kundenportal öffnen →
          </button>
        </form>
      </section>
      <div className="login-art" aria-hidden="true">
        <span />
        <i />
        <b />
      </div>
    </main>
  );
}

function PortalLogin({
  customer,
  onLogin,
}: {
  customer: Customer;
  onLogin: (employee: Employee) => void;
}) {
  const [error, setError] = useState("");
  return (
    <main className="portal-login">
      <section className="login-panel portal-login-panel">
        <div className="brand brand--login">
          <Monogram />
          <span>
            print
            <br />
            center
          </span>
        </div>
        <p className="eyebrow">{customer.number} · KUNDENPORTAL</p>
        <h1>{customer.name}</h1>
        <p className="login-copy">
          Melde dich mit deiner persönlichen Mailadresse an.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const email = String(data.get("email") || "")
              .trim()
              .toLowerCase();
            const employee = customer.employees.find(
              (item) => item.email.toLowerCase() === email,
            );
            if (
              !employee ||
              String(data.get("password") || "") !==
                (employee.password ?? "portal")
            ) {
              setError("Mailadresse oder Passwort ist nicht korrekt.");
              return;
            }
            onLogin(employee);
          }}
        >
          <label>
            Mailadresse
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="name@kunde.ch"
            />
          </label>
          <label>
            Passwort
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Passwort"
            />
          </label>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" type="submit">
            Kundenportal öffnen →
          </button>
        </form>
        <p className="demo-login">
          Demo: <strong>{customer.employees[0]?.email ?? "kein Zugang"}</strong>{" "}
          · Passwort <strong>portal</strong>
        </p>
      </section>
      <div className="login-art" aria-hidden="true">
        <span />
        <i />
        <b />
      </div>
    </main>
  );
}

function CollectiveSupplierOffer({
  request,
  onExit,
  submitting,
  setSubmitting,
  submissionError,
  setSubmissionError,
}: {
  request: DocumentRecord;
  onExit: () => void;
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
  submissionError: string;
  setSubmissionError: (value: string) => void;
}) {
  const items = request.items ?? [];
  const [prices, setPrices] = useState<
    Record<string, { unit: string; total: string }>
  >({});
  const [pricesCalculated, setPricesCalculated] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [gzdChoices, setGzdChoices] = useState<Record<number, string>>(
    Object.fromEntries(
      items.map((item) => [item.articleId, item.printFile || ""]),
    ),
  );
  const [gzdUploads, setGzdUploads] = useState<
    Record<number, { name: string; url: string }>
  >({});
  const [gzdUploading, setGzdUploading] = useState<Record<number, boolean>>({});
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [note, setNote] = useState("");
  const priceKey = (articleId: number, quantity: number) =>
    `${articleId}:${quantity}`;
  function calculatePrices() {
    const next: Record<string, { unit: string; total: string }> = {};
    try {
      for (const item of items)
        for (const quantity of item.requestedQuantities ?? [item.quantity]) {
          const key = priceKey(item.articleId, quantity);
          const row = prices[key] ?? { unit: "", total: "" };
          const completed = completeSupplierTier(quantity, row.unit, row.total);
          next[key] = {
            unit: completed.unitPrice.toFixed(6),
            total: completed.supplierTotal.toFixed(2),
          };
        }
      setPrices(next);
      setPricesCalculated(true);
      setPriceError("");
    } catch (error) {
      setPricesCalculated(false);
      setPriceError(
        error instanceof Error
          ? error.message
          : "Die Staffelpreise konnten nicht berechnet werden.",
      );
    }
  }
  return (
    <main className="supplier-portal">
      <header className="portal-header">
        <div className="brand brand--portal">
          <Monogram small />
          <span>printcenter</span>
        </div>
        <button className="portal-button" onClick={onExit}>
          Schliessen
        </button>
      </header>
      <section className="supplier-portal-content collective-supplier-content">
        <p className="eyebrow">SAMMELANFRAGE · {request.number}</p>
        <h1>{items.length} Artikel offerieren.</h1>
        <p className="supplier-lead">
          Bitte erfassen Sie die Staffelpreise und das Gut zum Druck pro
          Artikel. Das verbindliche Lieferdatum gilt für die gesamte Offerte.
        </p>
        <div className="supplier-request-box">
          <p className="eyebrow">ANFRAGEANGABEN</p>
          <p>
            Wunsch-Lieferdatum: <strong>{request.deliveryDate || "auf Anfrage"}</strong>
            {"\n"}
            {request.requestText || request.note || "Keine Zusatzinformationen"}
          </p>
          {request.pdfUrl && (
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                downloadDocumentPdf(request.pdfUrl!, request.number)
              }
            >
              Sammelanfrage-PDF herunterladen
            </button>
          )}
        </div>
        <form
          className="supplier-offer-form collective-supplier-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pricesCalculated || !deliveryDate || submitting) return;
            setSubmitting(true);
            setSubmissionError("");
            window.dispatchEvent(
              new CustomEvent("printcenter:supplier-offer", {
                detail: {
                  requestId: request.id,
                  deliveryDate,
                  deliveryNote,
                  note,
                  items: items.map((item) => {
                    const choice = gzdChoices[item.articleId] || "";
                    const upload = gzdUploads[item.articleId];
                    return {
                      articleId: item.articleId,
                      options: (item.requestedQuantities ?? [item.quantity]).map(
                        (quantity) => {
                          const price = prices[priceKey(item.articleId, quantity)];
                          return {
                            quantity,
                            unitPrice: Number(price.unit),
                            supplierTotal: Number(price.total),
                          };
                        },
                      ),
                      gzd: choice === "__upload__" ? upload?.name : choice,
                      gzdUrl:
                        choice === "__upload__"
                          ? upload?.url
                          : choice === item.printFile
                            ? item.printFileUrl
                            : undefined,
                    };
                  }),
                },
              }),
            );
          }}
        >
          {items.map((item, itemIndex) => {
            const quantities = item.requestedQuantities ?? [item.quantity];
            const choice = gzdChoices[item.articleId] || "";
            return (
              <fieldset className="collective-supplier-item" key={item.articleId}>
                <legend>
                  {itemIndex + 1}. {item.article} · {item.sku}
                </legend>
                {item.printFile && item.printFileUrl && (
                  <a
                    className="text-button"
                    href={item.printFileUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Kunden-GzD ansehen ↗
                  </a>
                )}
                <div className="supplier-tier-prices">
                  <div className="supplier-tier-head">
                    <span>Menge</span>
                    <span>Einzelpreis in CHF</span>
                    <span>Gesamtpreis in CHF</span>
                  </div>
                  {quantities.map((quantity) => {
                    const key = priceKey(item.articleId, quantity);
                    const row = prices[key] ?? { unit: "", total: "" };
                    return (
                      <div className="supplier-tier-row" key={quantity}>
                        <strong>{quantity} Stück</strong>
                        <label>
                          <span>Einzelpreis</span>
                          <input
                            aria-label={`Einzelpreis ${item.sku}, ${quantity} Stück`}
                            type="number"
                            min="0.000001"
                            step="0.000001"
                            value={row.unit}
                            onChange={(event) => {
                              setPricesCalculated(false);
                              setPrices((current) => ({
                                ...current,
                                [key]: { ...row, unit: event.target.value },
                              }));
                            }}
                          />
                        </label>
                        <label>
                          <span>Gesamtpreis</span>
                          <input
                            aria-label={`Gesamtpreis ${item.sku}, ${quantity} Stück`}
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={row.total}
                            onChange={(event) => {
                              setPricesCalculated(false);
                              setPrices((current) => ({
                                ...current,
                                [key]: { ...row, total: event.target.value },
                              }));
                            }}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
                <label className="supplier-full-field supplier-gzd-field">
                  GzD für diesen Artikel bestätigen oder hochladen
                  <select
                    value={choice}
                    onChange={(event) =>
                      setGzdChoices((current) => ({
                        ...current,
                        [item.articleId]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Kein GzD mitsenden</option>
                    {item.printFile && (
                      <option value={item.printFile}>
                        Kunden-GzD bestätigen · {item.printFile}
                      </option>
                    )}
                    <option value="__upload__">Neues GzD hochladen</option>
                  </select>
                  {choice === "__upload__" && (
                    <input
                      type="file"
                      required
                      accept=".pdf,image/*,.ai,.eps,.zip"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setGzdUploading((current) => ({
                          ...current,
                          [item.articleId]: true,
                        }));
                        try {
                          const upload = await uploadStoredFile(file);
                          setGzdUploads((current) => ({
                            ...current,
                            [item.articleId]: upload,
                          }));
                        } catch (error) {
                          setSubmissionError(
                            error instanceof Error
                              ? error.message
                              : "Das GzD konnte nicht gespeichert werden.",
                          );
                        } finally {
                          setGzdUploading((current) => ({
                            ...current,
                            [item.articleId]: false,
                          }));
                        }
                      }}
                    />
                  )}
                  <small>
                    {gzdUploading[item.articleId]
                      ? "Datei wird gespeichert …"
                      : gzdUploads[item.articleId]?.name ||
                        (choice && choice !== "__upload__" ? choice : "Optional")}
                  </small>
                </label>
              </fieldset>
            );
          })}
          {priceError && (
            <p className="login-error supplier-price-message" role="alert">
              {priceError}
            </p>
          )}
          {submissionError && (
            <p className="login-error supplier-price-message" role="alert">
              {submissionError}
            </p>
          )}
          <button
            className="secondary-button supplier-calculate-button"
            type="button"
            onClick={calculatePrices}
          >
            Alle Preise speichern &amp; berechnen
          </button>
          <label className="supplier-full-field">
            Verbindliches Lieferdatum für die gesamte Offerte
            <input
              type="date"
              value={deliveryDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setDeliveryDate(event.target.value)}
              required
            />
          </label>
          <label className="supplier-full-field">
            Optionale Bemerkung zum Lieferdatum
            <textarea
              value={deliveryNote}
              onChange={(event) => setDeliveryNote(event.target.value)}
              rows={2}
            />
          </label>
          <label className="supplier-full-field">
            Nachricht an Printcenter
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
            />
          </label>
          <button
            className="primary-button"
            type="submit"
            disabled={
              !pricesCalculated ||
              submitting ||
              Object.values(gzdUploading).some(Boolean) ||
              items.some(
                (item) =>
                  gzdChoices[item.articleId] === "__upload__" &&
                  !gzdUploads[item.articleId],
              )
            }
          >
            {submitting ? "Offerte wird übermittelt …" : "Sammelofferte senden →"}
          </button>
        </form>
      </section>
    </main>
  );
}

function SupplierPortal({
  request,
  onExit,
}: {
  request?: DocumentRecord;
  onExit: () => void;
}) {
  const [prices, setPrices] = useState<
    Record<number, { unit: string; total: string }>
  >({});
  const [pricesCalculated, setPricesCalculated] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [gzdChoice, setGzdChoice] = useState(request?.printFile ?? "");
  const [gzdUpload, setGzdUpload] = useState("");
  const [gzdUploading, setGzdUploading] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [submittedOfferNumber, setSubmittedOfferNumber] = useState("");
  useEffect(() => {
    const onSubmissionResult = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          status: "success" | "error";
          offerNumber?: string;
          message?: string;
        }>
      ).detail;
      setSubmitting(false);
      if (detail.status === "success") {
        setSubmissionError("");
        setSubmittedOfferNumber(detail.offerNumber || "Angebot");
      } else {
        setSubmissionError(
          detail.message || "Die Offerte konnte nicht übermittelt werden.",
        );
      }
    };
    window.addEventListener(
      "printcenter:supplier-offer-result",
      onSubmissionResult,
    );
    return () =>
      window.removeEventListener(
        "printcenter:supplier-offer-result",
        onSubmissionResult,
      );
  }, []);
  if (submittedOfferNumber)
    return (
      <main className="supplier-portal supplier-success-page">
        <header className="portal-header">
          <div className="brand brand--portal">
            <Monogram small />
            <span>printcenter</span>
          </div>
          <button className="portal-button" onClick={onExit}>
            Schliessen
          </button>
        </header>
        <section className="supplier-success-card" role="status">
          <span className="supplier-success-mark" aria-hidden="true">
            ✓
          </span>
          <p className="eyebrow">OK · OFFERTE ÜBERMITTELT</p>
          <h1>Vielen Dank.</h1>
          <p>
            Ihre Offerte <strong>{submittedOfferNumber}</strong> wurde
            erfolgreich an Printcenter übermittelt. Sie müssen nichts weiter
            unternehmen.
          </p>
          <button className="primary-button" type="button" onClick={onExit}>
            Seite schliessen
          </button>
        </section>
      </main>
    );
  if (!request)
    return (
      <main className="backend-login">
        <section className="login-panel">
          <p className="eyebrow">LIEFERANTENLINK</p>
          <h1>Link nicht mehr verfügbar.</h1>
          <p className="login-copy">
            Die Anfrage wurde bereits abgeschlossen oder der einmalige Link ist
            abgelaufen.
          </p>
        </section>
      </main>
    );
  if (request.items?.length)
    return (
      <CollectiveSupplierOffer
        request={request}
        onExit={onExit}
        submitting={submitting}
        setSubmitting={setSubmitting}
        submissionError={submissionError}
        setSubmissionError={setSubmissionError}
      />
    );
  const quantities = Array.from(
    new Set(
      request.requestedQuantities?.length
        ? request.requestedQuantities
        : [request.quantity],
    ),
  ).sort((a, b) => a - b);
  function updatePrice(
    quantity: number,
    field: "unit" | "total",
    value: string,
  ) {
    setPrices((current) => ({
      ...current,
      [quantity]: {
        unit: current[quantity]?.unit ?? "",
        total: current[quantity]?.total ?? "",
        [field]: value,
      },
    }));
    setPricesCalculated(false);
    setPriceError("");
  }
  function calculatePrices() {
    const next: Record<number, { unit: string; total: string }> = {};
    let error = "";
    for (const quantity of quantities) {
      const row = prices[quantity] ?? { unit: "", total: "" };
      try {
        const completed = completeSupplierTier(quantity, row.unit, row.total);
        next[quantity] = {
          unit: completed.unitPrice.toFixed(6),
          total: completed.supplierTotal.toFixed(2),
        };
      } catch (priceCalculationError) {
        error =
          priceCalculationError instanceof Error
            ? priceCalculationError.message
            : "Die Staffelpreise konnten nicht berechnet werden.";
        break;
      }
    }
    if (error) {
      setPricesCalculated(false);
      setPriceError(error);
      return;
    }
    setPrices(next);
    setPricesCalculated(true);
    setPriceError("");
  }
  return (
    <main className="supplier-portal">
      <header className="portal-header">
        <div className="brand brand--portal">
          <Monogram small />
          <span>printcenter</span>
        </div>
        <button className="portal-button" onClick={onExit}>
          Schliessen
        </button>
      </header>
      <section className="supplier-portal-content">
        <p className="eyebrow">LIEFERANTENANGEBOT · {request.number}</p>
        <h1>{request.article}</h1>
        <p className="supplier-lead">
          {request.customer} fragt die Staffeln{" "}
          <strong>{quantities.join(" / ")} Stück</strong> an.
          Wunsch-Lieferdatum:{" "}
          <strong>{request.deliveryDate || "auf Anfrage"}</strong>
        </p>
        <div className="supplier-request-box">
          <p className="eyebrow">ANFRAGETEXT</p>
          <p>
            {request.requestText || request.note || "Keine Zusatzinformationen"}
          </p>
          <div className="supplier-files">
            {request.pdfUrl ? (
              <button
                className="secondary-button"
                onClick={() =>
                  downloadDocumentPdf(request.pdfUrl!, request.number)
                }
              >
                Anfrage-PDF herunterladen
              </button>
            ) : (
              <span>PDF wird erstellt…</span>
            )}
            {request.printFile ? (
              request.printFileUrl ? (
                <a
                  className="secondary-button"
                  href={request.printFileUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Kunden-GzD ansehen ↗
                </a>
              ) : (
                <span>GzD: {request.printFile}</span>
              )
            ) : (
              <span>Kein Kunden-GzD mitgesendet</span>
            )}
          </div>
        </div>
        <form
          className="supplier-offer-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pricesCalculated || !deliveryDate || submitting) return;
            const options = quantities.map((quantity) => ({
              quantity,
              unitPrice: Number(prices[quantity].unit),
              supplierTotal: Number(prices[quantity].total),
            }));
            const gzd = gzdChoice === "__upload__" ? gzdUpload : gzdChoice;
            setSubmitting(true);
            setSubmissionError("");
            window.dispatchEvent(
              new CustomEvent("printcenter:supplier-offer", {
                detail: {
                  requestId: request.id,
                  options,
                  deliveryDate,
                  deliveryNote,
                  gzd: gzd || undefined,
                  note,
                },
              }),
            );
          }}
        >
          <h2>Preise je Staffelmenge</h2>
          <p className="supplier-price-help">
            Pro Staffel kann der Einzelpreis oder der Gesamtpreis eingetragen
            werden. Mit „Preise speichern &amp; berechnen“ wird der leere Wert
            automatisch hoch- oder heruntergerechnet. Das Kunden-Markup wird
            anschließend einmalig auf den Gesamtpreis gerechnet.
          </p>
          <div className="supplier-tier-prices">
            <div className="supplier-tier-head">
              <span>Menge</span>
              <span>Einzelpreis in CHF</span>
              <span>Gesamtpreis in CHF</span>
            </div>
            {quantities.map((quantity) => (
              <div className="supplier-tier-row" key={quantity}>
                <strong>{quantity} Stück</strong>
                <label>
                  <span>Einzelpreis</span>
                  <input
                    aria-label={`Einzelpreis für ${quantity} Stück`}
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    value={prices[quantity]?.unit ?? ""}
                    onChange={(event) =>
                      updatePrice(quantity, "unit", event.target.value)
                    }
                    placeholder="z. B. 0.420000"
                  />
                </label>
                <label>
                  <span>Gesamtpreis</span>
                  <input
                    aria-label={`Gesamtpreis für ${quantity} Stück`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={prices[quantity]?.total ?? ""}
                    onChange={(event) =>
                      updatePrice(quantity, "total", event.target.value)
                    }
                    placeholder="z. B. 105.00"
                  />
                </label>
              </div>
            ))}
          </div>
          {priceError && (
            <p className="login-error supplier-price-message" role="alert">
              {priceError}
            </p>
          )}
          {submissionError && (
            <p className="login-error supplier-price-message" role="alert">
              {submissionError}
            </p>
          )}
          {pricesCalculated && (
            <p className="supplier-price-success">
              Alle Einzel- und Gesamtpreise sind berechnet und bereit für das
              Angebot.
            </p>
          )}
          <button
            className="secondary-button supplier-calculate-button"
            type="button"
            onClick={calculatePrices}
          >
            Preise speichern &amp; berechnen
          </button>
          <label className="supplier-full-field supplier-gzd-field">
            <span className="supplier-gzd-title">
              GzD bestätigen oder hochladen
            </span>
            <small>
              Bitte die Kundendatei bestätigen oder eine neue Produktionsdatei
              auswählen.
            </small>
            <select
              value={gzdChoice}
              onChange={(event) => setGzdChoice(event.target.value)}
            >
              <option value="">Kein GzD mitsenden</option>
              {request.printFile && (
                <option value={request.printFile}>
                  Kunden-GzD bestätigen · {request.printFile}
                </option>
              )}
              <option value="__upload__">Neues GzD hochladen</option>
            </select>
            {gzdChoice === "__upload__" && (
              <input
                type="file"
                required
                accept=".pdf,image/*,.ai,.eps,.zip"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    setGzdUpload("");
                    return;
                  }
                  setGzdUploading(true);
                  try {
                    const stored = await uploadStoredFile(file);
                    setGzdUpload(stored.name);
                    setPriceError("");
                  } catch (error) {
                    setGzdUpload("");
                    setPriceError(
                      error instanceof Error
                        ? error.message
                        : "Die GzD-Datei konnte nicht gespeichert werden.",
                    );
                  } finally {
                    setGzdUploading(false);
                  }
                }}
              />
            )}
            <small className="muted">
              Ausgewählt:{" "}
              {gzdChoice === "__upload__"
                ? gzdUploading
                  ? "Datei wird gespeichert…"
                  : gzdUpload || "noch keine neue Datei"
                : gzdChoice || "kein GzD"}
            </small>
          </label>
          <label className="supplier-full-field">
            Verbindliches Lieferdatum (Pflichtfeld)
            <input
              type="date"
              value={deliveryDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setDeliveryDate(event.target.value)}
              required
            />
          </label>
          <label className="supplier-full-field">
            Optionale Bemerkung zum Lieferdatum
            <textarea
              value={deliveryNote}
              onChange={(event) => setDeliveryNote(event.target.value)}
              rows={2}
              placeholder="z. B. gilt nach Freigabe des Gut zum Druck"
            />
          </label>
          <p className="supplier-binding-note">
            Das eingetragene Lieferdatum ist verbindlich, sofern die Bestellung
            innerhalb von 72 Stunden nach Angebotsabgabe erfolgt.
          </p>
          <label className="supplier-full-field">
            Nachricht an Printcenter
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Bemerkung oder Produktionshinweis"
            />
          </label>
          <button
            className="primary-button"
            type="submit"
            disabled={
              !pricesCalculated ||
              gzdUploading ||
              submitting ||
              (gzdChoice === "__upload__" && !gzdUpload)
            }
          >
            {submitting ? "Offerte wird übermittelt …" : "Offerte senden →"}
          </button>
        </form>
      </section>
    </main>
  );
}

function BackendLogin({
  onSubmit,
}: {
  onSubmit: (email: string, password: string) => boolean;
}) {
  const [error, setError] = useState("");
  return (
    <main className="backend-login">
      <section className="login-panel">
        <div className="brand brand--login">
          <Monogram />
          <span>
            print
            <br />
            center
          </span>
        </div>
        <p className="eyebrow">BACKEND-ZUGANG</p>
        <h1>Backend anmelden.</h1>
        <p className="login-copy">
          Melde dich an, um Kunden, Artikel, Belege und Zugänge zu verwalten.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const success = onSubmit(
              String(data.get("email") || ""),
              String(data.get("password") || ""),
            );
            setError(
              success ? "" : "Mailadresse oder Passwort ist nicht korrekt.",
            );
          }}
        >
          <label>
            Mailadresse
            <input
              name="email"
              type="email"
              required
              placeholder="name@printcenter.ch"
            />
          </label>
          <label>
            Passwort
            <input
              name="password"
              type="password"
              required
              placeholder="Passwort"
            />
          </label>
          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" type="submit">
            Backend öffnen →
          </button>
        </form>
        <p className="demo-login">
          Lokale Vorschau: <strong>admin@printcenter.local</strong>
          <br />
          Passwort: <strong>printcenter</strong>
        </p>
      </section>
      <div className="login-art" aria-hidden="true">
        <span />
        <i />
        <b />
      </div>
    </main>
  );
}

function LegacySettingsView({
  users,
  currentUser,
  workflow,
  onWorkflowSave,
  onCreate,
  onEdit,
  onToggle,
  onDelete,
}: {
  users: BackendUser[];
  currentUser: BackendUser;
  workflow: WorkflowSettings;
  onWorkflowSave: (event: FormEvent<HTMLFormElement>) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (id: number, name: string, email: string, password: string) => void;
  onToggle: (user: BackendUser) => void;
  onDelete: (user: BackendUser) => void;
}) {
  const [editingUser, setEditingUser] = useState<BackendUser | null>(null);
  const templateFields = [
    {
      key: "requestTemplate",
      label: "Anfrage",
      value: workflow.requestTemplate,
      doc: "attachRequestDocument",
      gzd: "attachRequestGzd",
    },
    {
      key: "offerTemplate",
      label: "Angebot",
      value: workflow.offerTemplate,
      doc: "attachOfferDocument",
      gzd: "attachOfferGzd",
    },
    {
      key: "orderTemplate",
      label: "Bestellung",
      value: workflow.orderTemplate,
      doc: "attachOrderDocument",
      gzd: "attachOrderGzd",
    },
    {
      key: "confirmationTemplate",
      label: "Auftragsbestätigung",
      value: workflow.confirmationTemplate,
      doc: "attachConfirmationDocument",
      gzd: "attachConfirmationGzd",
    },
  ];
  return (
    <section className="settings-layout">
      <section className="panel settings-intro">
        <p className="eyebrow">EINSTELLUNGEN</p>
        <h2>Backend-Zugänge</h2>
        <p>
          Jeder Zugang erhält eine eigene Rolle. Beim Öffnen des Backend-Tools
          ist die Anmeldung zwingend.
        </p>
        <div className="settings-principle">
          <span>01</span>
          <p>
            <b>Backend</b> ist nur nach Anmeldung sichtbar.
          </p>
          <span>02</span>
          <p>
            <b>Kundenportal</b> bleibt unter derselben Frontend-URL und wird
            über Mitarbeiter-Zugänge bestimmt.
          </p>
          <span>03</span>
          <p>
            <b>Projekt</b> verbindet Anfrage, Angebot und Folgebelege.
          </p>
        </div>
      </section>
      <section className="panel settings-users">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">BERECHTIGUNGEN</p>
            <h2>{users.length} Backend-Logins</h2>
          </div>
          <span className="muted">Aktuell: {currentUser.name}</span>
        </div>
        {editingUser && (
          <BackendUserEditForm
            user={editingUser}
            onCancel={() => setEditingUser(null)}
            onSubmit={(data) => {
              onEdit(editingUser.id, data.name, data.email, data.password);
              setEditingUser(null);
            }}
          />
        )}
        <div className="backend-user-list">
          {users.map((user) => (
            <article key={user.id}>
              <span className="employee-initial">
                {user.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </span>
              <div>
                <strong>{user.name}</strong>
                <p>
                  {user.email} · {user.role}
                </p>
              </div>
              <Status>{user.active ? "Aktiv" : "Inaktiv"}</Status>
              <div className="backend-user-actions">
                <button
                  className="text-button"
                  onClick={() => setEditingUser(user)}
                >
                  Bearbeiten
                </button>
                <button className="text-button" onClick={() => onToggle(user)}>
                  {user.active ? "Deaktivieren" : "Aktivieren"}
                </button>
                <button
                  className="danger-button"
                  onClick={() => onDelete(user)}
                >
                  Löschen
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="panel workflow-settings">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">BELEG- &amp; TEXTVORLAGEN</p>
            <h2>Workflow automatisieren</h2>
          </div>
          <span className="muted">
            Platzhalter: {"{supplier}"} {"{customer}"} {"{article}"}{" "}
            {"{quantity}"} {"{quantities}"} {"{deliveryDate}"} {"{note}"}{" "}
            {"{project}"}
          </span>
        </div>
        <form
          className="workflow-form workflow-form--templates"
          onSubmit={onWorkflowSave}
        >
          {templateFields.map((field) => (
            <fieldset key={field.key}>
              <legend>{field.label}</legend>
              <textarea name={field.key} defaultValue={field.value} rows={4} />
              <label className="check-row">
                <input
                  type="checkbox"
                  name={field.doc}
                  defaultChecked={
                    workflow[field.doc as keyof WorkflowSettings] as boolean
                  }
                />{" "}
                Beleg als PDF anhängen
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  name={field.gzd}
                  defaultChecked={
                    workflow[field.gzd as keyof WorkflowSettings] as boolean
                  }
                />{" "}
                GzD anhängen
              </label>
            </fieldset>
          ))}
          <fieldset className="employee-login-template-fieldset">
            <legend>Mitarbeiter-Zugang</legend>
            <label>
              Betreff
              <input
                name="employeeLoginSubject"
                defaultValue={workflow.employeeLoginSubject}
                required
              />
            </label>
            <label>
              E-Mail-Text
              <textarea
                name="employeeLoginTemplate"
                defaultValue={workflow.employeeLoginTemplate}
                rows={9}
                required
              />
            </label>
            <small className="muted">
              Platzhalter: {"{company}"} {"{salutation}"} {"{firstName}"}{" "}
              {"{lastName}"} {"{employee}"} {"{email}"} {"{password}"}{" "}
              {"{portalUrl}"}
            </small>
          </fieldset>
          <label>
            Betreff Lieferantenofferte
            <input
              name="supplierOfferSubject"
              defaultValue={workflow.supplierOfferSubject}
            />
          </label>
          <label>
            Angebot senden an
            <input
              name="offerEmail"
              type="email"
              defaultValue={workflow.offerEmail}
            />
          </label>
          <div className="workflow-order-recipient">
            <strong>Empfänger für Kundenbestellungen</strong>
            <p>
              Bestellungen werden automatisch an die E-Mail-Adresse des unter
              E-Mail-Einstellungen markierten Standardabsenders gesendet.
            </p>
          </div>
          <button className="primary-button" type="submit">
            Vorlagen, Anhänge &amp; Empfänger speichern
          </button>
        </form>
      </section>
      <section className="panel access-form-panel">
        <div>
          <p className="eyebrow">NEUER BACKEND-ZUGANG</p>
          <h2>Login erstellen</h2>
        </div>
        <form className="access-form" onSubmit={onCreate}>
          <label>
            Name
            <input name="name" required placeholder="Vor- und Nachname" />
          </label>
          <label>
            Mailadresse
            <input
              name="email"
              type="email"
              required
              placeholder="name@firma.ch"
            />
          </label>
          <label>
            Rolle
            <select name="role" defaultValue="Sachbearbeitung">
              <option>Admin</option>
              <option>Sachbearbeitung</option>
            </select>
          </label>
          <label>
            Initialpasswort
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Mindestens 8 Zeichen"
            />
          </label>
          <button className="primary-button" type="submit">
            Zugang erstellen
          </button>
        </form>
        <p className="muted">
          Lokale Vorschau: Zugangsdaten bleiben nur im aktuellen Arbeitsstand.
          Für den Serverbetrieb werden Passwörter auf der Serverroute als Hash
          gespeichert.
        </p>
      </section>
    </section>
  );
}

type SettingsProps = {
  users: BackendUser[];
  currentUser: BackendUser;
  workflow: WorkflowSettings;
  onStateImported: (state: PersistedState) => void;
  onWorkflowSave: (event: FormEvent<HTMLFormElement>) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (id: number, name: string, email: string, password: string) => void;
  onToggle: (user: BackendUser) => void;
  onDelete: (user: BackendUser) => void;
};
const emptyIntegrationSettings: IntegrationSettings = {
  navisionEndpoint: "",
  navisionTenant: "",
  apiBaseUrl: "",
  apiClientId: "",
  ftpProtocol: "SFTP",
  ftpHost: "",
  ftpPort: "22",
  ftpUsername: "",
  ftpDirectory: "/printcenter",
};
const csvTemplates = {
  customers: {
    label: "Kunden",
    filename: "printcenter-kunden.csv",
    content:
      "customer_number;name;salutation;first_name;last_name;main_email;phone;street;postal_code;city;country;markup_percent;employee_1_salutation;employee_1_first_name;employee_1_last_name;employee_1_email;employee_1_phone;employee_1_password;employee_1_mail_to_main;employee_2_salutation;employee_2_first_name;employee_2_last_name;employee_2_email;employee_2_phone;employee_2_password;employee_2_mail_to_main;employee_3_salutation;employee_3_first_name;employee_3_last_name;employee_3_email;employee_3_phone;employee_3_password;employee_3_mail_to_main\nK-10050;Muster AG;Frau;Erika;Muster;info@muster.ch;+41 44 000 00 00;Musterstrasse 1;8000;Zürich;Schweiz;12;Herr;Max;Muster;max@muster.ch;+41 79 000 00 00;Startpasswort;ja;Frau;Lina;Muster;lina@muster.ch;+41 79 000 00 01;Startpasswort;nein;;;;;;;",
  },
  suppliers: {
    label: "Lieferanten",
    filename: "printcenter-lieferanten.csv",
    content:
      "supplier_number;name;group;contact;email;phone\nL-2060;Muster Druck AG;Druck;Erika Beispiel;produktion@muster-druck.ch;+41 44 000 00 01",
  },
  articles: {
    label: "Artikel",
    filename: "printcenter-artikel.csv",
    content:
      "sku;designation_1;designation_2;customer_number;supplier_or_group;stock;reorder_point;unit_price\nART-100001;Musterartikel;Ausführung A4;K-10050;Muster Druck AG;100;25;0.45",
  },
} as const;

function SettingsView(props: SettingsProps) {
  const [section, setSection] = useState<
    | "Backend-Zugänge"
    | "Beleg- & Textvorlagen"
    | "E-Mail-Einstellungen"
    | "Import / Export"
    | "Anbindungen"
  >("Backend-Zugänge");
  const sections = [
    "Backend-Zugänge",
    "Beleg- & Textvorlagen",
    "E-Mail-Einstellungen",
    "Import / Export",
    "Anbindungen",
  ] as const;
  return (
    <section className="settings-hub">
      <nav className="settings-section-nav" aria-label="Einstellungsbereiche">
        {sections.map((item, index) => (
          <button
            className={section === item ? "is-active" : ""}
            onClick={() => setSection(item)}
            key={item}
          >
            <span>0{index + 1}</span>
            <strong>{item}</strong>
            <small>
              {item === "Backend-Zugänge"
                ? "Logins & Rollen"
                : item === "Beleg- & Textvorlagen"
                  ? "Texte & Anhänge"
                  : item === "E-Mail-Einstellungen"
                    ? "Absender & SMTP"
                  : item === "Import / Export"
                    ? "Sicherung & Stammdaten"
                    : "API & FTP/SFTP"}
            </small>
          </button>
        ))}
      </nav>
      {section === "Backend-Zugänge" && (
        <div className="settings-tab-scope settings-tab--backend">
          <LegacySettingsView {...props} />
        </div>
      )}
      {section === "Beleg- & Textvorlagen" && (
        <div className="settings-tab-scope settings-tab--templates">
          <LegacySettingsView {...props} />
        </div>
      )}
      {section === "E-Mail-Einstellungen" && <EmailSettingsPanel />}
      {section === "Import / Export" && (
        <ImportExportSettings
          workflow={props.workflow}
          onStateImported={props.onStateImported}
        />
      )}
      {section === "Anbindungen" && <IntegrationSettingsPanel />}
    </section>
  );
}

function ImportExportSettings({
  workflow,
  onStateImported,
}: {
  workflow: WorkflowSettings;
  onStateImported: (state: PersistedState) => void;
}) {
  const [importType, setImportType] =
    useState<keyof typeof csvTemplates>("customers");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<
    "progress" | "success" | "error"
  >("progress");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const updateImportProgress = async (
    processed: number,
    total: number,
    start = 25,
    end = 85,
  ) => {
    if (processed !== total && processed % 25 !== 0) return;
    const ratio = total ? processed / total : 1;
    setProgress(Math.round(start + (end - start) * ratio));
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => resolve()),
    );
  };
  async function exportBackup() {
    setBusy(true);
    setProgress(10);
    setMessageKind("progress");
    setMessage("Datensicherung wird vorbereitet …");
    try {
      const [state, integrationSettings] = await Promise.all([
        apiRequest<PersistedState>("/api/state"),
        apiRequest<IntegrationSettings>("/api/integrations"),
      ]);
      const cleanState = {
        ...state,
        documents: state.documents.map((document) => ({
          ...document,
          pdfUrl: undefined,
        })),
      };
      const date = new Date().toISOString().slice(0, 10);
      downloadTextFile(
        `printcenter-vollbackup-${date}.json`,
        JSON.stringify(
          {
            format: "printcenter-backup",
            version: 1,
            exportedAt: new Date().toISOString(),
            state: cleanState,
            integrationSettings,
          },
          null,
          2,
        ),
        "application/json;charset=utf-8",
      );
      setProgress(100);
      setMessageKind("success");
      setMessage("Das vollständige Backup wurde heruntergeladen.");
    } catch (error) {
      setMessageKind("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Das Backup konnte nicht erstellt werden.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function importBackup(file?: File) {
    if (!file) return;
    setBusy(true);
    setProgress(5);
    setMessageKind("progress");
    setMessage(`Backup „${file.name}“ wird gelesen …`);
    try {
      const parsed = JSON.parse(await file.text()) as {
        state?: PersistedState;
        integrationSettings?: IntegrationSettings;
      } & Partial<PersistedState>;
      const state = parsed.state ?? (parsed as PersistedState);
      if (
        !Array.isArray(state.customers) ||
        !Array.isArray(state.suppliers) ||
        !Array.isArray(state.articles) ||
        !Array.isArray(state.documents) ||
        !Array.isArray(state.backendUsers)
      )
        throw new Error("Die Datei ist kein gültiges Printcenter-Backup.");
      setProgress(35);
      setMessage("Backup wurde geprüft. Daten werden gespeichert …");
      const nextState: PersistedState = {
        ...state,
        workflowSettings: {
          ...workflow,
          ...(state.workflowSettings ?? {}),
        },
      };
      await apiRequest<{ ok: boolean }>("/api/state", {
        method: "PUT",
        body: JSON.stringify(nextState),
      });
      setProgress(85);
      if (parsed.integrationSettings)
        await apiRequest<IntegrationSettings>("/api/integrations", {
          method: "PUT",
          body: JSON.stringify(parsed.integrationSettings),
        });
      onStateImported(nextState);
      setProgress(100);
      setMessageKind("success");
      setMessage(
        `Backup erfolgreich importiert: ${nextState.customers.length} Kunden, ${nextState.suppliers.length} Lieferanten, ${nextState.articles.length} Artikel und ${nextState.documents.length} Belege. Die Sitzung bleibt aktiv.`,
      );
    } catch (error) {
      setMessageKind("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Das Backup konnte nicht importiert werden.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function importCsvFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setProgress(5);
    setMessageKind("progress");
    setMessage(`„${file.name}“ wird gelesen …`);
    try {
      const rows = parseCsv(await file.text());
      if (!rows.length)
        throw new Error("Die CSV-Datei enthält keine Datenzeilen.");
      const requiredHeaders: Record<keyof typeof csvTemplates, string[]> = {
        customers: ["customer_number", "name", "main_email"],
        suppliers: ["supplier_number", "name", "group"],
        articles: [
          "sku",
          "designation_1",
          "designation_2",
          "customer_number",
          "supplier_or_group",
        ],
      };
      const missingHeaders = requiredHeaders[importType].filter(
        (header) => !(header in rows[0]),
      );
      if (missingHeaders.length)
        throw new Error(
          `Falsche Vorlage: Folgende Spalten fehlen: ${missingHeaders.join(", ")}.`,
        );
      setProgress(15);
      setMessage(
        `${rows.length} Zeilen erkannt. Bestehende Daten werden geprüft …`,
      );
      const state = await apiRequest<PersistedState>("/api/state");
      let imported = 0;
      const skippedReasons = new Map<string, number>();
      const skip = (reason: string) =>
        skippedReasons.set(reason, (skippedReasons.get(reason) ?? 0) + 1);
      if (importType === "customers") {
        let nextCustomerId =
          Math.max(0, ...state.customers.map((item) => item.id)) + 1;
        let nextEmployeeId =
          Math.max(
            0,
            ...state.customers.flatMap((customer) =>
              customer.employees.map((item) => item.id),
            ),
          ) + 1;
        for (const [rowIndex, row] of rows.entries()) {
          const number =
            row.customer_number || `K-${10000 + nextCustomerId}`;
          let customer = state.customers.find(
            (item) => item.number === number,
          );
          let rowImported = 0;
          if (!customer && row.name) {
            customer = {
              id: nextCustomerId++,
              number,
              name: row.name,
              contactSalutation: (row.salutation || "Divers") as Salutation,
              contactFirstName: row.first_name || "",
              contactLastName: row.last_name || "",
              email: row.main_email || "",
              phone: row.phone || "",
              street: row.street || "",
              postalCode: row.postal_code || "",
              city: row.city || "",
              country: row.country || "Schweiz",
              markup: Number(row.markup_percent) || 0,
              status: "Aktiv",
              turnover: 0,
              employees: [],
            };
            state.customers.push(customer);
            imported += 1;
            rowImported += 1;
          }
          if (!customer) skip("Kundenname fehlt");
          else {
            for (
              let employeeIndex = 1;
              employeeIndex <= 3;
              employeeIndex += 1
            ) {
              const prefix = `employee_${employeeIndex}_`;
              const email = String(row[`${prefix}email`] || "")
                .trim()
                .toLowerCase();
              const firstName = String(
                row[`${prefix}first_name`] || "",
              ).trim();
              const lastName = String(
                row[`${prefix}last_name`] || "",
              ).trim();
              const employeeName = [firstName, lastName]
                .filter(Boolean)
                .join(" ");
              const hasEmployeeData = Boolean(email || employeeName);
              if (!hasEmployeeData) continue;
              if (!email || !employeeName) {
                skip("Unvollständiger Mitarbeiterzugang");
                continue;
              }
              const duplicate = state.customers.some((item) =>
                item.employees.some(
                  (employee) => employee.email.toLowerCase() === email,
                ),
              );
              if (duplicate) {
                skip("Mitarbeiter-Mail bereits vorhanden");
                continue;
              }
              customer.employees.push({
                id: nextEmployeeId++,
                name: employeeName,
                salutation: (row[`${prefix}salutation`] ||
                  "Divers") as Salutation,
                firstName,
                lastName,
                email,
                login: email,
                phone: row[`${prefix}phone`] || "",
                password: row[`${prefix}password`] || "portal",
                mailToMain: ["ja", "yes", "1", "true"].includes(
                  String(row[`${prefix}mail_to_main`] || "").toLowerCase(),
                ),
              });
              imported += 1;
              rowImported += 1;
            }
          }
          if (!rowImported && customer)
            skip("Kunde und Mitarbeiter bereits vorhanden");
          await updateImportProgress(rowIndex + 1, rows.length);
        }
      }
      if (importType === "suppliers") {
        let nextId = Math.max(0, ...state.suppliers.map((item) => item.id)) + 1;
        for (const [rowIndex, row] of rows.entries()) {
          const number = row.supplier_number || `L-${2000 + nextId}`;
          if (!row.name) {
            skip("Lieferantenname fehlt");
            await updateImportProgress(rowIndex + 1, rows.length);
            continue;
          }
          if (state.suppliers.some((item) => item.number === number)) {
            skip("Lieferantennummer bereits vorhanden");
            await updateImportProgress(rowIndex + 1, rows.length);
            continue;
          }
          const group = row.group || "Ohne Gruppe";
          if (group !== "Ohne Gruppe" && !state.groups.includes(group))
            state.groups.push(group);
          state.suppliers.push({
            id: nextId++,
            number,
            name: row.name,
            group,
            contact: row.contact || "",
            email: row.email || "",
            phone: row.phone || "",
          });
          imported += 1;
          await updateImportProgress(rowIndex + 1, rows.length);
        }
      }
      if (importType === "articles") {
        let nextId = Math.max(0, ...state.articles.map((item) => item.id)) + 1;
        for (const [rowIndex, row] of rows.entries()) {
          const designation1 = row.designation_1 || row.name || "";
          const designation2 = row.designation_2 || "";
          if (!designation1 || !row.sku) {
            skip("SKU oder Bezeichnung 1 fehlt");
            await updateImportProgress(rowIndex + 1, rows.length);
            continue;
          }
          if (state.articles.some((item) => item.sku === row.sku)) {
            skip("SKU bereits vorhanden");
            await updateImportProgress(rowIndex + 1, rows.length);
            continue;
          }
          const customer = state.customers.find(
            (item) => item.number === row.customer_number,
          );
          if (!customer) {
            skip("Kundennummer nicht gefunden");
            await updateImportProgress(rowIndex + 1, rows.length);
            continue;
          }
          const supplierValue = row.supplier_or_group || "Nicht zugeordnet";
          const supplierExists = state.suppliers.some(
            (item) => item.name === supplierValue,
          );
          const groupExists = state.groups.includes(supplierValue);
          if (
            supplierValue !== "Nicht zugeordnet" &&
            !supplierExists &&
            !groupExists
          ) {
            skip("Lieferant oder Gruppe nicht gefunden");
            await updateImportProgress(rowIndex + 1, rows.length);
            continue;
          }
          const supplier = groupExists
            ? `group:${supplierValue}`
            : supplierValue;
          const stock = Number(row.stock) || 0;
          state.articles.push({
            id: nextId++,
            sku: row.sku,
            designation1,
            designation2,
            name: articleNameFromDesignations(designation1, designation2),
            customerId: customer?.id,
            supplier,
            stock,
            minimum: Number(row.reorder_point) || 0,
            unitPrice: Number(row.unit_price) || 0,
            stockHistory: [
              {
                date: today(),
                change: stock,
                stock,
                reason: "Import über Einstellungen",
              },
            ],
            templates: [],
          });
          imported += 1;
          await updateImportProgress(rowIndex + 1, rows.length);
        }
      }
      const reasonSummary = [...skippedReasons.entries()]
        .map(([reason, count]) => `${count}× ${reason}`)
        .join("; ");
      if (!imported)
        throw new Error(
          `Keine neuen Datensätze importiert.${reasonSummary ? ` Grund: ${reasonSummary}.` : ""}`,
        );
      setProgress(90);
      setMessage(
        `${imported} Datensätze vorbereitet. Änderungen werden dauerhaft gespeichert …`,
      );
      const nextState: PersistedState = {
        ...state,
        workflowSettings: {
          ...workflow,
          ...(state.workflowSettings ?? {}),
        },
      };
      await apiRequest<{ ok: boolean }>("/api/state", {
        method: "PUT",
        body: JSON.stringify(nextState),
      });
      onStateImported(nextState);
      setProgress(100);
      setMessageKind("success");
      setMessage(
        `${imported} Datensätze erfolgreich importiert.${reasonSummary ? ` Übersprungen: ${reasonSummary}.` : " Keine Zeilen wurden übersprungen."} Die Sitzung bleibt aktiv.`,
      );
    } catch (error) {
      setMessageKind("error");
      setMessage(
        error instanceof Error
          ? `Import fehlgeschlagen: ${error.message}`
          : "Die CSV-Datei konnte nicht importiert werden.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="import-export-layout">
      {message && (
        <section
          className={`import-feedback import-feedback--${messageKind}`}
          role={messageKind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          <div className="import-feedback-heading">
            <strong>
              {messageKind === "progress"
                ? "Import läuft"
                : messageKind === "success"
                  ? "Erfolgreich abgeschlossen"
                  : "Import fehlgeschlagen"}
            </strong>
            <span>{progress}%</span>
          </div>
          <progress value={progress} max="100">
            {progress}%
          </progress>
          <p>{message}</p>
        </section>
      )}
      <section className="panel backup-panel">
        <p className="eyebrow">VOLLSTÄNDIGE DATENSICHERUNG</p>
        <h2>Alle Datenbanken sichern</h2>
        <p>
          Das JSON-Backup enthält Kunden, Mitarbeiter, Lieferanten, Gruppen,
          Artikel, Lagerverläufe, Projekte, Belege, Einstellungen und
          Anbindungskonfigurationen. Backend-Zugänge sind sensible Daten.
        </p>
        <div className="backup-actions">
          <button
            className="primary-button"
            onClick={exportBackup}
            disabled={busy}
          >
            Vollbackup exportieren
          </button>
          <label className="secondary-button file-import-button">
            Vollbackup importieren
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(event) => {
                void importBackup(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </section>
      <section className="panel template-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">IMPORTVORLAGEN</p>
            <h2>CSV-Vorlagen herunterladen</h2>
          </div>
          <span className="muted">Semikolon-getrennt · UTF-8</span>
        </div>
        <div className="template-download-grid">
          {Object.entries(csvTemplates).map(([key, template]) => (
            <article key={key}>
              <span className="template-number">
                {String(Object.keys(csvTemplates).indexOf(key) + 1).padStart(
                  2,
                  "0",
                )}
              </span>
              <strong>{template.label}</strong>
              <small>{template.filename}</small>
              <button
                className="text-button"
                onClick={() =>
                  downloadTextFile(
                    template.filename,
                    `\uFEFF${template.content}\n`,
                    "text/csv;charset=utf-8",
                  )
                }
              >
                Vorlage herunterladen
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="panel csv-import-panel">
        <p className="eyebrow">STAMMDATEN IMPORTIEREN</p>
        <h2>Ausgefüllte Vorlage einlesen</h2>
        <div className="csv-import-form">
          <label>
            Datenbank
            <select
              value={importType}
              onChange={(event) =>
                setImportType(event.target.value as keyof typeof csvTemplates)
              }
            >
              {Object.entries(csvTemplates).map(([key, template]) => (
                <option value={key} key={key}>
                  {template.label}
                </option>
              ))}
            </select>
          </label>
          <label className="primary-button file-import-button">
            CSV auswählen und importieren
            <input
              type="file"
              accept="text/csv,.csv"
              disabled={busy}
              onChange={(event) => {
                void importCsvFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="muted">
          Bestehende Datensätze bleiben erhalten. Duplikate anhand Kundennummer,
          Lieferantennummer, Mitarbeiter-Mail oder SKU werden übersprungen.
        </p>
      </section>
    </section>
  );
}

const emailProviderPresets = {
  gmail: {
    label: "Gmail / Google Workspace",
    host: "smtp.gmail.com",
    port: 587,
    security: "starttls" as EmailSecurity,
  },
  microsoft: {
    label: "Microsoft 365 / Outlook",
    host: "smtp.office365.com",
    port: 587,
    security: "starttls" as EmailSecurity,
  },
  yahoo: {
    label: "Yahoo Mail",
    host: "smtp.mail.yahoo.com",
    port: 465,
    security: "tls" as EmailSecurity,
  },
  infomaniak: {
    label: "Infomaniak",
    host: "mail.infomaniak.com",
    port: 587,
    security: "starttls" as EmailSecurity,
  },
  custom: {
    label: "Anderer SMTP-Dienst",
    host: "",
    port: 587,
    security: "starttls" as EmailSecurity,
  },
} as const;

const emptyEmailSenderDraft: EmailSenderDraft = {
  label: "",
  provider: "custom",
  fromName: "Printcenter",
  fromEmail: "",
  replyTo: "",
  smtpHost: "",
  smtpPort: 587,
  security: "starttls",
  username: "",
  password: "",
  active: true,
  isDefault: false,
};

function EmailSettingsPanel() {
  const [senders, setSenders] = useState<EmailSender[]>([]);
  const [draft, setDraft] = useState<EmailSenderDraft>(emptyEmailSenderDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [testRecipients, setTestRecipients] = useState<Record<number, string>>(
    {},
  );
  const [productionSecretConfigured, setProductionSecretConfigured] =
    useState(false);
  const [, setMessage] = useState("Absenderprofile werden geladen …");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const result = await apiRequest<{
      senders: EmailSender[];
      productionSecretConfigured: boolean;
    }>("/api/email-senders");
    setSenders(result.senders);
    setProductionSecretConfigured(result.productionSecretConfigured);
    setMessage(
      result.senders.length
        ? "Absenderprofile sind bereit. Gespeicherte Passwörter werden nie angezeigt."
        : "Noch kein Absender eingerichtet. Erstelle unten das erste SMTP-Profil.",
    );
  };
  useEffect(() => {
    let active = true;
    void apiRequest<{
      senders: EmailSender[];
      productionSecretConfigured: boolean;
    }>("/api/email-senders")
      .then((result) => {
        if (!active) return;
        setSenders(result.senders);
        setProductionSecretConfigured(result.productionSecretConfigured);
        setMessage(
          result.senders.length
            ? "Absenderprofile sind bereit. Gespeicherte Passwörter werden nie angezeigt."
            : "Noch kein Absender eingerichtet. Erstelle unten das erste SMTP-Profil.",
        );
      })
      .catch((error) => {
        if (active)
          setMessage(
            error instanceof Error
              ? error.message
              : "E-Mail-Einstellungen konnten nicht geladen werden.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  const startEditing = (sender: EmailSender) => {
    setEditingId(sender.id);
    setDraft({
      label: sender.label,
      provider: sender.provider,
      fromName: sender.fromName,
      fromEmail: sender.fromEmail,
      replyTo: sender.replyTo,
      smtpHost: sender.smtpHost,
      smtpPort: sender.smtpPort,
      security: sender.security,
      username: sender.username,
      password: "",
      active: sender.active,
      isDefault: sender.isDefault,
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };
  const resetForm = () => {
    setEditingId(null);
    setDraft(emptyEmailSenderDraft);
  };
  const chooseProvider = (provider: keyof typeof emailProviderPresets) => {
    const preset = emailProviderPresets[provider];
    setDraft({
      ...draft,
      provider,
      smtpHost: preset.host,
      smtpPort: preset.port,
      security: preset.security,
    });
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      await apiRequest<EmailSender>(
        editingId ? `/api/email-senders/${editingId}` : "/api/email-senders",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(draft),
        },
      );
      await load();
      setMessage(
        editingId
          ? "Das Absenderprofil wurde aktualisiert."
          : "Das Absenderprofil wurde sicher gespeichert.",
      );
      resetForm();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Das Absenderprofil konnte nicht gespeichert werden.",
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async (sender: EmailSender) => {
    if (!window.confirm(`Absender „${sender.label}“ wirklich löschen?`)) return;
    setBusy(true);
    try {
      await apiRequest<{ ok: boolean }>(`/api/email-senders/${sender.id}`, {
        method: "DELETE",
      });
      await load();
      if (editingId === sender.id) resetForm();
      setMessage("Das Absenderprofil wurde gelöscht.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };
  const testSender = async (sender: EmailSender) => {
    const recipient = testRecipients[sender.id] || sender.fromEmail;
    setBusy(true);
    setMessage(`Testmail über „${sender.label}“ wird versendet …`);
    try {
      const result = await apiRequest<{ ok: boolean; message: string }>(
        `/api/email-senders/${sender.id}/test`,
        { method: "POST", body: JSON.stringify({ recipient }) },
      );
      setMessage(result.message);
      await load();
      setMessage(result.message);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Die Testmail ist fehlgeschlagen.",
      );
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="email-settings-layout">
      <section className="panel email-settings-intro">
        <div>
          <p className="eyebrow">E-MAIL-EINSTELLUNGEN</p>
          <h2>Absender zentral verwalten</h2>
          <p>
            Mehrere SMTP-Absender hinterlegen, einen Standard wählen und die
            Verbindung direkt mit einer Testmail prüfen. Port 25 ist technisch
            gesperrt; üblich sind 465 (TLS) oder 587 (STARTTLS).
          </p>
        </div>
        <div className="email-security-note">
          <strong>PASSWÖRTER GESCHÜTZT</strong>
          <span>
            Zugangsdaten werden verschlüsselt gespeichert und nach dem Speichern
            nicht mehr ausgegeben.
          </span>
          {!productionSecretConfigured && (
            <small>
              Lokal ist ein automatisch erzeugter Schlüssel aktiv. Vor dem
              Serverbetrieb EMAIL_ENCRYPTION_KEY als Server-Secret setzen.
            </small>
          )}
        </div>
      </section>

      <section className="email-sender-list" aria-label="Absenderprofile">
        {senders.length === 0 && (
          <div className="panel empty-state">
            <strong>Noch keine Absender</strong>
            <p>Das erste gespeicherte Profil wird automatisch Standard.</p>
          </div>
        )}
        {senders.map((sender) => (
          <article className="panel email-sender-card" key={sender.id}>
            <div className="email-sender-head">
              <div>
                <span className="provider-tag">
                  {emailProviderPresets[
                    sender.provider as keyof typeof emailProviderPresets
                  ]?.label || sender.provider}
                </span>
                <h3>{sender.label}</h3>
                <p>
                  {sender.fromName} &lt;{sender.fromEmail}&gt;
                </p>
              </div>
              <div className="email-sender-status">
                {sender.isDefault && <b>STANDARD</b>}
                <span className={sender.active ? "is-active" : ""}>
                  {sender.active ? "Aktiv" : "Inaktiv"}
                </span>
              </div>
            </div>
            <dl className="email-connection-data">
              <div>
                <dt>SMTP</dt>
                <dd>{sender.smtpHost}:{sender.smtpPort}</dd>
              </div>
              <div>
                <dt>Sicherheit</dt>
                <dd>{sender.security === "tls" ? "TLS" : sender.security.toUpperCase()}</dd>
              </div>
              <div>
                <dt>Benutzer</dt>
                <dd>{sender.username}</dd>
              </div>
              <div>
                <dt>Letzter Test</dt>
                <dd>
                  {sender.lastTestedAt
                    ? `${sender.lastTestStatus === "success" ? "Erfolgreich" : "Fehlgeschlagen"} · ${new Date(sender.lastTestedAt).toLocaleString("de-CH")}`
                    : "Noch nicht getestet"}
                </dd>
              </div>
            </dl>
            <div className="email-test-row">
              <label>
                Testmail an
                <input
                  type="email"
                  value={testRecipients[sender.id] ?? sender.fromEmail}
                  onChange={(event) =>
                    setTestRecipients({
                      ...testRecipients,
                      [sender.id]: event.target.value,
                    })
                  }
                />
              </label>
              <button
                className="secondary-button"
                type="button"
                disabled={busy || !sender.active || !sender.passwordConfigured}
                onClick={() => void testSender(sender)}
              >
                Testmail senden
              </button>
            </div>
            <div className="email-card-actions">
              <button className="text-button" type="button" onClick={() => startEditing(sender)}>
                Bearbeiten
              </button>
              <button className="danger-button" type="button" onClick={() => void remove(sender)}>
                Löschen
              </button>
            </div>
          </article>
        ))}
      </section>

      <form className="panel email-sender-form" onSubmit={save}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{editingId ? "ABSENDER BEARBEITEN" : "NEUER ABSENDER"}</p>
            <h2>{editingId ? "SMTP-Profil aktualisieren" : "SMTP-Profil verbinden"}</h2>
          </div>
          {editingId && (
            <button className="text-button" type="button" onClick={resetForm}>
              Neue Erfassung
            </button>
          )}
        </div>
        <fieldset>
          <legend>01 · Anbieter</legend>
          <div className="email-form-grid email-form-grid--provider">
            <label>
              E-Mail-Dienst
              <select
                value={draft.provider}
                onChange={(event) =>
                  chooseProvider(event.target.value as keyof typeof emailProviderPresets)
                }
              >
                {Object.entries(emailProviderPresets).map(([key, preset]) => (
                  <option value={key} key={key}>{preset.label}</option>
                ))}
              </select>
            </label>
            <label>
              Interner Profilname
              <input
                required
                value={draft.label}
                onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                placeholder="z. B. Printcenter Verkauf"
              />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>02 · Absender</legend>
          <div className="email-form-grid">
            <label>
              Absendername
              <input required value={draft.fromName} onChange={(event) => setDraft({ ...draft, fromName: event.target.value })} />
            </label>
            <label>
              Absenderadresse
              <input required type="email" value={draft.fromEmail} onChange={(event) => setDraft({ ...draft, fromEmail: event.target.value, username: draft.username || event.target.value })} placeholder="printcenter@firma.ch" />
            </label>
            <label>
              Antwortadresse (optional)
              <input type="email" value={draft.replyTo} onChange={(event) => setDraft({ ...draft, replyTo: event.target.value })} placeholder="antwort@firma.ch" />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>03 · SMTP-Verbindung</legend>
          <div className="email-form-grid email-form-grid--smtp">
            <label>
              SMTP-Host
              <input required value={draft.smtpHost} onChange={(event) => setDraft({ ...draft, smtpHost: event.target.value })} placeholder="smtp.example.com" />
            </label>
            <label>
              Port
              <input required type="number" min="1" max="65535" value={draft.smtpPort} onChange={(event) => setDraft({ ...draft, smtpPort: Number(event.target.value) })} />
            </label>
            <label>
              Verschlüsselung
              <select value={draft.security} onChange={(event) => setDraft({ ...draft, security: event.target.value as EmailSecurity })}>
                <option value="starttls">STARTTLS (empfohlen)</option>
                <option value="tls">TLS / SSL</option>
                <option value="none">Keine (unsicher)</option>
              </select>
            </label>
            <label>
              Benutzername
              <input required value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} autoComplete="username" />
            </label>
            <label>
              Passwort / App-Passwort
              <input
                required={!editingId || !senders.find((item) => item.id === editingId)?.passwordConfigured}
                type="password"
                value={draft.password}
                onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                autoComplete="new-password"
                placeholder={editingId ? "Leer lassen = gespeichert behalten" : "SMTP- oder App-Passwort"}
              />
            </label>
          </div>
          {draft.provider === "gmail" && (
            <p className="email-provider-hint">
              Für Gmail bei aktivierter 2‑Faktor-Anmeldung ein Google
              App-Passwort verwenden. Das normale Kontopasswort funktioniert
              dafür in der Regel nicht.
            </p>
          )}
        </fieldset>
        <div className="email-form-options">
          <label className="check-row">
            <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
            Profil aktiv
          </label>
          <label className="check-row">
            <input type="checkbox" checked={draft.isDefault} onChange={(event) => setDraft({ ...draft, isDefault: event.target.checked })} />
            Als Standardabsender verwenden
          </label>
        </div>
        <div className="form-actions-wide">
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Wird gespeichert …" : editingId ? "Änderungen speichern" : "Absender speichern"}
          </button>
          {editingId && (
            <button className="secondary-button" type="button" onClick={resetForm}>Abbrechen</button>
          )}
        </div>
      </form>
    </section>
  );
}

function IntegrationSettingsPanel() {
  const [settings, setSettings] = useState(emptyIntegrationSettings);
  const [, setMessage] = useState("Konfigurationen werden geladen …");
  useEffect(() => {
    let active = true;
    void apiRequest<IntegrationSettings>("/api/integrations")
      .then((value) => {
        if (active) {
          setSettings(value);
          setMessage(
            "Noch keine Verbindung aktiv. Zugangsschlüssel und Passwörter werden später geschützt hinterlegt.",
          );
        }
      })
      .catch(() => {
        if (active)
          setMessage(
            "Die Anbindungskonfiguration konnte nicht geladen werden.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const saved = await apiRequest<IntegrationSettings>("/api/integrations", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(saved);
      setMessage(
        "Die vorbereiteten Anbindungseinstellungen wurden dauerhaft gespeichert.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Die Anbindungen konnten nicht gespeichert werden.",
      );
    }
  }
  return (
    <form className="integrations-layout" onSubmit={save}>
      <section className="panel integration-card">
        <div className="integration-card-head">
          <span>01</span>
          <div>
            <p className="eyebrow">ERP</p>
            <h2>Microsoft Dynamics NAV / Navision</h2>
          </div>
          <b>Vorbereitet</b>
        </div>
        <p>
          Basisdaten für eine zukünftige Navision-API. Die eigentliche
          Synchronisation wird erst mit der Schnittstelle aktiviert.
        </p>
        <div className="integration-fields">
          <label>
            API-Endpunkt
            <input
              type="url"
              value={settings.navisionEndpoint}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  navisionEndpoint: event.target.value,
                })
              }
              placeholder="https://navision.firma.ch/api"
            />
          </label>
          <label>
            Mandant / Tenant
            <input
              value={settings.navisionTenant}
              onChange={(event) =>
                setSettings({ ...settings, navisionTenant: event.target.value })
              }
              placeholder="Printcenter AG"
            />
          </label>
        </div>
      </section>
      <section className="panel integration-card">
        <div className="integration-card-head">
          <span>02</span>
          <div>
            <p className="eyebrow">API</p>
            <h2>Externe REST-API</h2>
          </div>
          <b>Vorbereitet</b>
        </div>
        <p>
          Basisadresse und Client-ID für zukünftige Systeme. Geheimnisse werden
          bewusst nicht im Formular gespeichert.
        </p>
        <div className="integration-fields">
          <label>
            Basis-URL
            <input
              type="url"
              value={settings.apiBaseUrl}
              onChange={(event) =>
                setSettings({ ...settings, apiBaseUrl: event.target.value })
              }
              placeholder="https://api.partner.ch/v1"
            />
          </label>
          <label>
            Client-ID
            <input
              value={settings.apiClientId}
              onChange={(event) =>
                setSettings({ ...settings, apiClientId: event.target.value })
              }
              placeholder="printcenter-production"
            />
          </label>
        </div>
      </section>
      <section className="panel integration-card integration-card--wide">
        <div className="integration-card-head">
          <span>03</span>
          <div>
            <p className="eyebrow">DATEIAUSTAUSCH</p>
            <h2>FTP / SFTP</h2>
          </div>
          <b>Vorbereitet</b>
        </div>
        <p>
          Serverdaten für Druckdaten, Exporte oder automatisierte Importe. SFTP
          ist als sichere Standardoption vorausgewählt.
        </p>
        <div className="integration-fields integration-fields--ftp">
          <label>
            Protokoll
            <select
              value={settings.ftpProtocol}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  ftpProtocol: event.target
                    .value as IntegrationSettings["ftpProtocol"],
                  ftpPort: event.target.value === "SFTP" ? "22" : "21",
                })
              }
            >
              <option>SFTP</option>
              <option>FTP</option>
            </select>
          </label>
          <label>
            Host
            <input
              value={settings.ftpHost}
              onChange={(event) =>
                setSettings({ ...settings, ftpHost: event.target.value })
              }
              placeholder="files.partner.ch"
            />
          </label>
          <label>
            Port
            <input
              inputMode="numeric"
              value={settings.ftpPort}
              onChange={(event) =>
                setSettings({ ...settings, ftpPort: event.target.value })
              }
            />
          </label>
          <label>
            Benutzername
            <input
              value={settings.ftpUsername}
              onChange={(event) =>
                setSettings({ ...settings, ftpUsername: event.target.value })
              }
              placeholder="printcenter"
            />
          </label>
          <label>
            Zielverzeichnis
            <input
              value={settings.ftpDirectory}
              onChange={(event) =>
                setSettings({ ...settings, ftpDirectory: event.target.value })
              }
              placeholder="/printcenter"
            />
          </label>
        </div>
      </section>
      <div className="integration-save">
        <button className="primary-button" type="submit">
          Anbindungen speichern
        </button>
      </div>
    </form>
  );
}

function BackendUserEditForm({
  user,
  onCancel,
  onSubmit,
}: {
  user: BackendUser;
  onCancel: () => void;
  onSubmit: (data: { name: string; email: string; password: string }) => void;
}) {
  return (
    <form
      className="backend-user-edit"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmit({
          name: String(data.get("name") || ""),
          email: String(data.get("email") || ""),
          password: String(data.get("password") || ""),
        });
      }}
    >
      <label>
        Name
        <input name="name" defaultValue={user.name} required />
      </label>
      <label>
        Login / Mail
        <input name="email" type="email" defaultValue={user.email} required />
      </label>
      <label>
        Neues Passwort
        <input
          name="password"
          type="password"
          placeholder="leer = unverändert"
        />
      </label>
      <button className="primary-button" type="submit">
        Speichern
      </button>
      <button className="secondary-button" type="button" onClick={onCancel}>
        Abbrechen
      </button>
    </form>
  );
}
