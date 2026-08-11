import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CommissionListPage } from "@/features/commissions/commission-list-page";
import type { SalesCommissionAccrualDashboardEntry } from "@/features/commissions/read-models";

const accrual = (
  overrides: Partial<SalesCommissionAccrualDashboardEntry> = {},
): SalesCommissionAccrualDashboardEntry => ({
  id: "11111111-1111-4111-8111-111111111111",
  leadSourceCode: "MMA-REF",
  leadSourceGroup: "mma",
  leadSourceName: "MMA Referral",
  recognizedAt: "2026-08-11T08:00:00.000Z",
  recognizedRevenueVnd: 150_000,
  saleOwnerDisplayName: "Nguyễn Minh An",
  saleOwnerEmployeeCode: "NS-001",
  saleOwnerId: "22222222-2222-4222-8222-222222222222",
  sourceCashflowRecordId: "33333333-3333-4333-8333-333333333333",
  status: "provisional",
  studentFullName: "Trần Gia Hân",
  studentId: "44444444-4444-4444-8444-444444444444",
  studentPublicCode: "HV-001",
  ...overrides,
});

afterEach(() => {
  cleanup();
});

describe("Commission eligible-revenue presentation", () => {
  it("preserves reader order and presents known source groups, provisional status, and individual VND values", () => {
    const entries = [
      accrual({ id: "first", recognizedRevenueVnd: 150_000, studentFullName: "Học sinh thứ nhất" }),
      accrual({
        id: "second",
        leadSourceCode: "SANDBOX-REF",
        leadSourceGroup: "sandbox",
        leadSourceName: "Sandbox Referral",
        recognizedRevenueVnd: 275_000,
        studentFullName: "Học sinh thứ hai",
      }),
    ];

    render(<CommissionListPage canManage entries={entries} />);

    const table = screen.getByRole("table", { name: "Danh sách doanh thu đủ điều kiện hoa hồng" });
    const text = table.textContent ?? "";
    expect(text.indexOf("Học sinh thứ nhất")).toBeLessThan(text.indexOf("Học sinh thứ hai"));
    expect(screen.getAllByText("MMA")).not.toHaveLength(0);
    expect(screen.getAllByText("Sandbox")).not.toHaveLength(0);
    expect(screen.getAllByText("Chờ chính sách")).not.toHaveLength(0);
    expect(screen.getAllByText("150.000 VND")).not.toHaveLength(0);
    expect(screen.getAllByText("275.000 VND")).not.toHaveLength(0);
  });

  it("fails closed for prototype-property raw source and status values without mutation UI", () => {
    render(<CommissionListPage
      canManage
      entries={[accrual({
        leadSourceGroup: "constructor",
        leadSourceName: "Nguồn không xác định",
        status: "constructor",
      })]}
    />);

    expect(screen.getAllByText("Nguồn chưa hỗ trợ: constructor")).not.toHaveLength(0);
    expect(screen.getAllByText("Trạng thái chưa hỗ trợ: constructor")).not.toHaveLength(0);
    expect(screen.queryByText("MMA", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Sandbox", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Chờ chính sách")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses the approved 1120/1122 container contract with no client aggregate or commission engine", () => {
    render(<CommissionListPage canManage={false} entries={[accrual()]} />);

    expect(screen.getByRole("table", { name: "Danh sách doanh thu đủ điều kiện hoa hồng" }).closest(".commission-directory-work-area")).not.toBeNull();
    expect(screen.getByRole("list", { name: "Danh sách doanh thu đủ điều kiện hoa hồng" })).toBeInTheDocument();
    const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const source = readFileSync(resolve(process.cwd(), "src/features/commissions/commission-list-page.tsx"), "utf8");

    expect(globals).toMatch(/\.commission-directory-work-area\s*\{\s*container-type: inline-size/);
    expect(globals).toMatch(/@container \(min-width: 1122px\)[\s\S]*\.commission-directory-table/);
    expect(source).toContain('min-w-[1120px]');
    expect(source).not.toContain(".reduce(");
    expect(source).not.toContain(".filter(");
    expect(source).not.toContain(".sort(");
    expect(source).not.toContain("getPayroll");
    expect(source).not.toMatch(/lg:(block|hidden)/);
  });
});
