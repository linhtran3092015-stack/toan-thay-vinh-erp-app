import { PageHeader } from "@/components/patterns/page-header";
import { formatMonth } from "@/lib/datetime";

import type { CareDashboard, CareStudents } from "../models";
import type { StudentCareActionOverrides } from "../student-care-action-overrides";
import { CARE_PAGE_TITLE } from "../student-care-presentation";
import { countCareActiveFilters, type CareFilter, type CareTab } from "../student-care-url-state";
import { CareDialogAction } from "./care-dialog-action";
import { CareQueueFilters } from "./care-queue-filters";
import { CareFirstPageLink, CarePager, CareQueueTabs } from "./care-queue-nav";
import { CareStudentsTable } from "./care-students-table";
import { CareTableMessage, CareTaskTable } from "./care-task-table";
import { CARE_NOT_ALL_CLEAR, GeneratorStatusBar, getCareGeneratorState } from "./generator-status-bar";

export interface CareQueueViewProps {
  /** Inert stub in the /dev preview; the real page passes nothing. */
  actions?: StudentCareActionOverrides;
  canAssign: boolean;
  canConfigure: boolean;
  canHandle: boolean;
  /** `null` when the dashboard RPC failed: the frame shows the error, the header loses its figures. */
  data: CareDashboard | null;
  filter: CareFilter;
  /** Server time (ms) for "3 phút trước" and "Quá hạn 2 giờ", so server and client agree. */
  now: number;
  /** Students for the two assignment tabs; `null` on the tasks tab or when the read failed. */
  students: CareStudents | null;
  tab: CareTab;
}

const LOAD_ERROR_TITLE = "Chưa tải được chăm sóc học sinh";
const LOAD_ERROR_TEXT =
  "Không thể đọc dữ liệu chăm sóc. Kiểm tra kết nối và trạng thái cập nhật hệ thống; danh sách chưa được coi là trống.";

/**
 * /student-care (design 13a): header with the month's figures and the
 * generator settings dialog, the generator status strip, page tabs, filters
 * and the queue table. Tasks are generated automatically: there is no create
 * button and no page primary. Shared by the route and /dev/student-care.
 */
export function CareQueueView({ actions, canAssign, canConfigure, canHandle, data, filter, now, students, tab }: CareQueueViewProps) {
  const summary = data?.summary ?? null;
  const context = data && summary
    ? [
        `Tháng ${formatMonth(data.month)}`,
        `${summary.open_alerts} cảnh báo đang mở`,
        `${summary.unassigned} chưa giao`,
        `${summary.overdue} quá hạn`,
        `Coaching tháng ${summary.monthly_completed}/${summary.monthly_total} hoàn thành`,
      ].join(" · ")
    : null;
  const unhealthy = data ? getCareGeneratorState(data, now).unhealthy : true;
  const filtered = countCareActiveFilters(filter, tab) > 0;
  // A URL page past the last one (rows gone since the link was made): say so and lead back, not "nothing to do".
  const pastLastPage = (total: number, shown: number) => shown === 0 && total > 0;
  const pastLastPageMessage = (subject: string) => (
    <CareTableMessage title={`Trang này không còn ${subject}`}>
      Danh sách đã ngắn lại so với trang đang mở. <CareFirstPageLink />
    </CareTableMessage>
  );
  const loadError = (
    <CareTableMessage title={LOAD_ERROR_TITLE} tone="danger">
      {LOAD_ERROR_TEXT}
    </CareTableMessage>
  );

  return (
    <div className="student-care-queue grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <PageHeader
        actions={
          // mutateCare and the RPC check student_care.handle before configure.
          canConfigure && canHandle && data ? (
            <CareDialogAction
              action={actions?.mutateCare}
              base={{ enabled: !data.settings.enabled, op: "configure" }}
              description="Bật sau khi kiểm tra danh sách học sinh, phân công và lịch chạy tự động. Tạm dừng giữ nguyên lịch sử và cho phép xử lý công việc đang có."
              submitLabel={data.settings.enabled ? "Tạm dừng tự động" : "Bật chăm sóc tự động"}
              title="Cấu hình bộ tự sinh"
              triggerLabel="Cấu hình bộ tự sinh"
            >
              <p className="text-body text-text-strong">
                Hiện tại: bộ tự sinh <strong className="font-semibold">{data.settings.enabled ? "đang bật" : "đang tạm dừng"}</strong>.
              </p>
            </CareDialogAction>
          ) : undefined
        }
        title={CARE_PAGE_TITLE}
      >
        {context ? <p className="mt-1 text-secondary tabular-nums text-text-muted">{context}</p> : null}
      </PageHeader>

      {data ? <GeneratorStatusBar data={data} now={now} /> : null}

      <CareQueueTabs tab={tab} />

      <CareQueueFilters
        month={data?.month ?? ""}
        resultCount={tab === "tasks" ? data?.total : students?.total}
        summary={summary}
      />

      {tab === "tasks" ? (
        <CareTaskTable
          actions={actions}
          canHandle={canHandle}
          empty={
            data && pastLastPage(data.total, data.rows.length) ? (
              pastLastPageMessage("công việc")
            ) : (
              <CareTableMessage title={filtered ? "Không có công việc phù hợp bộ lọc" : "Chưa có công việc chăm sóc trong kỳ này"}>
                {unhealthy
                  ? CARE_NOT_ALL_CLEAR
                  : filtered
                    ? "Bỏ bớt bộ lọc để xem thêm công việc."
                    : "Bộ tự sinh tạo việc khi học sinh có dấu hiệu cần hỗ trợ và khi đến kỳ Coaching tháng."}
              </CareTableMessage>
            )
          }
          error={loadError}
          footer={data && data.total > 0 ? <CarePager itemLabel="task" page={filter.page} total={data.total} /> : undefined}
          now={now}
          rows={data?.rows ?? []}
          status={!data ? "error" : data.rows.length === 0 ? "empty" : "ready"}
        />
      ) : (
        <CareStudentsTable
          actions={actions}
          assignees={data?.assignees ?? []}
          canAssign={canAssign}
          canHandle={canHandle}
          empty={
            students && pastLastPage(students.total, students.rows.length) ? (
              pastLastPageMessage("học sinh")
            ) : (
              <CareTableMessage title={filtered ? "Không có học sinh phù hợp" : tab === "inactive" ? "Chưa có học sinh cần theo dõi riêng" : "Chưa có học sinh đang học"}>
                {filtered ? "Bỏ bớt bộ lọc để xem thêm học sinh." : null}
              </CareTableMessage>
            )
          }
          error={loadError}
          footer={students && students.total > 0 ? <CarePager itemLabel="học sinh" page={filter.page} total={students.total} /> : undefined}
          inactive={tab === "inactive"}
          rows={students?.rows ?? []}
          status={!data || !students ? "error" : students.rows.length === 0 ? "empty" : "ready"}
        />
      )}
    </div>
  );
}
