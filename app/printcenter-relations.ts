export type ArticleGzdTemplate = {
  id: number;
  file: string;
  addedAt: string;
  url?: string;
};

export function attachGzdToArticle<
  T extends { id: number; templates: ArticleGzdTemplate[] },
>(
  articles: T[],
  input: {
    articleId: number;
    id: number;
    file?: string;
    url?: string;
    addedAt: string;
  },
): T[] {
  const file = input.file?.trim();
  if (!file) return articles;

  return articles.map((article) => {
    if (article.id !== input.articleId) return article;
    const alreadyAttached = article.templates.some((template) =>
      input.url
        ? template.url === input.url
        : !template.url &&
          template.file.trim().toLocaleLowerCase("de-CH") ===
            file.toLocaleLowerCase("de-CH"),
    );
    if (alreadyAttached) return article;

    return {
      ...article,
      templates: [
        {
          id: input.id,
          file,
          url: input.url,
          addedAt: input.addedAt,
        },
        ...article.templates,
      ],
    };
  });
}

export function isOrderForSupplier(
  document: { type: string; supplierId?: number; supplier?: string },
  supplier: { id: number; name: string },
) {
  if (document.type !== "Bestellung") return false;
  if (document.supplierId !== undefined)
    return document.supplierId === supplier.id;
  return (
    document.supplier?.trim().toLocaleLowerCase("de-CH") ===
    supplier.name.trim().toLocaleLowerCase("de-CH")
  );
}

export type StockTrackedArticle = {
  stock: number;
  minimum: number;
  stockHistory: Array<{
    date: string;
    change: number;
    stock: number;
    reason: string;
  }>;
};

export function reachesReorderPoint(
  previousStock: number,
  nextStock: number,
  reorderPoint: number,
) {
  return previousStock > reorderPoint && nextStock <= reorderPoint;
}

export function applyStockSnapshot<T extends StockTrackedArticle>(
  article: T,
  nextStock: number,
  options: { date: string; reason: string },
): T {
  if (!Number.isFinite(nextStock) || article.stock === nextStock) return article;
  return {
    ...article,
    stock: nextStock,
    stockHistory: [
      {
        date: options.date,
        change: nextStock - article.stock,
        stock: nextStock,
        reason: options.reason,
      },
      ...article.stockHistory,
    ],
  };
}
