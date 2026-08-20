import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyStockSnapshot,
  attachGzdToArticle,
  isOrderForSupplier,
  reachesReorderPoint,
} from "../app/printcenter-relations.ts";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the general customer login at the root URL", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Printcenter<\/title>/i);
  assert.match(html, /KUNDENPORTAL/);
  assert.match(html, /Kundenlogin\./);
  assert.match(html, /Kundennummer/);
  assert.doesNotMatch(html, /BACKEND-ZUGANG|Backend anmelden\./);
});

test("keeps the backend login exclusively at /backend", async () => {
  const response = await render("/backend");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Printcenter backend<\/title>/i);
  assert.match(html, /BACKEND-ZUGANG/);
  assert.match(html, /Backend anmelden\./);
  assert.doesNotMatch(
    html,
    /Willkommen zurück|Bereit für den nächsten Auftrag/,
  );
  assert.match(html, /Backend öffnen/);
  assert.doesNotMatch(
    html,
    /codex-preview|SkeletonPreview|Your site is taking shape/i,
  );
});

test("renders the one-time backend password reset route", async () => {
  const response = await render(
    "/backend/passwort-zuruecksetzen/11111111-1111-4111-8111-111111111111",
  );
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<title>Printcenter backend<\/title>/i);
  assert.match(html, /Neues Passwort setzen\./);
  assert.match(html, /Passwort bestätigen/);
  assert.doesNotMatch(html, /Kundenlogin\./);
});

test("renders the one-time customer password reset route", async () => {
  const response = await render(
    "/passwort-zuruecksetzen/11111111-1111-4111-8111-111111111111",
  );
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Passwort zurücksetzen · Printcenter/);
  assert.match(html, /KUNDENPORTAL/);
  assert.match(html, /Neues Passwort setzen\./);
  assert.doesNotMatch(html, /BACKEND-ZUGANG|Backend anmelden\./);
});

test("keeps the public customer route available", async () => {
  const response = await render("/K-10024");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Printcenter/);
  assert.match(html, /K-10024[\s\S]*KUNDENPORTAL/);
  assert.doesNotMatch(html, /BACKEND-ZUGANG|Backend anmelden\./);
  assert.doesNotMatch(html, /Your site is taking shape/i);
});

test("keeps backend portal previews in a dedicated authorization state", async () => {
  const response = await render(
    "/K-10024?portal-preview=11111111-1111-4111-8111-111111111111",
  );
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Portal wird geöffnet\./);
  assert.doesNotMatch(html, /Backend anmelden\.|Kundenlogin\./);
});

test("does not mark supplier links as expired while data is loading", async () => {
  const response = await render("/supplier-offer/SUP-123456789");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Anfrage wird geladen\./);
  assert.doesNotMatch(html, /Link nicht mehr verfügbar|abgelaufen/);
});

test("never falls back to the backend login for an unknown customer number", async () => {
  const response = await render("/UNBEKANNT");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Kundenlogin\./);
  assert.match(html, /Kundennummer/);
  assert.doesNotMatch(html, /BACKEND-ZUGANG|Backend anmelden\./);
});

test("keeps personal backend settings visible and removes the portal footer slogan", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /MEIN KONTO/);
  assert.match(source, /Mail &amp; Passwort verwalten/);
  assert.match(source, /Backend-Passwort zurücksetzen/);
  assert.match(source, /Mein Backend-Zugang/);
  assert.match(source, /Reset-Link senden/);
  assert.doesNotMatch(
    source,
    /Eine URL · eine persönliche Sicht · hello@printcenter\.ch/,
  );
});

test("lets customer employees maintain their profile and request a password reset", async () => {
  const [pageSource, workerSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /Meine Einstellungen/);
  assert.match(pageSource, /Persönliche Daten/);
  assert.match(pageSource, /Kundenportal-Passwort zurücksetzen/);
  assert.match(pageSource, /customerPasswordResetTemplate/);
  assert.match(workerSource, /\/api\/customer-password-resets/);
  assert.match(workerSource, /customer_password_reset_template/);
});

