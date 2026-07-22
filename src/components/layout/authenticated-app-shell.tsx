import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentAuthUser } from "@/features/auth/current-user";

interface AuthenticatedAppShellProps {
  children: ReactNode;
}

export async function AuthenticatedAppShell({
  children,
}: AuthenticatedAppShellProps) {
  await connection();
  const result = await getCurrentAuthUser();

  if (!result.ok) {
    redirect(`/login?error=${result.error}`);
  }

  return <AppShell authUser={result.user}>{children}</AppShell>;
}
