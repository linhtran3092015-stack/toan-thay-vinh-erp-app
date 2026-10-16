import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  SettingsPreview,
  type SettingsPreviewRole,
  type SettingsPreviewState,
  type SettingsPreviewView,
} from "./settings-preview";

export const metadata: Metadata = {
  title: "Cài đặt · dev",
  robots: { index: false, follow: false },
};

const views: SettingsPreviewView[] = ["general", "zalo", "branding", "website", "permissions"];
const roles: SettingsPreviewRole[] = ["owner", "manager", "viewer"];
const states: SettingsPreviewState[] = ["normal", "dirty", "error"];

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Settings hub preview mirroring `09-cai-dat.dc.html` (frames 9a, 9b) with
 * fixture data inside the shell.
 * `?view=general|zalo|branding|website|permissions&role=owner|manager|viewer&state=normal|dirty|error`.
 * Every write (system settings, website/branding save and publish, role
 * permissions, the personal palette) and the ZaloCRM nick list are inert
 * stubs (previewSettingsActions): the preview never calls a server action.
 * Development only: 404 in production.
 */
export default async function DevSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const params = await searchParams;
  const view = first(params.view);
  const role = first(params.role);
  const state = first(params.state);

  return (
    <SettingsPreview
      role={roles.includes(role as SettingsPreviewRole) ? (role as SettingsPreviewRole) : "owner"}
      state={states.includes(state as SettingsPreviewState) ? (state as SettingsPreviewState) : "normal"}
      view={views.includes(view as SettingsPreviewView) ? (view as SettingsPreviewView) : "branding"}
    />
  );
}
