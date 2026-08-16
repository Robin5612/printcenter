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

test("server-renders the Printcenter backend login", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Printcenter · Druckproduktion im Fluss<\/title>/i);
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

test("keeps the public customer route available", async () => {
  const response = await render("/K-10024");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Printcenter/);
  assert.doesNotMatch(html, /Your site is taking shape/i);
});
