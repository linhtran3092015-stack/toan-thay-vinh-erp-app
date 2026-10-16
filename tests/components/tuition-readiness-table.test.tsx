import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TuitionPreviewRow } from "@/features/tuition/data";
import { buildReadinessStudents } from "@/features/tuition/readiness-students";
import { downloadTuitionRateExcel, downloadTuitionSourceExcel } from "@/features/tuition/tuition-template-browser";
import { TuitionReadinessTable } from "@/features/tuition/tuition-readiness-table";

vi.mock("@/features/tuition/actions", () => ({
  setTuitionPeriodRatesAction: vi.fn().mockResolvedValue({ status: "success", message: "Đã lưu đơn giá thành công." }),
  setTuitionPeriodSourcesAction: vi.fn().mockResolvedValue({ status: "success", message: "Đã lưu nguồn thành công." }),
}));

vi.mock("@/features/tuition/tuition-template-browser", () => ({
  downloadTuitionRateExcel: vi.fn().mockResolvedValue(undefined),
  downloadTuitionSourceExcel: vi.fn().mockResolvedValue(undefined),
}));

afterEach(cleanup);

describe("TuitionReadinessTable", () => {
  const mockStudents = [
    {
      studentId: "s1",
      sessions: 10,
      missingRateFrom: "2026-08-22",
      issues: ["MISSING_EFFECTIVE_TUITION_RATE"],
    },
    {
      studentId: "s2",
      sessions: 8,
      missingRateFrom: null,
      issues: ["MISSING_ACQUISITION_SOURCE"],
    },
    {
      studentId: "s3",
      sessions: 12,
      missingRateFrom: null,
      issues: [],
    },
  ];

  const mockLabels = {
    s1: "Nguyễn Văn A (HV001)",
    s2: "Trần Thị B (HV002)",
    s3: "Lê Minh C (HV003)",
  };

  const mockStudentDetails = {
    s1: { id: "s1", fullName: "Nguyễn Văn A", publicCode: "HV001" },
    s2: { id: "s2", fullName: "Trần Thị B", publicCode: "HV002" },
    s3: { id: "s3", fullName: "Lê Minh C", publicCode: "HV003" },
  };

  const mockLeadSources = [
    { id: "ls1", code: "mma_fanpage", name: "MMA Fanpage" },
  ];

  it("renders students missing rate by default and allows toggling filters", () => {
    render(
      <TuitionReadinessTable
        canManageRates
        canManageSources
        labels={mockLabels}
        leadSources={mockLeadSources}
        periodId="period-123"
        studentDetails={mockStudentDetails}
        students={mockStudents}
      />
    );

    // Default filter is missing_rate (s1 has missing rate)
    expect(screen.getByText("Nguyễn Văn A (HV001)")).toBeInTheDocument();
    expect(screen.queryByText("Trần Thị B (HV002)")).not.toBeInTheDocument();

    // Click filter "Tất cả"
    fireEvent.click(screen.getByRole("button", { name: /Tất cả/ }));
    expect(screen.getByText("Nguyễn Văn A (HV001)")).toBeInTheDocument();
    expect(screen.getByText("Trần Thị B (HV002)")).toBeInTheDocument();
    expect(screen.getByText("Lê Minh C (HV003)")).toBeInTheDocument();
  });

  it("provides Excel template download buttons", () => {
    render(
      <TuitionReadinessTable
        canManageRates
        labels={mockLabels}
        periodId="period-123"
        students={mockStudents}
      />
    );

    expect(screen.getByRole("button", { name: /File mẫu đơn giá/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xuất 1 học viên thiếu giá/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /File mẫu nguồn/ })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: /Học phí mỗi buổi/ })).toHaveValue(null);
    // QuickFilterChips renders label + count, so the name is "Đủ dữ liệu1" (same chip, same count).
    expect(screen.getByRole("button", { name: /^Đủ dữ liệu\s*1$/ })).toBeInTheDocument();
  });

  it("supports select all missing rates and checkbox toggle", () => {
    render(
      <TuitionReadinessTable
        canManageRates
        labels={mockLabels}
        periodId="period-123"
        students={mockStudents}
      />
    );

    const selectAllBtn = screen.getByRole("button", { name: /Chọn tất cả 1 học viên thiếu giá/ });
    expect(selectAllBtn).toBeInTheDocument();

    fireEvent.click(selectAllBtn);
    expect(screen.getByRole("button", { name: /Lưu đơn giá cho 1 học viên/ })).toBeEnabled();

    // Clear selection: "Bỏ chọn" unmounts, so focus moves to the summary that stays.
    fireEvent.click(screen.getByRole("button", { name: /Bỏ chọn/ }));
    expect(screen.getByRole("button", { name: /Lưu đơn giá cho 0 học viên/ })).toBeDisabled();
    expect(screen.getByText("Chưa chọn học sinh nào")).toHaveFocus();
  });
});

