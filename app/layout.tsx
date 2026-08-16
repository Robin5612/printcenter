import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);

  return {
    metadataBase: baseUrl,
    title: "Printcenter",
    description: "Kunden, Lieferanten, Belege, Artikel und Nachbestellungen in einer Anwendung.",
    openGraph: {
      title: "Printcenter · Druckproduktion im Fluss",
      description: "Die operative Schaltzentrale für deine Druckproduktion.",
      images: [{ url: new URL("/og.png", baseUrl), width: 1731, height: 908, alt: "Printcenter – Druckproduktion im Fluss" }],
    },
    twitter: { card: "summary_large_image", title: "Printcenter", images: [new URL("/og.png", baseUrl)] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
