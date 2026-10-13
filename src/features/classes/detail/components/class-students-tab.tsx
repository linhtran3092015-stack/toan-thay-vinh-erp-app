"use client";

import Link from "next/link";
import { useState } from "react";

import { ActionMenu } from "@/components/patterns/action-menu";
import { DataTableFrame, TableCell, TableHeaderCell, TableRow, TableState } from "@/components/patterns/data-table-frame";
import { QuickFilterChips } from "@/components/patterns/quick-filter-chips";
import { RecordListItem, ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import type { ClassDetailFeed } from "@/features/classes/detail/class-detail-models";
import {
  classStudentFilters,
  countClassStudentFilters,
  getClassEnrollmentStatusMeta,
  getClassStudentFilter,
  getEnrollmentChangeBlocker,
  type ClassEnrollmentRow,
  type ClassStudentDebt,
  type ClassStudentFilter,
} from "@/features/classes/detail/class-roster-models";
import { SessionBalanceBadge } from "@/features/students/components/session-balance-badge";
import { useStudentEnrollmentOperations } from "@/features/students/enrollment/student-enrollment-management";
import type {
  StudentEnrollmentActionAvailability,
  StudentEnrollmentClassOption,
  StudentEnrollmentUiModel,
} from "@/features/students/enrollment/student-enrollment-ui-types";
import type { StudentClassReadModel } from "@/features/students/read-models";
import { formatIsoDate } from "@/lib/datetime";
import { formatLearningMode, formatVnd } from "@/lib/format";

const filterLabels: Record<ClassStudentFilter, string> = {
  active: "Đang học",
  left: "Đã rời lớp",
  reserved: "Bảo lưu",
};

const emptyCopy: Record<ClassStudentFilter, string> = {
  active: "Lớp chưa có học sinh đang học.",
  left: "Chưa có học sinh nào rời lớp.",
  reserved: "Không có học sinh nào đang bảo lưu.",
};

type RowOperation = "transfer" | "reserve";

export interface ClassStudentsTabProps {
  balancesFeed: ClassDetailFeed<Record<string, number>>;
  /** students.reserve */
  canReserve: boolean;
  /** students.transfer_class */
  canTransfer: boolean;
  /** This class, as the enrolment dialog's "current class". */
  classInfo: StudentClassReadModel;
  debtsFeed: ClassDetailFeed<Record<string, ClassStudentDebt>>;
  rows: readonly ClassEnrollmentRow[];
  today: string;
  /** Transfer targets: `null` = the class list failed to load; `undefined` = not loaded (no permission). */
  transferClassOptions?: StudentEnrollmentClassOption[] | null;
}

/**
 * Students tab (design 03, step 5b part 2): the class's enrolments with the
 * date they joined, session balance, open debt and enrolment status, filtered by
 * chips (active by default, reserved, left). Active rows offer "Chuyển lớp" and
 * "Bảo lưu" through the same dialog as the student profile.
 */
export function ClassStudentsTab({
  balancesFeed,
  canReserve,
  canTransfer,
  classInfo,
  debtsFeed,
  rows,
  today,
  transferClassOptions,
}: ClassStudentsTabProps) {
  const counts = countClassStudentFilters(rows);
  const [filter, setFilter] = useState<ClassStudentFilter>(() => (counts.active > 0 || rows.length === 0 ? "active" : counts.reserved > 0 ? "reserved" : "left"));
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const filtered = rows.filter((row) => getClassStudentFilter(row.status, row.resumedElsewhere) === filter);

  const balances = balancesFeed.status === "ready" ? balancesFeed.value : null;
  const debts = debtsFeed.status === "ready" ? debtsFeed.value : null;
  // A column the viewer may not read is hidden (design 03: blocked content is hidden, not disabled).
  const showBalance = !(balancesFeed.status === "unavailable" && balancesFeed.reason === "forbidden");
  const showDebt = !(debtsFeed.status === "unavailable" && debtsFeed.reason === "forbidden");
  const showActions = (canTransfer || canReserve) && filter === "active";
  const failedColumns = [
    balancesFeed.status === "unavailable" && balancesFeed.reason === "failed" ? "số dư buổi" : null,
    debtsFeed.status === "unavailable" && debtsFeed.reason === "failed" ? "công nợ" : null,
  ].filter(Boolean);

  const actionContext: RowActionContext = { canReserve, canTransfer, classInfo, onSuccess: setSuccessMessage, today, transferClassOptions };

  return (
    // Container for the table/list switch in globals.css (.class-roster).
    <div className="class-roster grid min-w-0 gap-3">
      <QuickFilterChips
        chips={classStudentFilters.map((value) => ({ count: counts[value], label: filterLabels[value], value }))}
        label="Lọc học sinh theo trạng thái ghi danh"
        onChange={setFilter}
        value={filter}
      />

      {successMessage ? <ResultBanner title={successMessage} tone="success" /> : null}

      {failedColumns.length > 0 ? (
        <p className="text-secondary text-text-muted">Chưa tải được {failedColumns.join(" và ")}; tải lại trang để thử lại.</p>
      ) : null}
      {showBalance || showDebt ? (
        <p className="text-caption text-text-muted">
          {showBalance && showDebt ? "Số dư buổi và công nợ" : showBalance ? "Số dư buổi" : "Công nợ"} tính trên mọi lớp của học sinh.
        </p>
      ) : null}

      <div className="class-roster-table">
        <DataTableFrame
          body={filtered.map((row) => (
            <TableRow key={row.enrollmentId}>
              <TableCell className="w-28 whitespace-nowrap tabular-nums text-text-muted">{row.publicCode ?? "—"}</TableCell>
              <TableCell>
                <Link className="font-semibold text-text-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" href={`/students/${row.studentId}`}>
                  {row.fullName}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                <span className="block">{formatIsoDate(row.effectiveFrom)}</span>
                {row.effectiveTo ? <span className="block text-caption text-text-muted">đến {formatIsoDate(row.effectiveTo)}</span> : null}
              </TableCell>
              <TableCell>{formatLearningMode(row.registeredMode)}</TableCell>
              {showBalance ? (
                <TableCell numeric>
                  <BalanceValue balances={balances} studentId={row.studentId} />
                </TableCell>
              ) : null}
              {showDebt ? (
                <TableCell numeric>
                  <DebtValue debts={debts} studentId={row.studentId} />
                </TableCell>
              ) : null}
              <TableCell>
                <StatusBadge row={row} />
              </TableCell>
              {showActions ? (
                <TableCell className="w-16 text-right">
                  <EnrollmentRowActions context={actionContext} row={row} />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          caption="Học sinh của lớp"
          // The table fits from 864px (container switch), so the frame need not
          // scroll: a scroll container would clip the row "…" menus. Without the
          // frame's clipping, the header's corner cells round themselves.
          className="overflow-visible! [&_tbody_tr:last-child>td:first-child]:rounded-bl-lg [&_tbody_tr:last-child>td:last-child]:rounded-br-lg [&_thead_th:first-child]:rounded-tl-lg [&_thead_th:last-child]:rounded-tr-lg"
          empty={<TableState>{emptyCopy[filter]}</TableState>}
          header={
            <tr>
              <TableHeaderCell>Mã</TableHeaderCell>
              <TableHeaderCell>Học sinh</TableHeaderCell>
              <TableHeaderCell>Ngày vào lớp</TableHeaderCell>
              <TableHeaderCell>Hình thức</TableHeaderCell>
              {showBalance ? (
                <TableHeaderCell numeric title="Số buổi còn lại của học sinh, tính trên mọi lớp">
                  Số dư buổi
                </TableHeaderCell>
              ) : null}
              {showDebt ? (
                <TableHeaderCell numeric title="Yêu cầu thanh toán chưa thu đủ, tính trên mọi lớp">
                  Công nợ
                </TableHeaderCell>
              ) : null}
              <TableHeaderCell>Trạng thái</TableHeaderCell>
              {showActions ? <TableHeaderCell numeric>Thao tác</TableHeaderCell> : null}
            </tr>
          }
          status={filtered.length === 0 ? "empty" : "ready"}
          tableClassName="min-w-[860px]"
        />
      </div>

      <div className="class-roster-record-list gap-2">
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-border-subtle bg-surface-base px-4 py-6 text-center text-secondary text-text-muted">{emptyCopy[filter]}</p>
        ) : (
          <ResponsiveRecordList label="Học sinh của lớp">
            {filtered.map((row) => (
                <RecordListItem
                  ariaLabel={`Mở hồ sơ học sinh ${row.fullName}`}
                  badge={<StatusBadge row={row} />}
                  href={`/students/${row.studentId}`}
                  key={row.enrollmentId}
                  meta={[
                    row.publicCode,
                    `Vào lớp ${formatIsoDate(row.effectiveFrom)}`,
                    row.effectiveTo ? `đến ${formatIsoDate(row.effectiveTo)}` : null,
                    formatLearningMode(row.registeredMode),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  metrics={
                    showBalance || showDebt ? (
                      <>
                        {showBalance ? (
                          <span className="flex items-center gap-1">
                            Số dư <BalanceValue balances={balances} studentId={row.studentId} />
                          </span>
                        ) : null}
                        {showDebt ? (
                          <span>
                            Công nợ <DebtValue debts={debts} studentId={row.studentId} />
                          </span>
                        ) : null}
                      </>
                    ) : undefined
                  }
                  title={row.fullName}
                  trailing={showActions ? <EnrollmentRowActions context={actionContext} row={row} /> : undefined}
                />
            ))}
          </ResponsiveRecordList>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ row }: { row: ClassEnrollmentRow }) {
  const meta = getClassEnrollmentStatusMeta(row);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function BalanceValue({ balances, studentId }: { balances: Record<string, number> | null; studentId: string }) {
  if (!balances) return <span className="text-text-muted">—</span>;
  return <SessionBalanceBadge balance={balances[studentId] ?? 0} />;
}

function DebtValue({ debts, studentId }: { debts: Record<string, ClassStudentDebt> | null; studentId: string }) {
  if (!debts) return <span className="text-text-muted">—</span>;
  const debt = debts[studentId];
  if (!debt || debt.amountVnd <= 0) return <span className="text-text-muted">Không nợ</span>;

  return (
    <span className={debt.overdue ? "font-semibold text-danger" : "font-semibold text-text-strong"}>
      {formatVnd(debt.amountVnd)}
      {debt.overdue ? <span className="ml-1 text-caption font-normal">· quá hạn</span> : null}
    </span>
  );
}

interface RowActionContext {
  canReserve: boolean;
  canTransfer: boolean;
  classInfo: StudentClassReadModel;
  onSuccess: (message: string) => void;
  today: string;
  transferClassOptions?: StudentEnrollmentClassOption[] | null;
}

const hidden: StudentEnrollmentActionAvailability = { enabled: false, reason: null, visible: false };

/** The profile's enrolment model, built from one roster row of this class. */
function buildRosterEnrollmentModel(row: ClassEnrollmentRow, context: Omit<RowActionContext, "onSuccess">): StudentEnrollmentUiModel {
  const blocker = getEnrollmentChangeBlocker(row, context.today);
  const options = context.transferClassOptions ?? [];
  const transferReason =
    blocker ??
    (context.transferClassOptions === null
      ? "Không tải được danh sách lớp đang hoạt động."
      : options.length === 0
        ? "Không có lớp đang hoạt động khác để chuyển sang."
        : null);
  const enrollment = {
    classInfo: context.classInfo,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    endReason: row.endReason,
    id: row.enrollmentId,
    registeredMode: row.registeredMode,
    startReason: null,
    status: row.status,
    transitionKind: "",
  };

  return {
    actions: {
      end: hidden,
      enroll: hidden,
      reserve: context.canReserve ? { enabled: blocker === null, reason: blocker, visible: true } : hidden,
      resume: hidden,
      transfer: context.canTransfer ? { enabled: transferReason === null, reason: transferReason, visible: true } : hidden,
    },
    activeEnrollment: enrollment,
    businessDate: context.today,
    classOptions: options,
    classOptionsError: context.transferClassOptions === null ? "Không tải được danh sách lớp đang hoạt động." : null,
    defaultRegisteredMode: row.registeredMode,
    latestEnrollment: enrollment,
    transferClassOptions: options,
  };
}

function EnrollmentRowActions({ context, row }: { context: RowActionContext; row: ClassEnrollmentRow }) {
  const { onSuccess, ...modelContext } = context;
  const model = buildRosterEnrollmentModel(row, modelContext);
  const operations = useStudentEnrollmentOperations({ model, onSuccess, studentId: row.studentId, studentName: row.fullName });
  const items = (["transfer", "reserve"] as const)
    .filter((operation) => model.actions[operation].visible)
    .map((operation) => ({
      enabled: model.actions[operation].enabled,
      label: operation === "transfer" ? "Chuyển lớp" : "Bảo lưu",
      reason: model.actions[operation].reason,
      value: operation,
    }));
  if (items.length === 0) return null;

  return (
    <>
      <ActionMenu<RowOperation>
        align="end"
        items={items}
        label={`Thao tác ghi danh cho ${row.fullName}`}
        onSelect={(value, trigger) => operations.open(value, trigger)}
      />
      {operations.dialog}
    </>
  );
}
