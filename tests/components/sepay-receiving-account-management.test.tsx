import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SepayReceivingAccountManagement } from "@/features/finance/sepay-receiving-account-management";
import {
  createSepayReceivingAccountVersionAction,
  retireSepayReceivingAccountVersionAction,
  setSepayReceivingAccountApiIdentityAction,
} from "@/features/finance/sepay-receiving-account-actions";

vi.mock("@/features/finance/sepay-receiving-account-actions", () => ({
  createSepayReceivingAccountVersionAction: vi.fn(),
  retireSepayReceivingAccountVersionAction: vi.fn(),
  setSepayReceivingAccountApiIdentityAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SePay receiving-account catalog management", () => {
  it("creates a future public account version and retires the current version with reasons", async () => {
    vi.mocked(createSepayReceivingAccountVersionAction).mockResolvedValue({ message: "Đã tạo", ok: true });
    vi.mocked(retireSepayReceivingAccountVersionAction).mockResolvedValue({ message: "Đã kết thúc", ok: true });
    render(<SepayReceivingAccountManagement versions={[{ accountDisplayName: "Account A", accountNumber: "1900123456", bankCode: "VCB", effectiveFrom: "2026-08-01", effectiveTo: null, id: "account-a", purpose: "renewal", sepayBankAccountId: null }]} />);

    fireEvent.change(screen.getByLabelText("Ngân hàng"), { target: { value: "ACB" } });
    fireEvent.change(screen.getByLabelText("Số tài khoản nhận"), { target: { value: "999999" } });
    fireEvent.change(screen.getByLabelText("Tên hiển thị / chủ tài khoản"), { target: { value: "Account B" } });
    fireEvent.change(screen.getByLabelText("Hiệu lực từ"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getAllByLabelText("Lý do")[0], { target: { value: "Đổi tài khoản tái phí" } });
    fireEvent.change(screen.getByLabelText("Mục đích"), { target: { value: "renewal" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu phiên bản" }));
    await waitFor(() => expect(createSepayReceivingAccountVersionAction).toHaveBeenCalledWith({ accountDisplayName: "Account B", accountNumber: "999999", bankCode: "ACB", effectiveFrom: "2026-09-01", purpose: "renewal", reason: "Đổi tài khoản tái phí", sepayBankAccountId: "" }));

    fireEvent.change(screen.getByLabelText("Kết thúc hiệu lực 1900123456"), { target: { value: "2026-08-31" } });
    fireEvent.change(screen.getByLabelText("Lý do kết thúc 1900123456"), { target: { value: "Bàn giao Account B" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Kết thúc hiệu lực" })).not.toBeDisabled());
    fireEvent.submit(screen.getByRole("button", { name: "Kết thúc hiệu lực" }).closest("form")!);
    await waitFor(() => expect(retireSepayReceivingAccountVersionAction).toHaveBeenCalledWith("account-a", "2026-08-31", "Bàn giao Account B"));
  });

  it("lets the owner configure a missing SePay API account identity", async () => {
    vi.mocked(setSepayReceivingAccountApiIdentityAction).mockResolvedValue({ message: "Đã gắn ID", ok: true });
    render(<SepayReceivingAccountManagement versions={[{ accountDisplayName: "Account A", accountNumber: "1900123456", bankCode: "VCB", effectiveFrom: "2026-08-01", effectiveTo: null, id: "account-a", purpose: "renewal", sepayBankAccountId: null }]} />);

    fireEvent.change(screen.getByLabelText("ID SePay API 1900123456"), { target: { value: "91000000-0000-4000-8000-000000000001" } });
    fireEvent.change(screen.getByLabelText("Lý do thay đổi ID SePay 1900123456"), { target: { value: "Cho phép đồng bộ lịch sử" } });
    fireEvent.click(screen.getByRole("button", { name: "Gắn ID SePay API" }));

    await waitFor(() => expect(setSepayReceivingAccountApiIdentityAction).toHaveBeenCalledWith("account-a", "91000000-0000-4000-8000-000000000001", "Cho phép đồng bộ lịch sử"));
  });

  it("lets the owner replace a configured SePay API account identity with an audited reason", async () => {
    vi.mocked(setSepayReceivingAccountApiIdentityAction).mockResolvedValue({ message: "Đã thay đổi ID", ok: true });
    render(<SepayReceivingAccountManagement versions={[{ accountDisplayName: "Account A", accountNumber: "1900123456", bankCode: "VCB", effectiveFrom: "2026-08-01", effectiveTo: null, id: "account-a", purpose: "renewal", sepayBankAccountId: "91000000-0000-4000-8000-000000000001" }]} />);

    fireEvent.change(screen.getByLabelText("ID SePay API 1900123456"), { target: { value: "91000000-0000-4000-8000-000000000002" } });
    fireEvent.change(screen.getByLabelText("Lý do thay đổi ID SePay 1900123456"), { target: { value: "Đổi liên kết sau khi đối chiếu SePay" } });
    fireEvent.click(screen.getByRole("button", { name: "Thay đổi ID SePay API" }));

    await waitFor(() => expect(setSepayReceivingAccountApiIdentityAction).toHaveBeenCalledWith(
      "account-a",
      "91000000-0000-4000-8000-000000000002",
      "Đổi liên kết sau khi đối chiếu SePay",
    ));
  });
});
