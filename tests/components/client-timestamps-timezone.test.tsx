// Value: protects=client components that print timestamps show Vietnam time whatever zone the runtime is in, so a UTC
// server (Vercel) and a Vietnam browser render the same text and hydration does not fail (React #418);
// fails_when=a component formats an ISO timestamp with Intl or toLocaleString and no timeZone (a 01:30 note on 18/10 in
// Vietnam showed "18:30 17/10/2026" when rendered in UTC);
// seam=server actions and next/navigation mocked; process.env.TZ switched per case, then the component module is loaded
// fresh so module-level formatters are built in that zone, as on a server that booted in it; SSR'd components go
// through react-dom/server renderToString, components that show the time only after a click go through RTL;
// no_claim=does not hydrate in a browser
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CrmCaseNoteReadModel } from "@/features/crm/read-models";
import type { PaymentRequestReadModel, SepayTransactionReadModel } from "@/features/finance/read-models";
import type { ClassScheduleImportBatchDetail } from "@/features/imports/classes/types";
import type { StudentImportCommitResult } from "@/features/imports/students/types";
import type { SettingsAccountInvitation } from "@/features/settings/types";

const commitStudentImportRowsAction = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/crm/actions/crm-actions", () => ({ addCaseNoteAction: vi.fn(), completeFollowUpAction: vi.fn() }));
vi.mock("@/features/finance/actions/finance-actions", () => ({ cancelPaymentRequestAction: vi.fn() }));
vi.mock("@/features/finance/sepay-reconciliation-actions", () => ({
  matchSepayHistoricalTransactionAction: vi.fn(),
  resolveSepayHistoricalTransactionAction: vi.fn(),
  searchSepayReconciliationCandidatesAction: vi.fn(),
}));
vi.mock("@/features/imports/classes/actions", () => ({ commitClassScheduleImportBatchAction: vi.fn() }));
vi.mock("@/features/imports/students/actions", () => ({ commitStudentImportRowsAction }));
vi.mock("@/features/settings/actions", () => ({ revokeInvitationAction: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

/** 01:30:45 on Sunday 18/10/2026 in Vietnam, still 17/10 in UTC. */
const lateEvening = "2026-10-17T18:30:45Z";

/** Minutes from local time to UTC, as `Date#getTimezoneOffset` reports them. */
const zoneOffsets = { "Asia/Ho_Chi_Minh": -420, UTC: 0 } as const;
type Zone = keyof typeof zoneOffsets;

/** Switches the process zone, then loads the component's module graph fresh in that zone. */
async function loadIn<T>(zone: Zone, load: () => Promise<T>): Promise<T> {
  vi.stubEnv("TZ", zone);
  // Guard: the switch must reach Date and Intl, or every case would run in the runner's own zone.
  expect(new Date(lateEvening).getTimezoneOffset()).toBe(zoneOffsets[zone]);
  vi.resetModules();
  return load();
}

/** Server HTML of the element built by `build` from modules loaded in `zone`. */
async function serverHtmlIn<T>(zone: Zone, load: () => Promise<T>, build: (loaded: T) => ReactElement): Promise<string> {
  return renderToString(build(await loadIn(zone, load)));
}

/** Visible text of the server HTML, without React's `<!-- -->` text separators. */
function textOf(html: string): string {
  return html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

/** Renders on a UTC server and in Vietnam time: the UTC text, and whether both HTML strings match (no hydration diff). */
async function renderInBothZones<T>(load: () => Promise<T>, build: (loaded: T) => ReactElement): Promise<{ matchesVietnamRender: boolean; text: string }> {
  const utcHtml = await serverHtmlIn("UTC", load, build);
  const vietnamHtml = await serverHtmlIn("Asia/Ho_Chi_Minh", load, build);
  return { matchesVietnamRender: utcHtml === vietnamHtml, text: textOf(utcHtml) };
}

describe("Client components render timestamps in Vietnam time on a UTC server", () => {
  it("CRM case notes show when a note was written in Vietnam time", async () => {
    const note: CrmCaseNoteReadModel = { createdAt: lateEvening, createdBy: "sale-1", createdByName: "Hoàng Minh Khôi", followUpAt: "2026-10-20", followUpDoneAt: null, followUpDoneByName: null, id: "note-1", note: "Gọi lại sau giờ học." };

    const { matchesVietnamRender, text } = await renderInBothZones(
      () => import("@/features/crm/components/crm-case-notes-panel"),
      ({ CrmCaseNotesPanel }) => <CrmCaseNotesPanel canUpdate crmCaseId="case-1" notes={[note]} todayIso="2026-10-18" />,
    );

    expect(text).toContain("Hoàng Minh Khôi · 01:30 18/10/2026");
    expect(text).toContain("Hẹn 20/10/2026");
    expect(text).not.toContain("17/10/2026");
    expect(matchesVietnamRender).toBe(true);
  });

  it("a pending invitation shows when it was sent in Vietnam time", async () => {
    const invitation: SettingsAccountInvitation = { acceptedAt: null, email: "moi@example.com", id: "invitation-1", invitedAt: lateEvening, invitationReason: "Bổ sung nhân sự", revokedAt: null, roleIds: [], status: "pending" };

    const { matchesVietnamRender, text } = await renderInBothZones(
      () => import("@/features/settings/components/pending-invitation-card"),
      ({ PendingInvitationCard }) => <PendingInvitationCard invitation={invitation} rolesById={new Map()} />,
    );

    expect(text).toContain("Đã thêm 01:30 18/10/26");
    expect(text).not.toContain("17/10/26");
    expect(matchesVietnamRender).toBe(true);
  });

  it("the payment request list shows the Vietnam creation date", async () => {
    const item: PaymentRequestReadModel = { bonusSessions: 0, calculatedUnitPriceVnd: 140000, createdAt: lateEvening, expectedAmountVnd: 1_400_000, guardianFullName: "Nguyễn Thị Mai", guardianPhone: "0900000000", id: "request-1", notes: null, paidAmountVnd: 0, paidAt: null, publicCode: "YC-001", purchasedSessions: 10, status: "pending", studentFullName: "Nguyễn Minh An", studentId: "student-1", studentPublicCode: "HV001", topupType: "new", transferCode: "TTVC YC001" };

    const { matchesVietnamRender, text } = await renderInBothZones(
      () => import("@/features/finance/components/payment-request-table"),
      ({ PaymentRequestTable }) => <PaymentRequestTable items={[item]} />,
    );

    expect(text).toContain("Tạo ngày 18/10/2026");
    expect(text).not.toContain("17/10/2026");
    expect(matchesVietnamRender).toBe(true);
  });

  it("the class schedule import batch shows its creation and import times in Vietnam time", async () => {
    const detail: ClassScheduleImportBatchDetail = {
      batch: { academic_year_code: "2026-2027", academic_year_id: "year-1", class_conflict_count: 0, class_invalid_count: 0, class_matching_count: 0, class_new_count: 1, class_row_count: 1, committed_at: "2026-10-17T19:05:10Z", committed_by: "owner@example.com", created_at: lateEvening, created_by: "owner-1", id: "batch-1", metadata: {}, reason: "Import lớp 2A1", schedule_conflict_count: 0, schedule_invalid_count: 0, schedule_matching_count: 0, schedule_new_count: 2, schedule_row_count: 2, source_filename: "lop-2a1.xlsx", source_sha256: "abc123", status: "committed" },
      classRows: [],
      scheduleRows: [],
    };

    const { matchesVietnamRender, text } = await renderInBothZones(
      () => import("@/features/imports/classes/class-schedule-batch-detail-page"),
      ({ ClassScheduleBatchDetailPage }) => <ClassScheduleBatchDetailPage detail={detail} />,
    );

    expect(text).toContain("Thời gian tạo: 01:30:45 18/10/2026");
    expect(text).toContain("Thời gian import: 02:05:10 18/10/2026");
    expect(text).toContain("Thời gian ghi: 02:05:10 18/10/2026.");
    expect(text).not.toContain("17/10/2026");
    expect(matchesVietnamRender).toBe(true);
  });

  it("the SePay reconciliation dialog shows the transaction time in Vietnam time", async () => {
    const transaction: SepayTransactionReadModel = { accountNumber: "1001", accountPurpose: "new_enrollment", amountVnd: 1_000_000, bankBrand: "VCB", bankTransactionId: "api-transaction", createdAt: lateEvening, id: "91000000-0000-4000-8000-000000000001", ingestionSource: "api_v2", matchStatus: "unmatched", matchedAt: null, matchedPaymentRequestCode: null, matchedStudentFullName: null, referenceNumber: "REF-1", sepayV2Id: "92000000-0000-4000-8000-000000000001", transactionAt: lateEvening, transferContent: "TTV PAY DANG KY MOI", transferType: "in" };

    const { matchesVietnamRender, text } = await renderInBothZones(
      () => import("@/features/finance/components/sepay-reconciliation-dialog"),
      ({ SepayReconciliationDialog }) => <SepayReconciliationDialog candidates={[]} isOpen onClose={() => undefined} transaction={transaction} />,
    );

    expect(text).toContain("01:30 18/10/2026");
    expect(text).not.toContain("17/10/2026");
    expect(matchesVietnamRender).toBe(true);
  });

  it("the student import result shows the commit time in Vietnam time when the browser runs in UTC", async () => {
    const committed: StudentImportCommitResult = { batch_id: "batch-1", committed_at: lateEvening, committed_by: "owner-1", guardian_created_count: 1, guardian_reused_count: 0, row_count: 1, source_filename: "hoc-vien.xlsx", source_sha256: "abc123", student_count: 1, students: [{ guardian_id: "guardian-1", guardian_reused: false, row_number: 2, student_id: "student-1", student_public_code: "HV001" }] };
    commitStudentImportRowsAction.mockResolvedValueOnce({ data: committed, ok: true });
    const { StudentImportCommitPanel } = await loadIn("UTC", () => import("@/features/imports/students/student-import-commit-panel"));

    render(
      <StudentImportCommitPanel
        canCreateStudents
        rows={[{ row_number: 2, student_full_name: "Nguyễn Minh An" }]}
        sourceFilename="hoc-vien.xlsx"
        sourceSha256="abc123"
        validationResult={{ invalid_count: 0, row_count: 1, rows: [], valid_count: 1, warning_count: 0 }}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Lý do import/), { target: { value: "Import học viên tháng 10." } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận import 1 học viên" }));

    await waitFor(() => expect(screen.getByText("Thời điểm commit")).toBeInTheDocument());
    expect(screen.getByText("01:30:45 18 thg 10, 2026")).toBeInTheDocument();
    expect(screen.queryByText(/17 thg 10/)).not.toBeInTheDocument();
  });
});
