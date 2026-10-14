// Value: protects=the /dev/tuition preview is inert: its create, lock and rate/source save controls run the preview's stubs and never the real server actions (the preview runs on localhost where .env.local may point at production);
// fails_when=a previewed component falls back to createTuitionPeriodAction, lockTuitionPeriodAction, setTuitionPeriodRatesAction or setTuitionPeriodSourcesAction, or the preview stops passing its stubs;
// why_new=adversarial review found the preview could create a real tuition period and save real rates;
// seam=the actions module is mocked so any real call is observable; AppShell is replaced by its children (the shell is not under test); no_claim=does not prove the stubs cover controls added later or that /dev is unreachable in production (public-coaching-route-access covers the layout gate)
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { previewActions, TuitionPreview } from "@/app/dev/tuition/tuition-preview";
import {
  createTuitionPeriodAction,
  lockTuitionPeriodAction,
  setTuitionPeriodRatesAction,
  setTuitionPeriodSourcesAction,
} from "@/features/tuition/actions";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => "/dev/tuition", useRouter: () => router }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/features/tuition/actions", () => ({
  createTuitionPeriodAction: vi.fn(),
  lockTuitionPeriodAction: vi.fn(),
  publishTuitionTemplateAction: vi.fn(),
  reissueTuitionItemAction: vi.fn(),
  setTuitionPeriodRatesAction: vi.fn(),
  setTuitionPeriodSourcesAction: vi.fn(),
}));
vi.mock("@/features/tuition/tuition-template-browser", () => ({ downloadTuitionRateExcel: vi.fn(), downloadTuitionSourceExcel: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

/** Spies keep the stub behaviour and prove each previewed control actually ran its stub. */
function spyOnStubs() {
  return {
    create: vi.spyOn(previewActions, "create"),
    lock: vi.spyOn(previewActions, "lock"),
    setRates: vi.spyOn(previewActions, "setRates"),
    setSources: vi.spyOn(previewActions, "setSources"),
  };
}

const STUB = "Bản xem trước không ghi dữ liệu.";

function expectNoRealWrites() {
  expect(createTuitionPeriodAction).not.toHaveBeenCalled();
  expect(lockTuitionPeriodAction).not.toHaveBeenCalled();
  expect(setTuitionPeriodRatesAction).not.toHaveBeenCalled();
  expect(setTuitionPeriodSourcesAction).not.toHaveBeenCalled();
}

describe("/dev/tuition preview", () => {
  it("creates and locks from the list with stubs only", async () => {
    const stubs = spyOnStubs();
    render(<TuitionPreview role="owner" state="ready" view="list" />);

    fireEvent.click(screen.getByRole("button", { name: "Tạo kỳ thu" }));
    const dialog = screen.getByRole("dialog", { name: "Tạo kỳ thu học phí" });
    fireEvent.change(within(dialog).getByLabelText("Tên kỳ"), { target: { value: "Học phí tháng 12/2026" } });
    fireEvent.change(within(dialog).getByLabelText("Từ ngày"), { target: { value: "2026-12-01" } });
    fireEvent.change(within(dialog).getByLabelText("Đến ngày"), { target: { value: "2026-12-31" } });
    fireEvent.submit(within(dialog).getByRole("form", { name: "Tạo kỳ thu học phí" }));
    await waitFor(() => expect(within(dialog).getByText(STUB)).toBeInTheDocument());
    fireEvent.keyDown(dialog, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Khóa kỳ và tạo yêu cầu thanh toán" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Khóa kỳ thu · Học phí tháng 11/2026" })).toHaveTextContent(STUB));

    expect(stubs.create).toHaveBeenCalledTimes(1);
    expect(stubs.lock).toHaveBeenCalledWith("period-2611");
    expectNoRealWrites();
  });

  it("locks and saves rates and sources on the draft page with stubs only", async () => {
    const stubs = spyOnStubs();
    const { unmount } = render(<TuitionPreview role="owner" state="ready" view="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Khóa kỳ và tạo yêu cầu thanh toán" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(STUB));
    expect(router.replace).not.toHaveBeenCalled();
    unmount();

    render(<TuitionPreview role="owner" state="normal" view="draft" />);
    fireEvent.click(screen.getByRole("button", { name: /Chọn tất cả 1 học viên thiếu giá/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /Học phí mỗi buổi/ }), { target: { value: "200000" } });
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: Học phí khóa tháng 8-11"), { target: { value: "Bổ sung giá" } });
    fireEvent.click(screen.getByRole("button", { name: /Lưu đơn giá cho 1 học viên/ }));
    await waitFor(() => expect(screen.getAllByText(STUB).length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: /Chọn tất cả 1 học viên thiếu nguồn/ }));
    fireEvent.change(screen.getByRole("combobox", { name: /Nguồn tuyển sinh/ }), { target: { value: "source-direct" } });
    fireEvent.click(screen.getByRole("button", { name: /Lưu nguồn cho 1 học viên/ }));
    await waitFor(() => expect(stubs.setSources).toHaveBeenCalledTimes(1));

    expect(stubs.lock).toHaveBeenCalledTimes(1);
    expect(stubs.setRates).toHaveBeenCalledTimes(1);
    expectNoRealWrites();
  });
});