// Design 15a: lock figures per student, KPI strip, chips, one selection for both bulk fixes.
describe("TuitionReadinessTable · design 15a", () => {
  const row = (studentId: string, overrides: Partial<TuitionPreviewRow> = {}): TuitionPreviewRow => ({
    acquisitionSourceId: "source",
    blockerCode: null,
    classId: "class-9a",
    classSessionId: `${studentId}-${overrides.sessionDate ?? "2026-11-02"}`,
    enrollmentId: `enrollment-${studentId}`,
    openingBalanceSessions: 0,
    sessionDate: "2026-11-02",
    sessionKind: "regular",
    studentId,
    unitPriceVnd: 200_000,
    ...overrides,
  });

  const rows: TuitionPreviewRow[] = [
    row("an"),
    row("an", { sessionDate: "2026-11-05" }),
    // Owes one session; two classes at two rates.
    row("binh", { openingBalanceSessions: -1 }),
    row("binh", { classId: "class-t9c", openingBalanceSessions: -1, sessionDate: "2026-11-03", unitPriceVnd: 250_000 }),
    // Covered by the balance.
    row("chi", { openingBalanceSessions: 5 }),
    row("chi", { openingBalanceSessions: 5, sessionDate: "2026-11-05" }),
    row("dung", { sessionDate: "2026-11-04", unitPriceVnd: null }),
    row("em", { acquisitionSourceId: null, classId: "class-unreadable" }),
    row("giang", { acquisitionSourceId: null, unitPriceVnd: null }),
    row("hoa", { blockerCode: "MISSING_PRIMARY_GUARDIAN" }),
  ];
  const names = { an: "An", binh: "Bình", chi: "Chi", dung: "Dũng", em: "Em", giang: "Giang", hoa: "Hoa" } as const;
  const ids = Object.keys(names) as (keyof typeof names)[];
  const labels = Object.fromEntries(ids.map((id, index) => [id, `${names[id]} (TTV-${index + 1})`]));
  const studentDetails = Object.fromEntries(ids.map((id, index) => [id, { fullName: names[id], id, publicCode: `TTV-${index + 1}` }]));
  const classNames = { "class-9a": "Toán 9A", "class-t9c": "Luyện thi T9C" };
  const studentsOf = (only?: string[]) => buildReadinessStudents(rows.filter((item) => !only || only.includes(item.studentId)));
  const table = () => screen.getByRole("table", { name: "Học sinh trong kỳ thu Học phí tháng 11/2026" });
  const rowOf = (label: string) => within(table()).getByText(label).closest("tr") as HTMLElement;

  function tableElement(props: Partial<Parameters<typeof TuitionReadinessTable>[0]> = {}) {
    return (
      <TuitionReadinessTable
        canManageRates
        canManageSources
        classNames={classNames}
        labels={labels}
        leadSources={[{ code: "mma_fanpage", id: "ls1", name: "MMA Fanpage" }]}
        periodId="period-123"
        periodName="Học phí tháng 11/2026"
        studentDetails={studentDetails}
        students={studentsOf()}
        {...props}
      />
    );
  }
  const renderTable = (props: Partial<Parameters<typeof TuitionReadinessTable>[0]> = {}) => render(tableElement(props));

  it("shows the lock context and the KPI strip: unknown first, then the upper bound, then requests at lock", () => {
    const { rerender } = renderTable({ lockContext: { renewalAccount: { accountNumber: "0399886886", bankCode: "MB" }, templateVersion: 3 } });

    expect(screen.getByText("Khi khóa: phiếu dùng mẫu v3 · tài khoản tái phí MB 0399886886")).toBeInTheDocument();
    const kpis = screen.getByLabelText("Chuẩn bị thu");
    expect(kpis).toHaveTextContent("Dự kiến phải thuChưa đủ dữ liệu2 học sinh chưa tính được (thiếu đơn giá)");
    expect(kpis).toHaveTextContent("Không cần thanh toán (đủ số dư)1 học sinh");
    expect(kpis).toHaveTextContent("Đủ dữ liệu3 / 7");
    expect(kpis).toHaveTextContent("Còn blocker4");
    expect(within(kpis).getByText("3 / 7")).toHaveClass("text-success-ink");
    expect(within(kpis).getByText("4")).toHaveClass("text-warning-ink");
    expect(screen.getByText("Ước tính lúc tải trang; khóa kỳ tính lại.")).toBeInTheDocument();

    rerender(<TuitionReadinessTable canManageRates={false} labels={labels} periodId="period-123" students={studentsOf(["an", "binh", "chi", "em", "hoa"])} />);
    expect(screen.queryByText(/^Khi khóa/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Chuẩn bị thu")).toHaveTextContent("Dự kiến phải thu1.450.000 ₫1 học sinh nợ buổi đầu kỳ tính tối đa");

    rerender(<TuitionReadinessTable canManageRates={false} labels={labels} periodId="period-123" students={studentsOf(["an", "chi", "em"])} />);
    expect(screen.getByLabelText("Chuẩn bị thu")).toHaveTextContent("Dự kiến phải thu600.000 ₫2 yêu cầu thanh toán khi khóa");
  });

  it("defaults to missing rates, then remaining blockers, then everyone; 'Tất cả' stays a single button", () => {
    const { unmount } = renderTable();
    const chips = screen.getByRole("group", { name: "Lọc học sinh theo dữ liệu kỳ thu" });
    expect(within(chips).getByRole("button", { name: /^Thiếu đơn giá\s*2$/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(table()).getAllByRole("row")).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: /Tất cả/ })).toHaveLength(1);

    fireEvent.click(within(chips).getByRole("button", { name: /^Còn blocker\s*4$/ }));
    expect(within(table()).getAllByRole("row")).toHaveLength(5);
    fireEvent.click(within(chips).getByRole("button", { name: /^Không cần thanh toán\s*1$/ }));
    expect(within(table()).getAllByRole("row")).toHaveLength(2);
    expect(within(rowOf("Chi (TTV-3)")).getByText("Không cần thanh toán · đủ số dư")).toBeInTheDocument();
    expect(within(rowOf("Chi (TTV-3)")).getByText(/^0\s*₫$/)).toHaveClass("text-text-muted");
    unmount();

    const second = renderTable({ students: studentsOf(["an", "em", "hoa"]) });
    expect(screen.getByRole("button", { name: /^Còn blocker\s*2$/ })).toHaveAttribute("aria-pressed", "true");
    second.unmount();

    renderTable({ students: studentsOf(["an", "chi"]) });
    expect(screen.getByRole("button", { name: /^Tất cả\s*2$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Còn blocker\s*0$/ })).toBeDisabled();
  });

  it("shows class, balance, rates, payable and blocker badges per student, blockers first", () => {
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: /^Tất cả\s*7$/ }));

    const bodyRows = within(table()).getAllByRole("row").slice(1);
    expect(bodyRows.map((item) => within(item).getByText(/\(TTV-\d\)$/).textContent)).toEqual([
      "Dũng (TTV-4)",
      "Em (TTV-5)",
      "Giang (TTV-6)",
      "Hoa (TTV-7)",
      "An (TTV-1)",
      "Bình (TTV-2)",
      "Chi (TTV-3)",
    ]);

    const binh = rowOf("Bình (TTV-2)");
    expect(within(binh).getByText("Toán 9A · Luyện thi T9C")).toBeInTheDocument();
    expect(within(binh).getByText("−1")).toHaveClass("font-semibold", "text-danger");
    expect(within(binh).getByText(/^200\.000 \/ 250\.000\s*₫$/)).toBeInTheDocument();
    expect(within(binh).getByText(/^650\.000\s*₫$/)).toBeInTheDocument();
    expect(within(binh).getByText("tối đa")).toBeInTheDocument();
    expect(within(binh).getByText("Đủ dữ liệu")).toBeInTheDocument();

    expect(within(rowOf("Em (TTV-5)")).getByText("—")).toBeInTheDocument();
    expect(within(rowOf("Em (TTV-5)")).getByText("Thiếu nguồn")).toBeInTheDocument();
    expect(within(rowOf("Dũng (TTV-4)")).getByText("Thiếu đơn giá từ 04/11")).toBeInTheDocument();
    expect(within(rowOf("Dũng (TTV-4)")).getByText("Chưa đủ dữ liệu")).toHaveClass("sr-only");
    expect(within(rowOf("Hoa (TTV-7)")).getByText("Chưa có phụ huynh chính")).toBeInTheDocument();

    const edit = within(table()).getByRole("link", { name: "Sửa hồ sơ Hoa (TTV-7) (tab mới)" });
    expect(edit).toHaveAttribute("href", "/students/hoa/edit");
    expect(edit).toHaveAttribute("target", "_blank");
    expect(within(table()).getByRole("link", { name: "Mở hồ sơ An (TTV-1) (tab mới)" })).toHaveAttribute("href", "/students/an");
    expect(table().parentElement).toHaveTextContent("7 trong 7 học sinh · sắp xếp blocker trước");
    expect(screen.getByText("Thiếu phụ huynh chính chỉ hiện sau khi học sinh đã có đơn giá và nguồn.")).toBeInTheDocument();
  });

  it("drives both bulk fixes from one selection and sends each action only its eligible ids", async () => {
    const setRatesAction = vi.fn().mockResolvedValue({ message: "Đã lưu đơn giá.", status: "success" });
    const setSourcesAction = vi.fn().mockResolvedValue({ message: "Đã gán nguồn.", status: "success" });
    const { rerender } = renderTable({ setRatesAction, setSourcesAction });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Tất cả\s*7$/ }));

    // Only students with a fixable blocker get a checkbox (the guardian is fixed on the profile).
    expect(within(table()).queryByRole("checkbox", { name: "Chọn Hoa (TTV-7)" })).not.toBeInTheDocument();
    expect(within(table()).queryByRole("checkbox", { name: "Chọn An (TTV-1)" })).not.toBeInTheDocument();
    fireEvent.click(within(table()).getByRole("checkbox", { name: "Chọn tất cả học sinh đang hiển thị có thể bổ sung" }));
    expect(screen.getByText(/^Đã chọn 3 học sinh/)).toHaveTextContent("Đã chọn 3 học sinh · 2 thiếu đơn giá · 2 thiếu nguồn");
    expect(rowOf("Dũng (TTV-4)")).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("button", { name: /Bỏ chọn/ })).toHaveLength(1);

    fireEvent.change(screen.getByRole("spinbutton", { name: /Học phí mỗi buổi/ }), { target: { value: "220000" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Căn cứ áp dụng" }), { target: { value: "Bổ sung giá kỳ 11" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu đơn giá cho 2 học viên" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã lưu đơn giá."));
    expect(setRatesAction).toHaveBeenCalledWith({ periodId: "period-123", reason: "Bổ sung giá kỳ 11", studentIds: ["dung", "giang"], unitPriceVnd: 220_000 });
    // Dũng (rate only) leaves the selection; Giang also lacks a source and stays with Em for the source fix; the rate inputs reset.
    expect(within(table()).getByRole("checkbox", { name: "Chọn Dũng (TTV-4)" })).not.toBeChecked();
    expect(within(table()).getByRole("checkbox", { name: "Chọn Giang (TTV-6)" })).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: /Học phí mỗi buổi/ })).toHaveValue(null);

    // The refresh the save triggers (revalidatePath) brings Dũng and Giang priced: the rate fix leaves, Em and Giang stay selected.
    const priced = rows.map((item) => (item.unitPriceVnd === null ? { ...item, unitPriceVnd: 220_000 } : item));
    rerender(tableElement({ setRatesAction, setSourcesAction, students: buildReadinessStudents(priced) }));
    expect(screen.getByText(/^Đã chọn 2 học sinh/)).toHaveTextContent(/^Đã chọn 2 học sinh · 2 thiếu nguồn$/);

    fireEvent.change(screen.getByRole("combobox", { name: /Nguồn tuyển sinh/ }), { target: { value: "ls1" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu nguồn cho 2 học viên" }));
    await waitFor(() => expect(setSourcesAction).toHaveBeenCalledTimes(1));
    expect(setSourcesAction).toHaveBeenCalledWith({ leadSourceId: "ls1", periodId: "period-123", reason: "Khởi tạo dữ liệu ban đầu kỳ thu", studentIds: ["em", "giang"] });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã gán nguồn."));
    expect(screen.getByText("Chưa chọn học sinh nào")).toBeInTheDocument();
  });

  // Value: protects=a student missing both a rate and a source stays selected after the first bulk save so the second fix still includes her (source first here, rate first above),
  // and a save drops her once the other fix is no longer offered;
  // fails_when=a successful save drops every id it sent, or keeps ids the other fix cannot take (source-only students, or no source fix left);
  // why_new=ship review cycle 2: the rate save deselected students still missing a source;
  // seam=rerender with the saved field filled (what the revalidatePath refresh delivers); no_claim=does not prove the refresh itself or the RPCs
  it("keeps a student missing both a rate and a source selected for the other fix", async () => {
    const setRatesAction = vi.fn().mockResolvedValue({ message: "Đã lưu đơn giá.", status: "success" });
    const setSourcesAction = vi.fn().mockResolvedValue({ message: "Đã gán nguồn.", status: "success" });
    const { rerender } = renderTable({ setRatesAction, setSourcesAction });
    fireEvent.click(screen.getByRole("button", { name: /^Tất cả\s*7$/ }));
    fireEvent.click(within(table()).getByRole("checkbox", { name: "Chọn Em (TTV-5)" }));
    fireEvent.click(within(table()).getByRole("checkbox", { name: "Chọn Giang (TTV-6)" }));
    expect(screen.getByText(/^Đã chọn 2 học sinh/)).toHaveTextContent("Đã chọn 2 học sinh · 1 thiếu đơn giá · 2 thiếu nguồn");

    fireEvent.change(screen.getByRole("combobox", { name: /Nguồn tuyển sinh/ }), { target: { value: "ls1" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu nguồn cho 2 học viên" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã gán nguồn."));
    expect(setSourcesAction).toHaveBeenCalledWith({ leadSourceId: "ls1", periodId: "period-123", reason: "Khởi tạo dữ liệu ban đầu kỳ thu", studentIds: ["em", "giang"] });
    // Em (source only) leaves; Giang still lacks a rate and stays.
    expect(within(table()).getByRole("checkbox", { name: "Chọn Em (TTV-5)" })).not.toBeChecked();
    expect(within(table()).getByRole("checkbox", { name: "Chọn Giang (TTV-6)" })).toBeChecked();

    // Refresh: Em and Giang have a source now, so the source fix leaves and Giang is selected for her rate only.
    const sourced = rows.map((item) => (item.acquisitionSourceId === null ? { ...item, acquisitionSourceId: "ls1" } : item));
    rerender(tableElement({ setRatesAction, setSourcesAction, students: buildReadinessStudents(sourced) }));
    expect(screen.queryByRole("combobox", { name: /Nguồn tuyển sinh/ })).not.toBeInTheDocument();
    expect(screen.getByText(/^Đã chọn 1 học sinh/)).toHaveTextContent(/^Đã chọn 1 học sinh · 1 thiếu đơn giá$/);

    fireEvent.change(screen.getByRole("spinbutton", { name: /Học phí mỗi buổi/ }), { target: { value: "220000" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Căn cứ áp dụng" }), { target: { value: "Bổ sung giá kỳ 11" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu đơn giá cho 1 học viên" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Đã lưu đơn giá."));
    expect(setRatesAction).toHaveBeenCalledWith({ periodId: "period-123", reason: "Bổ sung giá kỳ 11", studentIds: ["giang"], unitPriceVnd: 220_000 });
    // No source fix is offered any more: the saved student leaves even before the refresh prices her.
    expect(screen.getByText("Chưa chọn học sinh nào")).toBeInTheDocument();
  });

  it("keeps the inputs and alerts on a refused or failed save", async () => {
    const setRatesAction = vi
      .fn()
      .mockResolvedValueOnce({ message: "Danh sách học viên đã thay đổi; tải lại trang.", status: "error" })
      .mockRejectedValueOnce(new Error("network"));
    renderTable({ setRatesAction });

    fireEvent.click(screen.getByRole("button", { name: /Chọn tất cả 2 học viên thiếu giá/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /Học phí mỗi buổi/ }), { target: { value: "220000" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Căn cứ áp dụng" }), { target: { value: "Bổ sung giá" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu đơn giá cho 2 học viên" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Danh sách học viên đã thay đổi; tải lại trang."));
    expect(screen.getByRole("spinbutton", { name: /Học phí mỗi buổi/ })).toHaveValue(220_000);

    fireEvent.click(screen.getByRole("button", { name: "Lưu đơn giá cho 2 học viên" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không thể kết nối. Chưa xác nhận lưu đơn giá; vui lòng tải lại để kiểm tra."));
    expect(screen.getByText(/^Đã chọn 2 học sinh/)).toBeInTheDocument();
  });

  it("says the preview failed inside the table frame instead of showing an empty period", () => {
    renderTable({ previewUnavailable: true, students: [] });

    expect(table().parentElement).toHaveTextContent("Chưa tải được xem trước kỳ thu. Bấm “Tải lại xem trước” để thử lại.");
    expect(screen.queryByLabelText("Chuẩn bị thu")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Lọc học sinh theo dữ liệu kỳ thu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Bổ sung đơn giá/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /File mẫu đơn giá/ })).toBeInTheDocument();
  });

  it("offers no selection or bulk fix without the fix permissions", () => {
    renderTable({ canManageRates: false, canManageSources: false });

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: /^Bổ sung/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Bỏ chọn/ })).not.toBeInTheDocument();
  });

  // Value: protects=finding a student by name or code (any case, with diacritics) and "Xóa lọc" in the no-match state resetting both the chip and the search;
  // fails_when=the search stops narrowing or turns case-sensitive, a no-match search paints stale rows, or "Xóa lọc" resets only the chip or only the search;
  // why_new=no test typed in the readiness search or pressed its in-frame "Xóa lọc" (added by step 13);
  // seam=none; no_claim=does not prove the card list layout below 960px or search by guardian/phone (not supported)
  it("narrows by name or code and clears both the chip and the search from the no-match state", () => {
    renderTable();
    const search = screen.getByRole("searchbox", { name: "Tìm học sinh" });

    // Default chip "Thiếu đơn giá": Dũng and Giang.
    fireEvent.change(search, { target: { value: "GIANG" } });
    expect(within(table()).getAllByRole("row").slice(1).map((item) => within(item).getByText(/\(TTV-\d\)$/).textContent)).toEqual(["Giang (TTV-6)"]);

    // Em lacks a source, not a rate: nothing matches on this chip.
    fireEvent.change(search, { target: { value: "ttv-5" } });
    const frame = table().parentElement as HTMLElement;
    expect(within(table()).getAllByRole("row")).toHaveLength(1);
    expect(frame).toHaveTextContent("Không tìm thấy học viên phù hợp với bộ lọc hiện tại.");
    expect(frame).not.toHaveTextContent("sắp xếp blocker trước");

    fireEvent.click(within(frame).getByRole("button", { name: "Xóa lọc" }));
    expect(screen.getByRole("button", { name: /^Tất cả\s*7$/ })).toHaveAttribute("aria-pressed", "true");
    expect(search).toHaveValue("");
    expect(within(table()).getAllByRole("row")).toHaveLength(8);

    fireEvent.change(search, { target: { value: "DŨNG" } });
    expect(within(table()).getAllByRole("row").slice(1).map((item) => within(item).getByText(/\(TTV-\d\)$/).textContent)).toEqual(["Dũng (TTV-4)"]);
  });

  // Value: protects=the pre-filled Excel files list every student still missing a rate (code, name, first unpriced date) or a source, whatever chip or search is active;
  // fails_when=the export follows the visible rows, drops effectiveFrom or the public code, or the source file loses the missing-source rows or the lead sources;
  // why_new=step 13 moved the Excel tools into the toolbar; tests only checked the buttons exist;
  // seam=none; no_claim=does not prove the .xlsx layout (tuition-template-browser test) or the import script
  it("exports every student missing a rate or a source, not just the visible rows", async () => {
    vi.mocked(downloadTuitionRateExcel).mockClear();
    vi.mocked(downloadTuitionSourceExcel).mockClear();
    renderTable();
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm học sinh" }), { target: { value: "giang" } });

    fireEvent.click(screen.getByRole("button", { name: "Xuất 2 học viên thiếu giá (.xlsx)" }));
    expect(downloadTuitionRateExcel).toHaveBeenCalledWith([
      { effectiveFrom: "2026-11-04", fullName: "Dũng", publicCode: "TTV-4", reason: "Học phí khóa hiện tại" },
      { effectiveFrom: "2026-11-02", fullName: "Giang", publicCode: "TTV-6", reason: "Học phí khóa hiện tại" },
    ]);
    await waitFor(() => expect(screen.getByRole("button", { name: "File mẫu nguồn (.xlsx)" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "File mẫu nguồn (.xlsx)" }));
    expect(downloadTuitionSourceExcel).toHaveBeenCalledWith(
      [{ code: "mma_fanpage", id: "ls1", name: "MMA Fanpage" }],
      [
        { fullName: "Em", publicCode: "TTV-5", reason: "Khởi tạo dữ liệu ban đầu" },
        { fullName: "Giang", publicCode: "TTV-6", reason: "Khởi tạo dữ liệu ban đầu" },
      ],
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "File mẫu đơn giá (.xlsx)" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "File mẫu đơn giá (.xlsx)" }));
    expect(downloadTuitionRateExcel).toHaveBeenLastCalledWith();
  });

  // Value: protects=below 960px the students render as cards in table order with profile/edit link, class·sessions·balance, rates/payable and the shared selection;
  // fails_when=a card checkbox keeps its own selection or shows with nothing to fix, the guardian-only card links to the profile, or the balance/upper bound drops;
  // why_new=step 13 added the ResponsiveRecordList cards; existing tests only read the table;
  // seam=none (jsdom renders both layouts; the 960px container query is CSS); no_claim=does not prove which layout a real viewport shows or the 44px hit area
  it("mirrors the table as cards for narrow screens, sharing the one selection", () => {
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: /^Tất cả\s*7$/ }));

    const cards = screen.getByRole("list", { name: "Học sinh trong kỳ thu Học phí tháng 11/2026" });
    const items = within(cards).getAllByRole("listitem");
    expect(items.map((item) => within(item).getByRole("link").getAttribute("aria-label"))).toEqual([
      "Mở hồ sơ Dũng (TTV-4)",
      "Mở hồ sơ Em (TTV-5)",
      "Mở hồ sơ Giang (TTV-6)",
      "Sửa hồ sơ Hoa (TTV-7)",
      "Mở hồ sơ An (TTV-1)",
      "Mở hồ sơ Bình (TTV-2)",
      "Mở hồ sơ Chi (TTV-3)",
    ]);
    expect(within(cards).getByRole("link", { name: "Sửa hồ sơ Hoa (TTV-7)" })).toHaveAttribute("href", "/students/hoa/edit");

    const binh = items[5];
    expect(binh).toHaveTextContent("Bình TTV-2");
    expect(binh).toHaveTextContent("Toán 9A · Luyện thi T9C · 2 buổi · số dư −1");
    expect(binh).toHaveTextContent("Đơn giá 200.000 / 250.000 ₫");
    expect(binh).toHaveTextContent("Phải thu 650.000 ₫ tối đa");
    // Em's class name is unreadable: the card leaves the class part out (the table cell keeps "—").
    expect(within(items[1]).getByText("1 buổi · số dư 0")).toBeInTheDocument();
    expect(items[1]).not.toHaveTextContent("—");

    expect(within(cards).queryByRole("checkbox", { name: "Chọn An (TTV-1)" })).not.toBeInTheDocument();
    expect(within(cards).queryByRole("checkbox", { name: "Chọn Hoa (TTV-7)" })).not.toBeInTheDocument();
    fireEvent.click(within(cards).getByRole("checkbox", { name: "Chọn Dũng (TTV-4)" }));
    expect(rowOf("Dũng (TTV-4)")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/^Đã chọn 1 học sinh/)).toHaveTextContent("Đã chọn 1 học sinh · 1 thiếu đơn giá · 0 thiếu nguồn");

    fireEvent.click(within(table()).getByRole("checkbox", { name: "Chọn Em (TTV-5)" }));
    expect(within(cards).getByRole("checkbox", { name: "Chọn Em (TTV-5)" })).toBeChecked();
  });

  // Value: protects=a blocker code the table has no dedicated badge for still shows (label or raw code, neutral) and the student never reads "Đủ dữ liệu";
  // fails_when=the ready badge follows the number of rendered badges instead of the issues, or unknown codes are dropped;
  // why_new=review cycle 1 keyed the ready badge on student.issues; no test used a code outside the three known ones;
  // seam=none; no_claim=does not prove which codes the RPC can return
  it("shows an unknown blocker code as a neutral badge and never as ready", () => {
    renderTable({
      students: [
        ...studentsOf(["an"]),
        { issues: ["STUDENT_ARCHIVED"], missingRateFrom: null, sessions: 1, studentId: "hoa" },
        // A rate issue without its first date still counts as a blocker.
        { issues: ["MISSING_EFFECTIVE_TUITION_RATE"], missingRateFrom: null, sessions: 1, studentId: "chi" },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /^Tất cả\s*3$/ }));

    const hoa = rowOf("Hoa (TTV-7)");
    expect(within(hoa).getByText("STUDENT_ARCHIVED")).toHaveClass("bg-neutral-bg");
    expect(within(hoa).queryByText("Đủ dữ liệu")).not.toBeInTheDocument();
    expect(within(rowOf("Chi (TTV-3)")).getByText("Thiếu đơn giá")).toBeInTheDocument();
    expect(within(rowOf("Chi (TTV-3)")).queryByText("Đủ dữ liệu")).not.toBeInTheDocument();
    expect(within(rowOf("An (TTV-1)")).getByText("Đủ dữ liệu")).toBeInTheDocument();
  });

  // Value: protects=after a refresh empties the active chip (a bulk save fixed its last student) the list falls back to "Còn blocker", then to "Tất cả";
  // fails_when=the pressed chip stays on a disabled zero chip and the table shows the no-match state with nothing to clear;
  // why_new=review cycle 1 added the fallback; the default chip was only tested on first render;
  // seam=rerender with fixed students (what router.refresh delivers); no_claim=does not prove the refresh itself
  it("falls back to the remaining blockers, then everyone, when a refresh empties the active chip", () => {
    const { rerender } = renderTable();
    expect(screen.getByRole("button", { name: /^Thiếu đơn giá\s*2$/ })).toHaveAttribute("aria-pressed", "true");

    const priced = rows.map((item) => ({ ...item, unitPriceVnd: item.unitPriceVnd ?? 200_000 }));
    rerender(tableElement({ students: buildReadinessStudents(priced) }));
    expect(screen.getByRole("button", { name: /^Thiếu đơn giá\s*0$/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Còn blocker\s*3$/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(table()).getAllByRole("row")).toHaveLength(4);

    const ready = priced.map((item) => ({ ...item, acquisitionSourceId: "source", blockerCode: null }));
    rerender(tableElement({ students: buildReadinessStudents(ready) }));
    expect(screen.getByRole("button", { name: /^Tất cả\s*7$/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(table()).getAllByRole("row")).toHaveLength(8);
  });

  // Value: protects=the header checkbox (indeterminate after one row, selects every visible eligible row, clears on the next click), the summary as the save buttons' and checkbox's description, and no source fix without an active source;
  // fails_when=indeterminate is never set, a second header click does not clear, the summary counts the wrong group, the disabled reason is not linked, or a source-only student gets a checkbox with no source to pick;
  // why_new=review cycle 1: the header checkbox, aria-describedby and the empty leadSources case had no test;
  // seam=none; no_claim=does not prove how a screen reader announces the description
  it("selects with the header checkbox and links the summary as the disabled reason; no source fix without an active source", () => {
    renderTable({ leadSources: [] });
    expect(screen.queryByRole("heading", { name: /^Bổ sung nguồn/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Nguồn tuyển sinh/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Tất cả\s*7$/ }));
    // Em only lacks a source: nothing to fix for her without a source to pick.
    expect(within(table()).queryByRole("checkbox", { name: "Chọn Em (TTV-5)" })).not.toBeInTheDocument();

    const header = within(table()).getByRole("checkbox", { name: "Chọn tất cả học sinh đang hiển thị có thể bổ sung" }) as HTMLInputElement;
    const save = screen.getByRole("button", { name: "Lưu đơn giá cho 0 học viên" });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription("Chưa chọn học sinh nào");
    expect(header).toHaveAccessibleDescription("Chưa chọn học sinh nào");

    fireEvent.click(within(table()).getByRole("checkbox", { name: "Chọn Dũng (TTV-4)" }));
    expect(header.indeterminate).toBe(true);
    expect(header).not.toBeChecked();

    fireEvent.click(header);
    expect(header).toBeChecked();
    expect(header.indeterminate).toBe(false);
    expect(screen.getByText(/^Đã chọn 2 học sinh/)).toHaveTextContent(/^Đã chọn 2 học sinh · 2 thiếu đơn giá$/);
    expect(screen.getByRole("button", { name: "Lưu đơn giá cho 2 học viên" })).toHaveAccessibleDescription(/^Đã chọn 2 học sinh\s*· 2 thiếu đơn giá$/);

    fireEvent.click(header);
    expect(header).not.toBeChecked();
    expect(screen.getByText("Chưa chọn học sinh nào")).toBeInTheDocument();
  });

  // Value: protects=keyboard focus survives the controls that remove themselves: "Xóa lọc" hands focus to the search box, a settled save to its result banner;
  // fails_when=focus falls back to the body when the empty state or the disabled submit button goes away, or the banner loses its alert/status role;
  // why_new=review cycle 1 added the focus moves; seam=none; no_claim=does not prove the browser's focus ring or screen reader output
  it("moves focus to the search after 'Xóa lọc' and to the result after a save", async () => {
    const setRatesAction = vi.fn().mockResolvedValue({ message: "Đã lưu đơn giá.", status: "success" });
    renderTable({ setRatesAction });
    const search = screen.getByRole("searchbox", { name: "Tìm học sinh" });

    fireEvent.change(search, { target: { value: "ttv-5" } });
    fireEvent.click(within(table().parentElement as HTMLElement).getByRole("button", { name: "Xóa lọc" }));
    expect(search).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: /Chọn tất cả 2 học viên thiếu giá/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /Học phí mỗi buổi/ }), { target: { value: "220000" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Căn cứ áp dụng" }), { target: { value: "Bổ sung giá" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu đơn giá cho 2 học viên" }));

    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("Đã lưu đơn giá.");
    expect(banner.parentElement).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
