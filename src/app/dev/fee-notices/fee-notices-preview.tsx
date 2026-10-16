"use client";

import { AppShell } from "@/components/layout/app-shell";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import type { TuitionActionResult } from "@/features/tuition/actions";
import {
  buildFeeNoticeModel,
  FEE_NOTICE_PLACEHOLDER_QR,
  resolveFeeNoticeEditions,
  sortFeeNoticesForPrint,
  type FeeNoticeItemRow,
  type FeeNoticeLineRow,
  type FeeNoticeModel,
  type FeeNoticePeriodRow,
} from "@/features/tuition/fee-notice-model";
import { FeeNoticeDetailScreen, FeeNoticePrintScreen } from "@/features/tuition/fee-notice-screens";
import { TuitionTemplateManagement } from "@/features/tuition/template-management";
import {
  summarizeTemplateUsage,
  toTuitionTemplateVersions,
  type TuitionTemplatePeriodRow,
  type TuitionTemplateVersionRow,
} from "@/features/tuition/receipt-template-models";
import type { TuitionNoticeActionOverrides } from "@/features/tuition/tuition-action-overrides";
import { DATABASE_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions/types";

export type FeeNoticesPreviewView = "templates" | "print" | "notice";
export type FeeNoticesPreviewRole = "owner" | "accountant";
/** `first`: only the seeded v1 (no publisher); `empty`: nothing published yet. */
export type FeeNoticesTemplatesState = "normal" | "first" | "empty";
export type FeeNoticesPrintState = "normal" | "empty";
export type FeeNoticesNoticeState = "payable" | "no_payment" | "replacement" | "superseded" | "malformed";

export type FeeNoticesPreviewProps = { role: FeeNoticesPreviewRole } & (
  | { state: FeeNoticesTemplatesState; view: "templates" }
  | { state: FeeNoticesPrintState; view: "print" }
  | { state: FeeNoticesNoticeState; view: "notice" }
);

const STUB = "Bản xem trước không ghi dữ liệu.";

const stub = async (): Promise<TuitionActionResult> => ({ message: STUB, status: "error" });

/**
 * Inert stand-ins for the fee-notice writes (publishing a template version,
 * reissuing a notice). The preview runs on localhost where .env.local may
 * point at production, so neither control may reach a server action.
 */
export const previewFeeNoticeActions: Required<TuitionNoticeActionOverrides> = {
  publish: stub,
  reissue: stub,
};

/** Print buttons call this instead of `window.print()`: the preview never opens the print dialog. */
export const previewFeeNoticePrint = {
  print: (): void => undefined,
};

/** Fixed ids with a per-feature prefix so fixtures never collide with other previews. */
const id = (n: number) => `f1500000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Accountant: prints and follows notices; templates and reissues stay with the owner. */
const accountantPermissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "finance.view",
  "payments.view",
  "payments.create_request",
  "sepay.view",
  "sepay.allocate",
  "tuition_periods.view",
  "tuition_periods.manage",
  "tuition_periods.export",
  "students.view",
  "students.manage_tuition_rates",
  "students.correct_acquisition_source",
];

const rolePermissions: Record<FeeNoticesPreviewRole, readonly PermissionCode[]> = {
  accountant: accountantPermissions,
  // Without student_care.view: the shell would mount the care queue's refresh loop.
  owner: DATABASE_PERMISSION_CODES.filter((code) => code !== "student_care.view"),
};

const roleUsers: Record<FeeNoticesPreviewRole, { initials: string; name: string }> = {
  accountant: { initials: "PH", name: "Phạm Thu Hạnh" },
  owner: { initials: "NV", name: "Nguyễn Văn Vinh" },
};

// ---------------------------------------------------------------------------
// Templates (15b left column)

const VERSION_IDS = { v1: id(11), v2: id(12), v3: id(13) } as const;
const PERIOD_IDS = { aug: id(4), nov: id(2), oct: id(1), sep: id(3) } as const;

const ANNOUNCEMENT =
  "Kính gửi quý phụ huynh, trung tâm xin thông báo học phí tháng tới của con theo số buổi đã học. Quý phụ huynh vui lòng chuyển khoản theo mã QR hoặc nội dung chuyển khoản bên dưới trước ngày hạn.";

const seedVersion: TuitionTemplateVersionRow = {
  content: {
    center_display_name: "Trung tâm Toán Thầy Vinh",
    footer: "Phụ huynh vui lòng kiểm tra thông tin học phí trước khi thanh toán.",
    show_qr: true,
    title: "HỌC PHÍ {PERIOD_NAME}",
  },
  id: VERSION_IDS.v1,
  published_at: "2026-07-30T01:00:00Z",
  published_by: null,
  publisher: null,
  reason: "Default Wave A template",
  version_number: 1,
};

const v3Content = {
  announcement: ANNOUNCEMENT,
  center_display_name: "Trung tâm Toán Thầy Vinh",
  footer: "Thắc mắc liên hệ 0988 123 456 (cô Hằng) · Trân trọng cảm ơn!",
  show_qr: true,
  title: "PHIẾU HỌC PHÍ",
};

/** Newest first, as the route reads them. */
const templateVersions: Record<FeeNoticesTemplatesState, TuitionTemplateVersionRow[]> = {
  empty: [],
  first: [seedVersion],
  normal: [
    {
      content: v3Content,
      id: VERSION_IDS.v3,
      published_at: "2026-09-25T03:12:00Z",
      published_by: id(21),
      publisher: { display_name: "Nguyễn Thu Hằng" },
      reason: "Đổi chân trang sang số cô Hằng",
      version_number: 3,
    },
    {
      content: { ...v3Content, footer: "Thắc mắc liên hệ 0912 000 111 (thầy Vinh) · Trân trọng cảm ơn!" },
      id: VERSION_IDS.v2,
      published_at: "2026-08-28T02:05:00Z",
      published_by: id(22),
      publisher: { display_name: "Nguyễn Văn Vinh" },
      reason: "Thêm đoạn thông báo và đổi tiêu đề",
      version_number: 2,
    },
    seedVersion,
  ],
};

const draftNovember: TuitionTemplatePeriodRow = { id: PERIOD_IDS.nov, name: "Học phí tháng 11/2026", receipt_template_version_id: null, status: "draft" };
const lockedAugust: TuitionTemplatePeriodRow = { id: PERIOD_IDS.aug, name: "Học phí tháng 08/2026", receipt_template_version_id: VERSION_IDS.v1, status: "locked" };

const templatePeriods: Record<FeeNoticesTemplatesState, TuitionTemplatePeriodRow[]> = {
  empty: [draftNovember],
  first: [draftNovember, lockedAugust],
  normal: [
    draftNovember,
    { id: PERIOD_IDS.oct, name: "Học phí tháng 10/2026", receipt_template_version_id: VERSION_IDS.v3, status: "locked" },
    { id: PERIOD_IDS.sep, name: "Học phí tháng 09/2026", receipt_template_version_id: VERSION_IDS.v2, status: "locked" },
    lockedAugust,
  ],
};

// ---------------------------------------------------------------------------
// Notices (15b right column): row-shaped fixtures through the real model

const period: FeeNoticePeriodRow = { due_on: "2026-10-15", id: PERIOD_IDS.oct, name: "Học phí tháng 10/2026" };

const ITEM_IDS = {
  anh: id(101),
  chau: id(105),
  linh: id(106),
  minh: id(103),
  minhReplacement: id(104),
  nam: id(102),
} as const;

function contract(amountVnd: number, transferCode: string, publicCode: string, overrides: Record<string, unknown> = {}) {
  return {
    account_display_name: "TOAN THAY VINH",
    account_number: "0399886886",
    amount_vnd: amountVnd,
    bank_code: "MB",
    public_code: publicCode,
    purpose: "renewal",
    qr_format: "vietqr.app",
    transfer_code: transferCode,
    version: 1,
    ...overrides,
  };
}

function item(itemId: string, student: { className: string; code: string; grade: number; name: string }, fields: Partial<FeeNoticeItemRow>): FeeNoticeItemRow {
  return {
    id: itemId,
    opening_balance_sessions: 0,
    payable_amount_vnd: 0,
    payable_sessions: 0,
    payment_contract_snapshot: {},
    period_id: period.id,
    receipt_template_snapshot: v3Content,
    reissued_from_item_id: null,
    scheduled_chargeable_sessions: 0,
    source_snapshot: { code: "DIRECT", name: "Đến trực tiếp trung tâm" },
    status: "pending_payment",
    student_snapshot: { class_name: student.className, current_grade: student.grade, full_name: student.name, public_code: student.code },
    ...fields,
  };
}

/** `count` session lines at one rate, every `step` days from `firstDay` of October. */
function sessionLines(itemId: string, key: string, count: number, rate: number, firstDay: number, step: number, payable = 1): FeeNoticeLineRow[] {
  return Array.from({ length: count }, (_, index) => ({
    class_session_id: `${key}-${String(index).padStart(2, "0")}`,
    item_id: itemId,
    line_kind: "session",
    payable_session_count: payable,
    session_date: `2026-10-${String(firstDay + index * step).padStart(2, "0")}`,
    unit_price_vnd: rate,
  }));
}

const noticeItems: FeeNoticeItemRow[] = [
  // Two rates and one session owed from before the period: 12 × 200.000 + 8 × 250.000 + 1 × 200.000.
  item(ITEM_IDS.anh, { className: "Toán 9A tối 2-4-6", code: "TTV-00123", grade: 9, name: "Nguyễn Minh Anh" }, {
    opening_balance_sessions: -1,
    payable_amount_vnd: 4_600_000,
    payable_sessions: 21,
    payment_contract_snapshot: contract(4_600_000, "NGUYEN MINH ANH 2011 0912345678 PAY-261015-1A2B3C4D5E6F", "PAY-261015-1A2B3C4D5E6F"),
    scheduled_chargeable_sessions: 20,
  }),
  // The opening balance covers every session: locked with no payment and no contract.
  item(ITEM_IDS.nam, { className: "Toán 9A tối 2-4-6", code: "TTV-00098", grade: 9, name: "Lê Hoàng Nam" }, {
    opening_balance_sessions: 15,
    scheduled_chargeable_sessions: 12,
    status: "no_payment",
  }),
  // Reissued: the original's request was cancelled, the replacement is the one to pay.
  item(ITEM_IDS.minh, { className: "Toán 9A tối 2-4-6", code: "TTV-00117", grade: 9, name: "Bùi Quang Minh" }, {
    payable_amount_vnd: 2_520_000,
    payable_sessions: 12,
    payment_contract_snapshot: contract(2_520_000, "BUI QUANG MINH 2011 0903456789 PAY-260928-7F3E9A0B1C2D", "PAY-260928-7F3E9A0B1C2D"),
    scheduled_chargeable_sessions: 12,
  }),
  item(ITEM_IDS.minhReplacement, { className: "Toán 9A tối 2-4-6", code: "TTV-00117", grade: 9, name: "Bùi Quang Minh" }, {
    payable_amount_vnd: 2_400_000,
    payable_sessions: 12,
    payment_contract_snapshot: contract(2_400_000, "BUI QUANG MINH 2011 0903456789 PAY-261005-9C8B7A6D5E4F", "PAY-261005-9C8B7A6D5E4F"),
    reissued_from_item_id: ITEM_IDS.minh,
    scheduled_chargeable_sessions: 12,
  }),
  // A historic contract without an account number: payable, but no QR is ever rebuilt for it.
  item(ITEM_IDS.chau, { className: "Toán 8B chiều 3-5", code: "TTV-00205", grade: 8, name: "Trịnh Bảo Châu" }, {
    payable_amount_vnd: 1_600_000,
    payable_sessions: 8,
    payment_contract_snapshot: contract(1_600_000, "TRINH BAO CHAU 2012 0977001122 PAY-260928-0D1E2F3A4B5C", "PAY-260928-0D1E2F3A4B5C", {
      account_display_name: undefined,
      account_number: undefined,
    }),
    scheduled_chargeable_sessions: 8,
  }),
  item(ITEM_IDS.linh, { className: "Toán 7A tối 3-5", code: "TTV-00212", grade: 7, name: "Mai Phương Linh" }, {
    payable_amount_vnd: 1_440_000,
    payable_sessions: 8,
    payment_contract_snapshot: contract(1_440_000, "MAI PHUONG LINH 2013 0965432100 PAY-260928-5A6B7C8D9E0F", "PAY-260928-5A6B7C8D9E0F"),
    scheduled_chargeable_sessions: 8,
  }),
];

const noticeLines: FeeNoticeLineRow[] = [
  ...sessionLines(ITEM_IDS.anh, "anh-9a", 12, 200_000, 1, 2),
  ...sessionLines(ITEM_IDS.anh, "anh-9c", 8, 250_000, 2, 3),
  { class_session_id: null, item_id: ITEM_IDS.anh, line_kind: "opening_debit", payable_session_count: 1, session_date: null, unit_price_vnd: 200_000 },
  ...sessionLines(ITEM_IDS.nam, "nam-9a", 12, 200_000, 1, 2, 0),
  ...sessionLines(ITEM_IDS.minh, "minh-9a", 12, 210_000, 1, 2),
  ...sessionLines(ITEM_IDS.chau, "chau-8b", 8, 200_000, 2, 3),
  ...sessionLines(ITEM_IDS.linh, "linh-7a", 8, 180_000, 3, 3),
];

/** Local QR placeholder: a preview never calls the VietQR service or shows a payable code. */
function withPlaceholderQr(model: FeeNoticeModel): FeeNoticeModel {
  return model.payment.kind === "qr" ? { ...model, payment: { ...model.payment, imageUrl: FEE_NOTICE_PLACEHOLDER_QR } } : model;
}

/** Notices for the requested ids, the way loadFeeNotices builds them (editions from the reissue link). */
function buildNotices(itemIds: readonly string[]): FeeNoticeModel[] {
  const editions = resolveFeeNoticeEditions(itemIds, [{ originalItemId: ITEM_IDS.minh, replacementItemId: ITEM_IDS.minhReplacement }]);
  return noticeItems
    .filter((row) => itemIds.includes(row.id))
    .map((row) => withPlaceholderQr(buildFeeNoticeModel({ edition: editions.get(row.id), item: row, lines: noticeLines, period })));
}

const noticeForState: Record<FeeNoticesNoticeState, string> = {
  malformed: ITEM_IDS.chau,
  no_payment: ITEM_IDS.nam,
  payable: ITEM_IDS.anh,
  replacement: ITEM_IDS.minhReplacement,
  superseded: ITEM_IDS.minh,
};

function noticePathname(notice: FeeNoticeModel): string {
  return `/finance/tuition-periods/${notice.periodId}/items/${notice.itemId}/notice`;
}

// ---------------------------------------------------------------------------

export function FeeNoticesPreview(props: FeeNoticesPreviewProps) {
  const { role } = props;
  const permissions = rolePermissions[role];
  const can = (code: PermissionCode) => permissions.includes(code);
  const user = roleUsers[role];
  const notice = props.view === "notice" ? buildNotices(Object.values(ITEM_IDS)).find((model) => model.itemId === noticeForState[props.state]) : undefined;
  const pathname =
    props.view === "templates"
      ? "/finance/tuition-periods/templates"
      : props.view === "print"
        ? "/finance/tuition-periods/print"
        : notice
          ? noticePathname(notice)
          : "/finance/tuition-periods";

  return (
    <AppShell
      authUser={{ displayName: user.name, email: "preview@example.com", id: "dev-user", initials: user.initials }}
      centerDisplayName="Toán Thầy Vinh"
      permissions={permissions}
      previewPathname={pathname}
      unreadNotificationCount={3}
    >
      {props.view === "templates" ? <TemplatesView can={can} state={props.state} /> : null}
      {props.view === "print" ? <PrintView state={props.state} /> : null}
      {props.view === "notice" && notice ? (
        <FeeNoticeDetailScreen
          canAdjust={can("tuition_periods.adjust")}
          key={props.state}
          notice={notice}
          onPrint={() => previewFeeNoticePrint.print()}
          reissueAction={previewFeeNoticeActions.reissue}
        />
      ) : null}
    </AppShell>
  );
}

function TemplatesView({ can, state }: { can: (code: PermissionCode) => boolean; state: FeeNoticesTemplatesState }) {
  // Same gate and copy as the route.
  if (!can("settings.receipts.manage")) {
    return <PermissionDeniedState description="Yêu cầu quyền settings.receipts.manage." title="Không có quyền quản lý mẫu" />;
  }
  const versions = toTuitionTemplateVersions(templateVersions[state]);
  return (
    <TuitionTemplateManagement
      key={state}
      publishAction={previewFeeNoticeActions.publish}
      usage={can("tuition_periods.view") ? summarizeTemplateUsage(templatePeriods[state], versions[0]?.id ?? null) : null}
      versions={versions}
    />
  );
}

function PrintView({ state }: { state: FeeNoticesPrintState }) {
  if (state === "empty") {
    return <FeeNoticePrintScreen missingCount={0} notices={[]} onPrint={() => previewFeeNoticePrint.print()} skippedCount={0} />;
  }
  // As the route: every requested id is read, superseded originals are skipped and counted.
  const all = buildNotices(Object.values(ITEM_IDS));
  const current = all.filter((model) => !model.edition.superseded);
  return (
    <FeeNoticePrintScreen
      missingCount={0}
      notices={sortFeeNoticesForPrint(current)}
      onPrint={() => previewFeeNoticePrint.print()}
      skippedCount={all.length - current.length}
    />
  );
}
