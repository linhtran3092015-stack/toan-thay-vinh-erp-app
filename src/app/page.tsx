import { AuthenticatedAppShell } from "@/components/layout/authenticated-app-shell";
import { DashboardPage } from "@/features/dashboard/dashboard-page";

export default function Home() {
  return (
    <AuthenticatedAppShell>
      <DashboardPage />
    </AuthenticatedAppShell>
  );
}
