import { PrintcenterApp } from "../../../page";

export const metadata = {
  title: "Printcenter backend",
};

export default async function BackendPasswordResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <PrintcenterApp
      initialRoute="backend-reset"
      initialBackendResetToken={token}
    />
  );
}
