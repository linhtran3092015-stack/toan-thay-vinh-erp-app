// Value: protects=the /dev/student-care preview is inert: claiming from the queue, turning the generator off, recording a contact and recording an exception all run the preview's stub and never the real mutateCare (the preview runs on localhost where .env.local may point at production); both screens render from fixtures; the page 404s in production;
// fails_when=a student-care form stops accepting the injected action and falls back to mutateCare, the preview stops passing previewStudentCareActions, or the production guard is removed;
// why_new=step 11a adds a preview of screens whose every form writes care state;
// seam=the actions module is mocked so any real call is observable; AppShell is replaced by its children; next/navigation notFound throws a marker; no_claim=does not prove /dev is unreachable in production at the proxy
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DevStudentCarePage from "@/app/dev/student-care/page";
import { StudentCarePreview, previewStudentCareActions } from "@/app/dev/student-care/student-care-preview";
import { parseCareFilter } from "@/features/student-care/student-care-url-state";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  usePathname: () => "/dev/student-care",
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams("view=list"),
}));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/features/student-care/actions", () => ({ mutateCare: mocks.mutate }));

const STUB = "Bản xem trước không ghi dữ liệu.";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("/dev/student-care preview", () => {
  it("claims and configures through the stub only", async () => {
    render(<StudentCarePreview filter={parseCareFilter({})} role="owner" state="normal" tab="tasks" view="list" />);
    expect(screen.getByRole("heading", { level: 1, name: "Chăm sóc học sinh" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("chạy thành công 14:02 (3 phút trước)");

    fireEvent.click(screen.getAllByRole("button", { name: "Nhận việc · Trần Gia Bảo" })[0]);
    expect((await screen.findAllByText(STUB)).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Cấu hình bộ tự sinh" }));
    const dialog = screen.getByRole("dialog", { name: "Cấu hình bộ tự sinh" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạm dừng tự động" }));
    expect(await within(dialog).findByText(STUB)).toBeInTheDocument();
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("records a contact and an exception through the stub only", async () => {
    render(<StudentCarePreview filter={parseCareFilter({})} role="manager" state="normal" tab="tasks" view="detail" />);
    expect(screen.getByRole("heading", { level: 1, name: "Trần Gia Bảo · Vắng 2 buổi liên tiếp" })).toBeInTheDocument();

    const contactForm = screen.getByRole("button", { name: "Lưu lần liên hệ" }).closest("form")!;
    fireEvent.submit(contactForm);
    expect(await within(contactForm).findByText(STUB)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ngoại lệ · hủy task…" }));
    const dialog = screen.getByRole("dialog", { name: "Ngoại lệ · hủy công việc" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Lý do/ }), { target: { value: "Bảo lưu đến tháng 12" } });
    fireEvent.submit(within(dialog).getByRole("button", { name: "Ghi nhận ngoại lệ" }).closest("form")!);
    expect(await within(dialog).findByText(STUB)).toBeInTheDocument();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("covers the only student-care server action with a stub", () => {
    expect(Object.keys(previewStudentCareActions)).toEqual(["mutateCare"]);
  });

  // Value: protects=the preview stub keeps covering every export of the real "use server" module, so a new student-care action cannot reach production from /dev without a stub;
  // fails_when=actions.ts gains an exported action that previewStudentCareActions does not stub;
  // why_new=T3 of the step 11a ship review (the key list above was compared with a literal, not with the module); seam=source scan of actions.ts (importing it would load the Supabase server client); no_claim=does not prove every form passes the override
  it("stubs every export of the real student-care actions module", () => {
    const source = readFileSync(path.join(process.cwd(), "src/features/student-care/actions.ts"), "utf8");
    const exported = [...source.matchAll(/export\s+(?:async\s+function|function|const|let)\s+(\w+)/g)].map((match) => match[1]).sort();
    expect(exported).toContain("mutateCare");
    expect(Object.keys(previewStudentCareActions).sort()).toEqual(exported);
  });

  it("renders the error and empty states inside the frame", () => {
    const { unmount } = render(<StudentCarePreview filter={parseCareFilter({})} role="handler" state="error" tab="tasks" view="list" />);
    expect(screen.getAllByText("Chưa tải được chăm sóc học sinh").length).toBeGreaterThan(0);
    unmount();
    render(<StudentCarePreview filter={parseCareFilter({})} role="handler" state="empty" tab="inactive" view="list" />);
    expect(screen.getAllByText("Chưa có học sinh cần theo dõi riêng").length).toBeGreaterThan(0);
  });

  it("answers 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(DevStudentCarePage({ searchParams: Promise.resolve({ view: "detail" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
