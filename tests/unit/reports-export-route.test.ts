// Value: protects=the untouched GET /reports/export/sessions contract the redesigned dialog relies on: 401/503 when permissions cannot be read, 403 unless BOTH reports.view and sessions.view, 400 for any query key but dateFrom/dateTo (a named submit button), a repeated key, a non-calendar date or an inverted range (before any read), and a 200 attachment read with limit SESSION_EXPORT_LIMIT (the number the page and dialog print) and count columns per attendance.view/results.view;
// fails_when=the route accepts extra keys or inverted ranges, reads before validating, drops the second permission, exports a count column the account cannot view, stops sending the no-store/nosniff/attachment headers, keeps a local limit literal, or exports anything but GET and dynamic;
// why_new=step 14d (R6/R8): the limit moved into catalog.ts and the route had no test; seam=getDatabasePermissions and getSessionDirectory are mocked (no database); route source text for the constant; no_claim=what the database returns, RLS, or that classes.view lets a non-owner read the class embed (rules map §0.11)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/(app)/reports/export/sessions/route";
import { SESSION_EXPORT_LIMIT } from "@/features/reports/catalog";
import type { SessionDirectoryItem } from "@/features/sessions/read-models";

const dependencies = vi.hoisted(() => ({
  getDatabasePermissions: vi.fn(),
  getSessionDirectory: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getDatabasePermissions: dependencies.getDatabasePermissions,
}));
vi.mock("@/features/sessions/data", () => ({
  getSessionDirectory: dependencies.getSessionDirectory,
}));

const EXPORT_URL = "http://localhost/reports/export/sessions";
/** Keeps the BOM: response.text() and a default TextDecoder strip it. */
const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
const exportPermissions = ["reports.view", "sessions.view"];

const row: SessionDirectoryItem = {
  attendanceCount: 18,
  classCode: "L-9A26",
  classId: "class-1",
  className: "Toán 9A tối 2-4-6",
  componentCode: null,
  endTime: "19:30:00",
  grade: 9,
  id: "session-1",
  learningMode: "offline",
  level: "A",
  lockedAt: null,
  resultCount: 15,
  roomName: "P.201",
  sessionDate: "2026-10-12",
  sessionKind: "regular",
  startTime: "18:00:00",
  status: "completed",
};

function allow(permissions: string[]) {
  dependencies.getDatabasePermissions.mockResolvedValue({ ok: true, permissions });
}

async function get(query = "") {
  return GET(new NextRequest(`${EXPORT_URL}${query}`));
}

