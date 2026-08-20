"use client";

import { useEffect, useMemo, useState } from "react";

type StockEvent = {
  date: string;
  change: number;
  stock: number;
  reason: string;
};

type StockArticle = {
  id: number;
  sku: string;
  name: string;
  designation1: string;
  designation2: string;
  customerId?: number;
  stock: number;
  minimum: number;
  stockHistory: StockEvent[];
};

type StockState = {
  articles: StockArticle[];
  backendUsers: Array<{ id: number; active: boolean }>;
  customers: Array<{
    id: number;
    employees: Array<{ id: number }>;
  }>;
};

const parseStockDate = (value: string) => {
  const swiss = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (swiss)
    return new Date(Number(swiss[3]), Number(swiss[2]) - 1, Number(swiss[1]));
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date(0);
};

const formatStockDate = (value: string) =>
  new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: value.includes("T") ? "short" : undefined,
    timeZone: "Europe/Zurich",
  }).format(parseStockDate(value));

export function StockHistoryView({ articleId }: { articleId: number }) {
  const [state, setState] = useState<StockState | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [period, setPeriod] = useState<"month" | "year">("month");

  useEffect(() => {
    let active = true;
    void fetch("/api/state", { headers: { "Content-Type": "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Daten konnten nicht geladen werden.");
        return (await response.json()) as StockState;
      })
      .then((nextState) => {
        if (!active) return;
        const article = nextState.articles.find((item) => item.id === articleId);
        let permitted = false;
        try {
          const backendValue = window.localStorage.getItem(
            "printcenter:backend-session:v1",
          );
          if (backendValue) {
            const { userId } = JSON.parse(backendValue) as { userId?: number };
            permitted = nextState.backendUsers.some(
              (user) => user.id === userId && user.active,
            );
          }
          if (!permitted) {
            const customerValue = window.localStorage.getItem(
              "printcenter:customer-session:v1",
            );
            if (customerValue) {
              const { customerId, employeeId } = JSON.parse(customerValue) as {
                customerId?: number;
                employeeId?: number;
              };
              const customer = nextState.customers.find(
                (item) => item.id === customerId,
              );
              permitted = Boolean(
                article?.customerId === customerId &&
                  customer?.employees.some(
                    (employee) => employee.id === employeeId,
                  ),
              );
            }
          }
        } catch {
          permitted = false;
        }
        setState(nextState);
        setAuthorized(permitted);
      })
      .catch(() => {
        if (active) setAuthorized(false);
      });
    return () => {
      active = false;
    };
  }, [articleId]);

  const article = state?.articles.find((item) => item.id === articleId);
  const history = useMemo(
    () =>
      (article?.stockHistory ?? [])
        .slice()
        .sort(
          (left, right) =>
            parseStockDate(left.date).getTime() -
            parseStockDate(right.date).getTime(),
        ),
    [article],
  );
  const periodValues = useMemo(() => {
    const grouped = new Map<string, StockEvent>();
    for (const event of history) {
      const date = parseStockDate(event.date);
      const key =
        period === "month"
          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
          : String(date.getFullYear());
      grouped.set(key, event);
    }
    return [...grouped.entries()].map(([key, event]) => ({ key, ...event }));
  }, [history, period]);
  const maxAbsoluteStock = Math.max(
    1,
    ...periodValues.map((item) => Math.abs(item.stock)),
  );

  if (authorized === null)
    return (
      <main className="stock-history-page stock-history-state">
        <p className="eyebrow">LAGERBESTAND</p>
        <h1>Verlauf wird geladen.</h1>
      </main>
    );
  if (!authorized || !article)
    return (
      <main className="stock-history-page stock-history-state">
        <p className="eyebrow">ZUGRIFF GESCHÜTZT</p>
        <h1>Keine Berechtigung für diesen Lagerverlauf.</h1>
        <button type="button" onClick={() => window.close()}>
          Fenster schliessen
        </button>
      </main>
    );

  const coverage = article.stock - article.minimum;
  return (
    <main className="stock-history-page">
      <header className="stock-history-header">
        <div>
          <p className="eyebrow">PRINTCENTER · LAGERBESTAND</p>
          <h1>{article.sku}</h1>
          <strong>{article.name}</strong>
        </div>
        <button type="button" onClick={() => window.close()}>
          Fenster schliessen
        </button>
      </header>
      <section className="stock-history-metrics">
        <article>
          <span>Aktueller Bestand</span>
          <strong>{article.stock} Stück</strong>
        </article>
        <article>
          <span>Meldebestand</span>
          <strong>{article.minimum} Stück</strong>
        </article>
        <article>
          <span>Deckung</span>
          <strong className={coverage < 0 ? "is-negative" : ""}>
            {coverage > 0 ? "+" : ""}
            {coverage} Stück
          </strong>
        </article>
      </section>
      <section className="stock-history-chart-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">ENTWICKLUNG</p>
            <h2>Bestand pro {period === "month" ? "Monat" : "Jahr"}</h2>
          </div>
          <div className="stock-period-switch">
            <button
              className={period === "month" ? "is-active" : ""}
              type="button"
              onClick={() => setPeriod("month")}
            >
              Monate
            </button>
            <button
              className={period === "year" ? "is-active" : ""}
              type="button"
              onClick={() => setPeriod("year")}
            >
              Jahre
            </button>
          </div>
        </div>
        {periodValues.length ? (
          <div className="stock-history-chart" role="img" aria-label="Grafik des Lagerbestands">
            {periodValues.map((item) => (
              <div className="stock-chart-column" key={item.key}>
                <strong>{item.stock}</strong>
                <i
                  className={item.stock < 0 ? "is-negative" : ""}
                  style={{
                    height: `${Math.max(8, (Math.abs(item.stock) / maxAbsoluteStock) * 180)}px`,
                  }}
                />
                <span>{item.key}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-copy">Noch keine Bestandsbewegungen vorhanden.</p>
        )}
      </section>
      <section className="stock-history-events-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">PROTOKOLL</p>
            <h2>Alle Bestandsbewegungen</h2>
          </div>
          <span>{history.length} Einträge</span>
        </div>
        <div className="stock-history-event-list">
          {history
            .slice()
            .reverse()
            .map((event, index) => (
              <article key={`${event.date}-${index}`}>
                <time>{formatStockDate(event.date)}</time>
                <strong>{event.stock} Stück</strong>
                <b className={event.change < 0 ? "is-negative" : ""}>
                  {event.change > 0 ? "+" : ""}
                  {event.change}
                </b>
                <span>{event.reason}</span>
              </article>
            ))}
        </div>
      </section>
    </main>
  );
}
