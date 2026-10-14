import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  PayrollPreview,
  type PayrollPreviewRole,
  type PayrollPreviewState,
  type PayrollPreviewView,
} from "./payroll-preview";

export const metadata: Metadata = {
  title: "Bảng lương · dev",
  robots: { index: false, follow: false },
};

const views: PayrollPreviewView[] = ["dashboard", "ledger", "payslip"];
const roles: PayrollPreviewRole[] = ["owner", "accountant", "staff"];
const states: PayrollPreviewState[] = ["normal", "empty", "errors"];

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Payroll preview mirroring `08-bang-luong.dc.html` (frames 8a, 8b) with
 * fixture data inside the shell.
 * `?view=dashboard|ledger|payslip&role=owner|accountant|staff&state=normal|empty|errors`.
 * Inert: the live estimate runs on a fixture transport (no `/api/payroll/*`
 * fetch, no realtime channel) and the payslip PDF action is disabled.
 * Development only: 404 in production.
 */
export default async function DevPayrollPage({
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
    <PayrollPreview
      role={roles.includes(role as PayrollPreviewRole) ? (role as PayrollPreviewRole) : "owner"}
      state={states.includes(state as PayrollPreviewState) ? (state as PayrollPreviewState) : "normal"}
      view={views.includes(view as PayrollPreviewView) ? (view as PayrollPreviewView) : "dashboard"}
    />
  );
}
