import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  FeeNoticesPreview,
  type FeeNoticesNoticeState,
  type FeeNoticesPreviewRole,
  type FeeNoticesPreviewView,
  type FeeNoticesPrintState,
  type FeeNoticesTemplatesState,
} from "./fee-notices-preview";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Phiếu học phí · dev",
};

// The first entry of each list is its default; unknown values fall back to it.
const views: readonly [FeeNoticesPreviewView, ...FeeNoticesPreviewView[]] = ["templates", "print", "notice"];
const roles: readonly [FeeNoticesPreviewRole, ...FeeNoticesPreviewRole[]] = ["owner", "accountant"];
const templateStates: readonly [FeeNoticesTemplatesState, ...FeeNoticesTemplatesState[]] = ["normal", "first", "empty"];
const printStates: readonly [FeeNoticesPrintState, ...FeeNoticesPrintState[]] = ["normal", "empty"];
const noticeStates: readonly [FeeNoticesNoticeState, ...FeeNoticesNoticeState[]] = [
  "payable",
  "no_payment",
  "replacement",
  "superseded",
  "malformed",
];

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function pick<T extends string>(allowed: readonly [T, ...T[]], value: string | undefined): T {
  return allowed.find((item) => item === value) ?? allowed[0];
}

/**
 * Phiếu học phí preview mirroring `15-phieu-hoc-phi.dc.html` (frame 15b) with
 * fixture data inside the shell: the template page, the bulk print tab and
 * one notice, each on the real screen components.
 * `?view=templates|print|notice&role=owner|accountant&state=…`, where the
 * states depend on the view (an unknown or foreign state shows the view's
 * default, the first of each list; repeated keys use the first value):
 * - templates: `normal` (v3 in use, v2 and the seeded v1 in the history),
 *   `first` (only the seeded v1, publisher "Hệ thống"), `empty` (nothing
 *   published); the accountant sees the route's permission-denied state
 * - print: `normal` (two rates with an opening debit, a notice covered by its
 *   balance, a replacement, a malformed contract, one superseded original
 *   skipped), `empty` (no notice chosen)
 * - notice: `payable`, `no_payment`, `replacement`, `superseded`,
 *   `malformed`; the accountant has no reissue form
 * Publishing and reissuing are inert stubs (previewFeeNoticeActions), print
 * buttons never open the print dialog, and every QR is a local placeholder.
 * Development only: 404 in production.
 */
export default async function DevFeeNoticesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const params = await searchParams;
  const view = pick(views, first(params.view));
  const role = pick(roles, first(params.role));
  const state = first(params.state);

  if (view === "print") {
    return <FeeNoticesPreview role={role} state={pick(printStates, state)} view="print" />;
  }

  if (view === "notice") {
    return <FeeNoticesPreview role={role} state={pick(noticeStates, state)} view="notice" />;
  }

  return <FeeNoticesPreview role={role} state={pick(templateStates, state)} view="templates" />;
}
