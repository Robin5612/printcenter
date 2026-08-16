import type { Metadata } from "next";
import { PrintcenterApp } from "../page";

export const metadata: Metadata = {
  title: "Printcenter backend",
};

export default function BackendRoute() {
  return <PrintcenterApp initialRoute="backend" />;
}
