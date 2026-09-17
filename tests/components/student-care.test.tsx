import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { afterEach,beforeEach,describe,it,expect,vi } from "vitest";
import { CareActionForm,CareHealth } from "@/features/student-care/components";
import type { CareDashboard } from "@/features/student-care/models";
const mocks=vi.hoisted(()=>({mutate:vi.fn(),refresh:vi.fn()}));
vi.mock("@/features/student-care/actions",()=>({mutateCare:mocks.mutate}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh})}));
beforeEach(()=>vi.clearAllMocks());
afterEach(cleanup);
describe("student care UI",()=>{
 it("shows a stale-data warning instead of claiming no students need support",()=>{
  render(<CareHealth data={{settings:{enabled:true,last_success_at:null},queue:{pending:12,failed:1}} as CareDashboard}/>);
  expect(screen.getByRole("alert")).toHaveTextContent("chưa cập nhật đúng hạn");
  expect(screen.getByText(/Không có cảnh báo chưa có nghĩa/)).toBeInTheDocument();
 });
 it("reuses the same request key when a network result is uncertain",async()=>{
  mocks.mutate.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ok:true,message:"Đã lưu"});
  render(<CareActionForm base={{op:"claim",task_id:"22222222-2222-4222-8222-222222222222",version:1}} label="Nhận xử lý"/>);
  fireEvent.click(screen.getByRole("button",{name:"Nhận xử lý"}));
  await screen.findByRole("alert");
  await waitFor(()=>expect(screen.getByRole("button",{name:"Nhận xử lý"})).toBeEnabled());
  fireEvent.click(screen.getByRole("button",{name:"Nhận xử lý"}));
  await waitFor(()=>expect(mocks.mutate).toHaveBeenCalledTimes(2));
  expect(mocks.mutate.mock.calls[0][0].request_id).toEqual(mocks.mutate.mock.calls[1][0].request_id);
  await waitFor(()=>expect(mocks.refresh).toHaveBeenCalledOnce());
 });
});
