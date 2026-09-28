import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SepayManualAllocation } from "@/features/finance/components/sepay-manual-allocation";
import { allocateSepayTuitionAction, searchAllocationStudentsAction, getAllocationDetailsAction } from "@/features/finance/manual-allocation-actions";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/finance/manual-allocation-actions", () => ({ allocateSepayTuitionAction: vi.fn(), searchAllocationStudentsAction: vi.fn(), getAllocationDetailsAction: vi.fn() }));
const tx: SepayTransactionReadModel = {
 id:"91000000-0000-4000-8000-000000000001",accountNumber:"1234",accountPurpose:"renewal",amountVnd:1000000,
 bankBrand:"VCB",bankTransactionId:"BANK-001",createdAt:"2026-09-01T01:00:00Z",ingestionSource:"webhook",matchStatus:"unmatched",
 matchedAt:null,matchedPaymentRequestCode:null,matchedStudentFullName:null,referenceNumber:null,sepayV2Id:null,
 transactionAt:"2026-09-01T01:00:00Z",transferType:"in",transferContent:"Hoc phi Minh",
};
const student={id:"92000000-0000-4000-8000-000000000001",name:"Nguyễn Minh",publicCode:"HV001",birthYear:2014,guardianName:"Phụ huynh Minh",guardianPhone:"0901234567",requests:[]};
afterEach(()=>{cleanup();vi.clearAllMocks();});
async function chooseStudent() {
 fireEvent.click(screen.getByRole("button",{name:"Phân bổ học phí"}));
 fireEvent.change(screen.getByLabelText(/Tìm học sinh \(tên/),{target:{value:"Minh"}});
 fireEvent.click(screen.getByRole("button",{name:"Tìm học sinh"}));
 fireEvent.click(await screen.findByRole("button",{name:"Chọn HV001"}));
}
describe("manual SePay allocations",()=>{
 it("does not offer writes without permission or for completed/conflicted/outbound records",()=>{
  const {rerender}=render(<SepayManualAllocation transaction={tx}/>);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  for(const row of [{...tx,matchStatus:"identity_conflict" as const},{...tx,matchStatus:"auto_matched" as const},{...tx,transferType:"out" as const}]){
   rerender(<SepayManualAllocation transaction={row} canAllocate/>);expect(screen.queryByRole("button")).not.toBeInTheDocument();
  }
 });
 it("allocates webhook-only tuition with preview, exact amounts and sessions",async()=>{
  vi.mocked(searchAllocationStudentsAction).mockResolvedValue({ok:true,data:[student]});
  vi.mocked(allocateSepayTuitionAction).mockResolvedValue({ok:true,data:null});
  render(<SepayManualAllocation transaction={tx} canAllocate/>);await chooseStudent();
  fireEvent.change(screen.getByLabelText("Số buổi mua · HV001"),{target:{value:"10"}});
  fireEvent.change(screen.getByLabelText("Số buổi tặng · HV001"),{target:{value:"1"}});
  fireEvent.change(screen.getByLabelText("Lý do phân bổ"),{target:{value:"Đã đối chiếu phụ huynh"}});
  fireEvent.change(screen.getByLabelText("Số tiền (đ) · HV001"),{target:{value:"1100000"}});
  expect(screen.getByRole("button",{name:"Kiểm tra phân bổ"})).toBeDisabled();
  expect(screen.getByText(/Vượt số tiền giao dịch/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Số tiền (đ) · HV001"),{target:{value:"1000000"}});
  fireEvent.click(screen.getByRole("button",{name:"Kiểm tra phân bổ"}));
  expect(allocateSepayTuitionAction).not.toHaveBeenCalled();
  expect(screen.getByText("Kiểm tra trước khi ghi nhận")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Xác nhận phân bổ"}));
  await waitFor(()=>expect(allocateSepayTuitionAction).toHaveBeenCalledWith({transactionId:tx.id,reason:"Đã đối chiếu phụ huynh",allocations:[{studentId:student.id,paymentRequestId:null,amountVnd:1000000,sessions:10,bonusSessions:1}]}));
  expect(refresh).toHaveBeenCalled();
 });
 it("locks sessions to an existing request and preserves input after stale request error",async()=>{
  const request={id:"93000000-0000-4000-8000-000000000001",code:"PAY-001",amountVnd:1000000,sessions:8,bonusSessions:0,topupType:"renewal" as const,status:"pending" as const};
  vi.mocked(searchAllocationStudentsAction).mockResolvedValue({ok:true,data:[{...student,requests:[request]}]});
  vi.mocked(allocateSepayTuitionAction).mockResolvedValue({ok:false,message:"Yêu cầu đã thay đổi"});
  render(<SepayManualAllocation transaction={tx} canAllocate/>);await chooseStudent();
  expect(screen.getByLabelText("Số buổi mua · HV001")).toBeDisabled();
  fireEvent.change(screen.getByRole("combobox"),{target:{value:request.id}});
  expect(screen.getByLabelText("Số buổi mua · HV001")).toHaveValue(8);
  fireEvent.change(screen.getByLabelText("Lý do phân bổ"),{target:{value:"Khớp theo yêu cầu"}});
  fireEvent.click(screen.getByRole("button",{name:"Kiểm tra phân bổ"}));fireEvent.click(screen.getByRole("button",{name:"Xác nhận phân bổ"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Yêu cầu đã thay đổi");
  expect(screen.getByLabelText("Lý do phân bổ")).toHaveValue("Khớp theo yêu cầu");
 });
 it("lets read-only users inspect completed allocations",async()=>{
  vi.mocked(getAllocationDetailsAction).mockResolvedValue({ok:true,data:[{student_name:"Nguyễn Minh",student_code:"HV001",allocated_amount_vnd:1000000,allocated_sessions:10,bonus_sessions:0,unit_price_vnd:100000,notes:"Đã đối chiếu",allocated_at:"2026-09-01T01:00:00Z",allocated_by_name:"Kế toán",payment_request_code:null}]});
  render(<SepayManualAllocation transaction={{...tx,matchStatus:"split_allocated"}}/>);
  fireEvent.click(screen.getByRole("button",{name:"Xem phân bổ"}));
  expect(await screen.findByText(/Kế toán/)).toBeInTheDocument();expect(screen.getByText(/Lý do: Đã đối chiếu/)).toBeInTheDocument();
  expect(screen.queryByRole("button",{name:"Xác nhận phân bổ"})).not.toBeInTheDocument();
 });
});
