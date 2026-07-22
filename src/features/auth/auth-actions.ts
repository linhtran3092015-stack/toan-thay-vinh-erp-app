"use server";

import { redirect } from "next/navigation";

import { logAuthError } from "@/features/auth/auth-logging";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signOutAction(): Promise<void> {
  if (!isSupabaseConfigured()) {
    redirect("/login?error=auth_configuration_missing");
  }

  let failed = false;

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    failed = Boolean(error);
  } catch {
    failed = true;
  }

  if (failed) {
    logAuthError("signout", "/login");
    redirect("/login?error=signout_failed");
  }

  redirect("/login");
}
