// Value: protects=the /dev/forms student views are inert and truthful: every write and the duplicate lookup run the preview's stubs (create/update answer "Bản xem trước không ghi dữ liệu.", the lookup answers the fixture guardian only in duplicate/sibling) and never the real server actions (the preview runs on localhost where .env.local may point at production); every action the form can reach has a stub; Hủy, the header link and the profile links stay on /dev and nothing links into a live write route; each state shows what it names (dirty bar, one validation error, exact duplicate with its confirmation section, sibling reuse warning); the TA and the viewer get the routes' denials;
// fails_when=the form stops accepting injected actions and falls back to a real action, the preview stops passing its stubs, a new action imported by the form ships without a stub, a preview href or router.push leaves /dev (or targets /students/new, /classes/new, /sessions/batch, /imports/*), a fixture state renders the wrong panel, or a role without students.create / students.update sees the form;
// why_new=step 15a replaces the placeholder student body of /dev/forms with the real form on fixtures;
// seam=the student form actions module is mocked so any real call is observable; next/navigation offers useRouter only; the body is rendered without AppShell (the controller wraps it); no_claim=the /dev/forms page wiring and the production 404 (dev-forms-page.test.tsx), the form's own behaviour (student-profile-form.test.tsx)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getStudentFormPreviewActions, StudentFormPreviewBody } from "@/app/dev/forms/student-form-preview";
import * as studentFormActions from "@/features/students/form/student-form-actions";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/students/form/student-form-actions", () => ({
  createStudentWithPrimaryGuardianAction: vi.fn(),
  findStudentFormDuplicatesAction: vi.fn(),
  updateStudentWithPrimaryGuardianAction: vi.fn(),
}));

