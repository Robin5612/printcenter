import assert from "node:assert/strict";
import test from "node:test";

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
