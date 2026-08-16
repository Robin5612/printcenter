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
