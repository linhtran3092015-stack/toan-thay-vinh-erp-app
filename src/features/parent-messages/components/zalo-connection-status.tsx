import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ZaloConnectionStatus } from "@/features/parent-messages/zalo-group-link-data";

type StepState = "ok" | "warn" | "todo" | "error" | "waiting";

const stateMeta: Record<StepState, { label: string; tone: "danger" | "neutral" | "success" | "warning" }> = {
  error: { label: "Lỗi", tone: "danger" },
  ok: { label: "Xong", tone: "success" },
  todo: { label: "Cần làm", tone: "warning" },
  warn: { label: "Chưa đủ", tone: "warning" },
  waiting: { label: "Chờ bước trên", tone: "neutral" },
};

interface Step {
  detail: ReactNode;
  state: StepState;
  title: string;
}

function buildSteps(status: ZaloConnectionStatus): Step[] {
  const crmReady = status.configured && !status.crmError;
  const account = status.centerAccount;
  const accountReady = crmReady && Boolean(status.centerAccountId) && account?.status === "connected";
  const linkedAll = status.studyingStudents > 0 && status.linkedStudents >= status.studyingStudents;

  return [
    {
      detail: status.configured
        ? "ZALOCRM_BASE_URL và ZALOCRM_API_KEY đã có trên máy chủ."
        : "Mở ZaloCRM → Cài đặt → API & Webhook, sao chép API Key (chỉ bấm Tạo key mới khi ô trống, vì key mới thay key cũ), rồi thêm ZALOCRM_BASE_URL và ZALOCRM_API_KEY vào Vercel → Environment Variables và Redeploy.",
      state: status.configured ? "ok" : "todo",
      title: "Khóa ZaloCRM trên máy chủ ERP",
    },
    {
      detail: !status.configured
        ? "Cần khóa ở bước 1."
        : status.crmError
          ? `ZaloCRM trả lỗi: ${status.crmError} Kiểm tra API key và máy chủ CRM.`
          : "ERP đọc được ZaloCRM bằng API key.",
      state: !status.configured ? "waiting" : status.crmError ? "error" : "ok",
      title: "Kết nối tới ZaloCRM",
    },
    {
      detail: !crmReady ? (
        "Cần kết nối ở bước 2."
      ) : !status.centerAccountId ? (
        <>
          Chọn nick trung tâm ở{" "}
          <Link className="font-semibold text-action-link hover:underline" href="/settings/general">Cài đặt → Chung</Link>{" "}
          (mục Tin nhắn phụ huynh), bấm Tải danh sách nick rồi Lưu.
        </>
      ) : !account ? (
        `Không thấy nick "${status.centerAccountName || status.centerAccountId}" trong ZaloCRM nữa. Chọn lại nick trong Cài đặt → Chung.`
      ) : account.status !== "connected" ? (
        `Nick ${account.displayName ?? account.phone ?? account.id} đang ở trạng thái "${account.status}". Mở ZaloCRM và đăng nhập lại nick (quét QR).`
      ) : (
        `Nick ${account.displayName ?? account.phone ?? account.id} đang kết nối.`
      ),
      state: !crmReady ? "waiting" : !status.centerAccountId ? "todo" : accountReady ? "ok" : "error",
      title: "Nick trung tâm gửi tin",
    },
    {
      detail: !accountReady
        ? "Cần nick trung tâm ở bước 3."
        : status.groupsError
          ? `Không tải được danh sách nhóm: ${status.groupsError}`
          : status.groupsTruncated
            ? `Nick trung tâm có ${status.groupsTotal ?? 0} nhóm Zalo; lần này chỉ đọc được ${status.groupsListed ?? 0} nhóm (ZaloCRM chậm hoặc quá nhiều nhóm). Học sinh có nhóm chưa đọc tới sẽ ở mục Không tìm thấy.`
            : `${status.groupsTotal ?? 0} nhóm Zalo trên nick trung tâm.`,
      state: !accountReady ? "waiting" : status.groupsError ? "error" : status.groupsTruncated ? "warn" : "ok",
      title: "Danh sách nhóm trên ZaloCRM",
    },
    {
      detail: `${status.linkedStudents}/${status.studyingStudents} học sinh đang học đã liên kết nhóm sổ liên lạc. Học sinh chưa liên kết thì không có tin vắng mặt và nhận xét cuối buổi.`,
      state: linkedAll ? "ok" : "todo",
      title: "Liên kết nhóm cho học sinh",
    },
  ];
}

const detailInk: Record<StepState, string> = {
  error: "text-danger",
  ok: "text-text-muted",
  todo: "text-text-default",
  warn: "text-text-default",
  waiting: "text-text-muted",
};

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="grid gap-3">
      {steps.map((step, index) => (
        <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5" key={step.title}>
          <span className="text-secondary font-semibold text-text-muted tabular-nums">{index + 1}.</span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-text-strong">
              {step.title}
              <Badge tone={stateMeta[step.state].tone}>{stateMeta[step.state].label}</Badge>
            </p>
            <p className={`mt-0.5 text-secondary ${detailInk[step.state]}`}>{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Five-step checklist that says whether the ERP ↔ ZaloCRM connection works
 * and what to do next. Once steps 1–4 are done it folds into one line (the
 * table below is the work), with the full list behind a disclosure.
 */
export function ZaloConnectionStatusCard({ status }: { status: ZaloConnectionStatus }) {
  const steps = buildSteps(status);
  const connected = steps.slice(0, 4).every((step) => step.state === "ok");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kết nối ZaloCRM</CardTitle>
      </CardHeader>
      <CardContent>
        {connected ? (
          <details>
            <summary className="cursor-pointer text-secondary text-text-default">
              <Badge tone="success">Đã kết nối</Badge>{" "}
              {status.centerAccount?.displayName || status.centerAccountName || "Nick trung tâm"} · {status.groupsTotal ?? 0} nhóm ·{" "}
              {status.linkedStudents}/{status.studyingStudents} học sinh đã liên kết
            </summary>
            <div className="mt-3">
              <StepList steps={steps} />
            </div>
          </details>
        ) : (
          <StepList steps={steps} />
        )}
      </CardContent>
    </Card>
  );
}
