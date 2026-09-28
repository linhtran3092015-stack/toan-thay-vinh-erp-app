import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ permissions: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/permissions/database-permissions", () => ({ getDatabasePermissions: mocks.permissions }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { allocateSepayTuitionAction, searchAllocationStudentsAction, getAllocationDetailsAction } from "@/features/finance/manual-allocation-actions";
const input={transactionId:"91000000-0000-4000-8000-000000000001",reason:"Đã kiểm tra",allocations:[{studentId:"92000000-0000-4000-8000-000000000001",paymentRequestId:null,amountVnd:1000000,sessions:10,bonusSessions:0}]};
beforeEach(()=>{vi.clearAllMocks();mocks.permissions.mockResolvedValue({ok:true,permissions:["sepay.allocate","sepay.view"]});mocks.rpc.mockResolvedValue({data:null,error:null});});
describe("manual allocation server boundary",()=>{
 it("does not grant tuition writes to history-sync-only users",async()=>{
  mocks.permissions.mockResolvedValue({ok:true,permissions:["sepay.sync_history.manage"]});
  expect((await allocateSepayTuitionAction(input)).ok).toBe(false);
  expect((await searchAllocationStudentsAction("Minh")).ok).toBe(false);expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("rejects duplicate students, negative and fractional sessions before DB",async()=>{
  for(const allocations of [[input.allocations[0],input.allocations[0]],[{...input.allocations[0],sessions:-1}],[{...input.allocations[0],sessions:1.2}]]){
   expect((await allocateSepayTuitionAction({...input,allocations})).ok).toBe(false);
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("submits only canonical fields and refreshes all affected views",async()=>{
  expect((await allocateSepayTuitionAction(input)).ok).toBe(true);
  expect(mocks.rpc).toHaveBeenCalledWith("allocate_sepay_tuition_manually",{p_sepay_transaction_id:input.transactionId,p_reason:input.reason,p_allocations:[{student_id:input.allocations[0].studentId,payment_request_id:null,allocated_amount_vnd:1000000,allocated_sessions:10,bonus_sessions:0}]});
  expect(mocks.revalidate).toHaveBeenCalledWith("/finance/orders");expect(mocks.revalidate).toHaveBeenCalledWith("/finance/session-ledger");
 });
 it("reports stale transaction without announcing success",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{message:"TRANSACTION_ALREADY_RECONCILED"}});
  const result=await allocateSepayTuitionAction(input);expect(result.ok).toBe(false);expect(mocks.revalidate).not.toHaveBeenCalled();
 });
 it("fails closed when student request metadata cannot be parsed",async()=>{
  mocks.rpc.mockResolvedValue({data:[{student_id:input.allocations[0].studentId,pending_requests:"bad payload"}],error:null});
  expect((await searchAllocationStudentsAction("Minh")).ok).toBe(false);
 });
 it("requires viewing permission for allocation details",async()=>{
  mocks.permissions.mockResolvedValue({ok:true,permissions:[]});
  expect((await getAllocationDetailsAction(input.transactionId)).ok).toBe(false);expect(mocks.rpc).not.toHaveBeenCalled();
 });
});