const STUB = "Bản xem trước không ghi dữ liệu.";
const states = ["clean", "dirty", "error", "duplicate", "sibling"] as const;
const views = ["student", "student-edit"] as const;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function expectNothingReal() {
  for (const action of Object.values(studentFormActions)) {
    expect(action).not.toHaveBeenCalled();
  }
  expect(router.refresh).not.toHaveBeenCalled();
  for (const [href] of router.push.mock.calls) {
    expect(href).toMatch(/^\/dev\//);
  }
}

const bar = () => screen.getByRole("region", { name: "Thanh lưu thay đổi" });
const toc = () => screen.getByRole("navigation", { name: "Mục trong form" });

describe("/dev/forms student preview", () => {
  it("stubs every student form action the form can reach", () => {
    // The form's own modules, not this file's mock keys: a new action imported there fails here until it gets a stub.
    const files = [
      "src/features/students/form/student-form-page.tsx",
      "src/features/students/form/components/student-profile-form.tsx",
      "src/features/students/form/components/student-profile-sections.tsx",
    ];
    const reachable = new Set<string>();
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"(?:@\/features\/students\/form|\.\.?)\/student-form-actions"/g)) {
        for (const name of match[1].split(",").map((part) => part.trim()).filter(Boolean)) reachable.add(name.replace(/Action$/, ""));
      }
    }
    expect([...reachable].sort()).toEqual(["createStudentWithPrimaryGuardian", "findStudentFormDuplicates", "updateStudentWithPrimaryGuardian"]);
    for (const state of states) {
      expect(Object.keys(getStudentFormPreviewActions(state)).sort(), state).toEqual([...reachable].sort());
    }
  });

  it("saves the dirty create form through the stubs and leaves only to /dev", async () => {
    render(<StudentFormPreviewBody role="owner" state="dirty" view="student" />);
    await waitFor(() => expect(bar()).toHaveTextContent("7 thay đổi chưa lưu"));
    expect(screen.getByLabelText("Họ và tên")).toHaveValue("Nguyễn Gia Hân");

    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));
    expect(await within(bar()).findByRole("alert")).toHaveTextContent(STUB);
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu và thêm tiếp" }));
    await waitFor(() => expect(within(bar()).getByRole("button", { name: "Lưu và thêm tiếp" })).toBeEnabled());
    expect(within(bar()).getByRole("alert")).toHaveTextContent(STUB);
    expect(screen.getByLabelText("Họ và tên")).toHaveValue("Nguyễn Gia Hân");

    fireEvent.click(within(bar()).getByRole("button", { name: "Hủy" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" })).getByRole("button", { name: "Rời trang" }));
    expect(router.push).toHaveBeenCalledWith("/dev/lists?view=students");
    expectNothingReal();
  });

  it("shows one validation error as after a submit in state=error", async () => {
    render(<StudentFormPreviewBody role="owner" state="error" view="student" />);

    await waitFor(() => expect(bar()).toHaveTextContent("Đang nhập · 1 lỗi cần sửa"));
    expect(bar()).toHaveTextContent("Số điện thoại phụ huynh");
    expect(screen.getByLabelText("Số điện thoại")).toHaveAttribute("aria-invalid", "true");
    expect(within(toc()).getByRole("link", { name: "Phụ huynh chính: 1 lỗi" })).toBeInTheDocument();
    expectNothingReal();
  });

  it("renders the exact duplicate with its confirmation section and saves through the stubs once a reason is given", async () => {
    render(<StudentFormPreviewBody role="owner" state="duplicate" view="student" />);

    const confirmation = await screen.findByRole("region", { name: "Xác nhận tiếp tục lưu" });
    expect(screen.getByText("Đã có học sinh trùng họ tên, năm sinh và số điện thoại phụ huynh:")).toBeInTheDocument();
    expect(screen.getByText("Số điện thoại này đã thuộc phụ huynh Nguyễn Thị Thu")).toBeInTheDocument();

    fireEvent.change(within(confirmation).getByLabelText("Lý do vẫn tạo hoặc cập nhật hồ sơ"), { target: { value: "Xem trước" } });
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));
    expect(await within(bar()).findByRole("alert")).toHaveTextContent(STUB);
    expect(screen.getByRole("region", { name: "Xác nhận tiếp tục lưu" })).toBeInTheDocument();
    expectNothingReal();
  });

  it("renders the sibling reuse warning on create and edit", async () => {
    render(<StudentFormPreviewBody role="owner" state="sibling" view="student" />);
    expect(await screen.findByText("Số điện thoại này đã thuộc phụ huynh Nguyễn Thị Thu")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Xác nhận tiếp tục lưu" })).not.toBeInTheDocument();
    cleanup();

    render(<StudentFormPreviewBody role="owner" state="sibling" view="student-edit" />);
    expect(await screen.findByText("Số điện thoại này đã thuộc phụ huynh Nguyễn Thị Thu")).toBeInTheDocument();
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu thay đổi" }));
    expect(await within(bar()).findByRole("alert")).toHaveTextContent(STUB);
    expectNothingReal();
  });

  it("answers the duplicate check with the stub's error outside the duplicate states", async () => {
    render(<StudentFormPreviewBody role="owner" state="clean" view="student-edit" />);
    expect(screen.getByRole("heading", { level: 1, name: "Phạm Minh Khang" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra hồ sơ trùng" }));
    expect(await screen.findByText("Chưa kiểm tra được hồ sơ trùng.")).toBeInTheDocument();
    expect(screen.getByText("Chưa kiểm tra được hồ sơ trùng.").closest('[role="alert"]')).toHaveTextContent(STUB);
    expectNothingReal();
  });

  it.each(views.flatMap((view) => states.map((state) => ({ state, view }))))(
    "keeps every link of $view ($state) on /dev or in the page",
    async ({ state, view }) => {
      const { container } = render(<StudentFormPreviewBody role="owner" state={state} view={view} />);
      await waitFor(() => expect(bar()).toBeInTheDocument());
      const hrefs = Array.from(container.querySelectorAll("a[href]")).map((link) => link.getAttribute("href")!);
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(href, href).toMatch(/^(#|\/dev\/)/);
        expect(href, href).not.toMatch(/^\/(students\/new|classes\/new|sessions\/batch|imports\/)/);
      }
    },
  );

  it.each([
    { name: "Không có quyền tạo học viên", role: "ta", view: "student" },
    { name: "Không có quyền tạo học viên", role: "viewer", view: "student" },
    { name: "Không có quyền chỉnh sửa học viên", role: "ta", view: "student-edit" },
    { name: "Không có quyền chỉnh sửa học viên", role: "viewer", view: "student-edit" },
  ] as const)("shows the route's denial to the $role on $view", ({ name, role, view }) => {
    render(<StudentFormPreviewBody role={role} state="dirty" view={view} />);
    expect(screen.getByRole("heading", { level: 1, name })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Thanh lưu thay đổi" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Mục trong form" })).not.toBeInTheDocument();
  });
});
