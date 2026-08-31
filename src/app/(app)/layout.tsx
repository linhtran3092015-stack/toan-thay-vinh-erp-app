import { Suspense, type ReactNode } from "react";

import { AuthenticatedAppShell } from "@/components/layout/authenticated-app-shell";
import { AppShellLoading } from "@/components/layout/app-shell-loading";

export default function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<AppShellLoading />}>
      <AuthenticatedAppShell>{children}</AuthenticatedAppShell>
    </Suspense>
  );
}