async function expectJsonError(response: Response, status: number, error: string) {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /reports/export/sessions", () => {
  it("answers 401 when signed out and 503 when permissions cannot be read", async () => {
    dependencies.getDatabasePermissions.mockResolvedValue({ error: { code: "not_authenticated", message: "x" }, ok: false });
    await expectJsonError(await get(), 401, "Bạn cần đăng nhập để xuất báo cáo.");

    dependencies.getDatabasePermissions.mockResolvedValue({ error: { code: "query_failed", message: "x" }, ok: false });
    await expectJsonError(await get(), 503, "Không thể kiểm tra quyền xuất báo cáo.");
    expect(dependencies.getSessionDirectory).not.toHaveBeenCalled();
  });

  it.each([
    ["reports.view without sessions.view", ["reports.view", "attendance.view"]],
    ["sessions.view without reports.view", ["sessions.view"]],
  ])("answers 403 for %s", async (_label, permissions) => {
    allow(permissions);
    await expectJsonError(await get(), 403, "Tài khoản không có quyền xuất báo cáo này.");
    expect(dependencies.getSessionDirectory).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown key (a named submit button)", "?dateFrom=&dateTo=&submit="],
    ["a hidden extra field", "?dateFrom=2026-10-01&view=reports"],
    ["a repeated key", "?dateFrom=2026-10-01&dateFrom=2026-10-02"],
    ["a non-calendar date", "?dateTo=2026-02-30"],
    ["a non-date value", "?dateFrom=hôm-nay"],
    ["an inverted range", "?dateFrom=2026-10-10&dateTo=2026-10-01"],
  ])("answers 400 for %s without reading", async (_label, query) => {
    allow(exportPermissions);
    await expectJsonError(await get(query), 400, "Bộ lọc báo cáo không hợp lệ.");
    expect(dependencies.getSessionDirectory).not.toHaveBeenCalled();
  });

  it("reads with the shared SESSION_EXPORT_LIMIT and answers a no-store CSV attachment", async () => {
    allow(exportPermissions);
    dependencies.getSessionDirectory.mockResolvedValue({ ok: true, sessions: [row] });

    const response = await get("?dateFrom=2026-10-01&dateTo=2026-10-31");

    expect(SESSION_EXPORT_LIMIT).toBe(1000);
    expect(dependencies.getSessionDirectory).toHaveBeenCalledWith({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
      includeAttendanceCounts: false,
      includeResultCounts: false,
      limit: SESSION_EXPORT_LIMIT,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="bao-cao-buoi-hoc.csv"');
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const body = decoder.decode(await response.arrayBuffer());
    expect(body.startsWith("﻿Ngày,")).toBe(true);
    expect(body.split("\r\n")[0]).not.toContain("Số học viên");
    expect(body).toContain("12/10/2026,18:00,19:30,L-9A26");
  });

  it("treats empty dates (the blank form) as no bound", async () => {
    allow(exportPermissions);
    dependencies.getSessionDirectory.mockResolvedValue({ ok: true, sessions: [] });

    const response = await get("?dateFrom=&dateTo=");

    expect(response.status).toBe(200);
    expect(dependencies.getSessionDirectory).toHaveBeenCalledWith(expect.objectContaining({ dateFrom: null, dateTo: null }));
  });

  it("adds the count columns only for attendance.view / results.view", async () => {
    allow([...exportPermissions, "attendance.view", "results.view"]);
    dependencies.getSessionDirectory.mockResolvedValue({ ok: true, sessions: [row] });

    const body = decoder.decode(await (await get()).arrayBuffer());

    expect(dependencies.getSessionDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ includeAttendanceCounts: true, includeResultCounts: true, limit: SESSION_EXPORT_LIMIT }),
    );
    expect(body.split("\r\n")[0]).toContain(",Số học viên điểm danh,Số học viên có kết quả");
    expect(body.split("\r\n")[1].endsWith(",18,15")).toBe(true);
  });

  it("answers 500 when the session read fails", async () => {
    allow(exportPermissions);
    dependencies.getSessionDirectory.mockResolvedValue({ error: { code: "query_failed", message: "x" }, ok: false });
    await expectJsonError(await get(), 500, "Không thể đọc dữ liệu buổi học.");
  });
});

describe("export route source", () => {
  const source = readFileSync(join(process.cwd(), "src/app/(app)/reports/export/sessions/route.ts"), "utf8");

  it("reads with the catalog's SESSION_EXPORT_LIMIT, not a local literal", () => {
    expect(source).toContain('import { SESSION_EXPORT_LIMIT } from "@/features/reports/catalog";');
    expect(source).toContain("limit: SESSION_EXPORT_LIMIT,");
    expect(source).not.toMatch(/const SESSION_EXPORT_LIMIT\b/);
    expect(source).not.toMatch(/limit:\s*\d/);
  });

  it("exports only the GET handler and the dynamic segment config", () => {
    const exported = [...source.matchAll(/^export\s+(?:async\s+)?(?:const|function|let|var|class|type|interface)\s+(\w+)/gm)].map((match) => match[1]);
    expect(exported.sort()).toEqual(["GET", "dynamic"]);
    expect(source).not.toMatch(/^export\s*\{/m);
  });
});