test("provides protected data deletion and configurable SFTP CSV mappings", async () => {
  const [pageSource, workerSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /Alle Betriebsdaten löschen/);
  assert.match(pageSource, /ALLE DATEN LÖSCHEN/);
  assert.match(pageSource, /Datenmapping konfigurieren/);
  assert.match(pageSource, /Alle 15 Minuten/);
  assert.match(workerSource, /\/api\/system-data/);
  assert.match(workerSource, /sftp_csv_mapping_json/);
});

test("keeps the collective-order compatibility notice without naming confidentiality", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /Es können nur miteinander kombinierbare Artikel hinzugefügt\s+werden\./,
  );
  assert.doesNotMatch(source, /Der zuständige Lieferant bleibt vertraulich/);
});

test("binds uploaded GzD files to their article without duplicates", () => {
  const articles = [{ id: 7, templates: [] }];
  const first = attachGzdToArticle(articles, {
    articleId: 7,
    id: 101,
    file: "druckdaten.pdf",
    url: "/api/files/druckdaten.pdf",
    addedAt: "17.08.2026, 10:00",
  });
  const duplicate = attachGzdToArticle(first, {
    articleId: 7,
    id: 102,
    file: "druckdaten.pdf",
    url: "/api/files/druckdaten.pdf",
    addedAt: "17.08.2026, 10:01",
  });

  assert.equal(duplicate[0].templates.length, 1);
  assert.equal(duplicate[0].templates[0].file, "druckdaten.pdf");
});

test("assigns order documents to the corresponding supplier", () => {
  const supplier = { id: 20, name: "Druckpartner AG" };
  assert.equal(
    isOrderForSupplier(
      { type: "Bestellung", supplierId: 20, supplier: "Druckpartner AG" },
      supplier,
    ),
    true,
  );
  assert.equal(
    isOrderForSupplier(
      { type: "Bestellung", supplierId: 21, supplier: "Andere AG" },
      supplier,
    ),
    false,
  );
  assert.equal(
    isOrderForSupplier(
      { type: "Angebot", supplierId: 20, supplier: "Druckpartner AG" },
      supplier,
    ),
    false,
  );
});

test("records SFTP-style stock snapshots as exact movements", () => {
  const article = {
    stock: 10,
    minimum: 7,
    stockHistory: [],
  };
  const updated = applyStockSnapshot(article, 6, {
    date: "2026-08-20T08:00:00.000Z",
    reason: "Bestandsimport über SFTP",
  });

  assert.equal(updated.stock, 6);
  assert.equal(updated.stockHistory.length, 1);
  assert.equal(updated.stockHistory[0].change, -4);
  assert.equal(updated.stockHistory[0].stock, 6);
  assert.equal(reachesReorderPoint(10, 6, 7), true);
  assert.equal(reachesReorderPoint(6, 5, 7), false);
  assert.equal(applyStockSnapshot(updated, 6, {
    date: "2026-08-21T08:00:00.000Z",
    reason: "Bestandsimport über SFTP",
  }).stockHistory.length, 1);
});

test("exposes complete collective editing, creation dates and stock-history links", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Erstellt: \{formatDocumentCreatedAt\(document\)\}/);
  assert.match(source, /Sammelbeleg speichern &amp; PDF neu erzeugen/);
  assert.match(source, /Lagerbestandsverlauf öffnen/);
  assert.match(source, /href=\{`\/lagerbestand\/\$\{article\.id\}`\}/);
  assert.match(source, /Meldebestand erreicht/);
  assert.match(source, /Automatisch senden an/);
  assert.match(source, /wirklich löschen\?/);
});

test("renders the protected stock history route", async () => {
  const response = await render("/lagerbestand/1");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Lagerbestand · Printcenter/);
  assert.match(html, /Verlauf wird geladen/);
});
