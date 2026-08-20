import { PrintcenterApp } from "../../page";

export const metadata = {
  title: "Passwort zurücksetzen · Printcenter",
};

export default async function CustomerPasswordResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <PrintcenterApp
      initialRoute="customer-reset"
      initialCustomerResetToken={token}
    />
  );
}
