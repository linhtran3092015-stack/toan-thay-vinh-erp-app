// Value: protects=the ZaloCRM checklist marks each of its 5 steps done, to do, failed or waiting from the loader status, and says why a step failed;
// fails_when=a nick that is missing or not "connected" shows Xong, a CRM error is not shown, later steps stop waiting, or truncation / all-linked is misreported;
// why_new=ZaloConnectionStatusCard had no test, only the /dev/zalo-groups preview showed 4 of its states by eye;
// seam=none; no_claim=does not prove the loader fills the status correctly or that the Settings link target is right
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ZaloConnectionStatusCard } from "@/features/parent-messages/components/zalo-connection-status";
import type { ZaloConnectionStatus } from "@/features/parent-messages/zalo-group-link-data";

const connected = { displayName: "Nick Mau", id: "acc-center", phone: null, status: "connected", zaloUid: null };

const ready: ZaloConnectionStatus = {
  centerAccount: connected,
  centerAccountId: "acc-center",
  centerAccountName: "Nick Mau",
  configured: true,
  crmError: null,
  groupsError: null,
  groupsTotal: 120,
  groupsTruncated: false,
  linkedStudents: 7,
  studyingStudents: 10,
};

const DONE = "Xong";
const TODO = "Cần làm";
const ERROR = "Lỗi";
const WAIT = "Chờ bước trên";

function stepStates(): string[] {
  return screen.getAllByRole("listitem").map((item) => within(item).getByText(/^(Xong|Cần làm|Lỗi|Chờ bước trên)$/).textContent ?? "");
}

afterEach(cleanup);

describe("ZaloConnectionStatusCard", () => {
  it("marks each step from the connection status and explains the first one that fails", () => {
    const cases: { detail: string | RegExp; expected: string[]; name: string; status: ZaloConnectionStatus }[] = [
      {
        detail: /Vercel → Environment Variables/,
        expected: [TODO, WAIT, WAIT, WAIT, TODO],
        name: "not configured",
        status: { ...ready, centerAccount: null, configured: false, groupsTotal: null, linkedStudents: 0, studyingStudents: 0 },
      },
      {
        detail: "ZaloCRM trả lỗi: Invalid API key. Kiểm tra API key và máy chủ CRM.",
        expected: [DONE, ERROR, WAIT, WAIT, TODO],
        name: "CRM error",
        status: { ...ready, centerAccount: null, crmError: "Invalid API key.", groupsTotal: null },
      },
      {
        detail: /Chọn nick trung tâm ở/,
        expected: [DONE, DONE, TODO, WAIT, TODO],
        name: "no center nick",
        status: { ...ready, centerAccount: null, centerAccountId: "", centerAccountName: "", groupsTotal: null },
      },
      {
        detail: 'Không thấy nick "Nick Mau" trong ZaloCRM nữa. Chọn lại nick trong Cài đặt → Chung.',
        expected: [DONE, DONE, ERROR, WAIT, TODO],
        name: "nick gone from CRM",
        status: { ...ready, centerAccount: null, groupsTotal: null },
      },
      {
        detail: 'Nick Nick Mau đang ở trạng thái "disconnected". Mở ZaloCRM và đăng nhập lại nick (quét QR).',
        expected: [DONE, DONE, ERROR, WAIT, TODO],
        name: "nick not connected",
        status: { ...ready, centerAccount: { ...connected, status: "disconnected" } },
      },
      {
        detail: "Không tải được danh sách nhóm: timeout",
        expected: [DONE, DONE, DONE, ERROR, TODO],
        name: "groups error",
        status: { ...ready, groupsError: "timeout", groupsTotal: null },
      },
      {
        detail: "3000 nhóm Zalo trên nick trung tâm (chỉ đọc 3.000 nhóm đầu).",
        expected: [DONE, DONE, DONE, DONE, DONE],
        name: "ready, truncated, all linked",
        status: { ...ready, groupsTotal: 3000, groupsTruncated: true, linkedStudents: 10, studyingStudents: 10 },
      },
    ];

    for (const { detail, expected, name, status } of cases) {
      render(<ZaloConnectionStatusCard status={status} />);
      expect(stepStates(), name).toEqual(expected);
      expect(screen.getByText(detail), name).toBeInTheDocument();
      cleanup();
    }

    render(<ZaloConnectionStatusCard status={ready} />);
    expect(stepStates()).toEqual([DONE, DONE, DONE, DONE, TODO]);
    expect(screen.getByText("120 nhóm Zalo trên nick trung tâm.")).toBeInTheDocument();
    expect(screen.getByText(/^7\/10 học sinh đang học đã liên kết/)).toBeInTheDocument();
  });
});
