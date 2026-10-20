import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResultBanner } from "@/components/shared/result-banner";
import { Badge, CountChip } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { TabPanel, Tabs } from "@/components/ui/tabs";

afterEach(cleanup);

describe("Button (handoff 12/10)", () => {
  it("links a disabled reason through aria-describedby", () => {
    render(
      <Button disabled disabledReason="Thiếu 1 kết quả">
        Khóa buổi học
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Khóa buổi học" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Thiếu 1 kết quả");
  });

  it("keeps the label while pending and hides the reason", () => {
    render(
      <Button disabledReason="Không áp dụng" isLoading>
        Đang lưu
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Đang lưu" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(screen.queryByText("Không áp dụng")).not.toBeInTheDocument();
  });

  it("still accepts the pre-handoff variant names", () => {
    render(
      <>
        <Button variant="outline">Cũ</Button>
        <Button variant="danger">Hủy</Button>
        <Button aria-label="Thêm hành động" iconOnly variant="secondary">
          …
        </Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Cũ" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Thêm hành động" })).toBeVisible();
  });

  // Value: protects=a link styled as a coloured button keeps its button text colour: globals.css has an unlayered `a { color: inherit }`, which beats layered Tailwind utilities, so without `!` a primary link (e.g. the home "Điểm danh buổi này") renders dark text on the primary fill, and the disabled colour must be important too to still win;
  // fails_when=the `!` is dropped from a coloured variant's text or disabled-text class; why_new=getButtonClassName is applied to <Link> on the home dashboard; seam=none (class strings only);
  // no_claim=does not prove the computed colour in a browser (jsdom has no Tailwind cascade)
  it("marks coloured variants' text colours important so a global link colour cannot override them", () => {
    const primary = getButtonClassName({ variant: "primary" }).split(/\s+/);
    expect(primary).toEqual(expect.arrayContaining(["text-text-on-primary!", "disabled:text-text-disabled!"]));
    expect(getButtonClassName({ variant: "danger-solid" }).split(/\s+/)).toEqual(expect.arrayContaining(["text-text-on-danger!", "disabled:text-text-disabled!"]));
    expect(getButtonClassName({ variant: "danger-outline" }).split(/\s+/)).toEqual(expect.arrayContaining(["text-danger!", "disabled:text-text-disabled!"]));
  });
});

describe("Badge", () => {
  it("always renders text and hides a decorative icon", () => {
    render(
      <>
        <Badge icon={<svg data-testid="icon" />} tone="success">
          Khớp tự động
        </Badge>
        <Badge tone="purple">Cũ</Badge>
        <CountChip>5</CountChip>
      </>,
    );

    expect(screen.getByText("Khớp tự động")).toBeVisible();
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Cũ")).toBeVisible();
    expect(screen.getByText("5")).toBeVisible();
  });
});

function TabsHarness() {
  const [value, setValue] = useState("overview");

  return (
    <>
      <Tabs
        id="t"
        items={[
          { value: "overview", label: "Tổng quan" },
          { value: "sessions", label: "Buổi học", count: 36 },
          { value: "tuition", label: "Học phí", pending: 4 },
          { value: "archived", label: "Lưu trữ", disabled: true },
        ]}
        label="Mục trong lớp học"
        onValueChange={setValue}
        value={value}
      />
      <TabPanel activeValue={value} tabsId="t" value="overview">
        Panel tổng quan
      </TabPanel>
      <TabPanel activeValue={value} tabsId="t" value="sessions">
        Panel buổi học
      </TabPanel>
      <TabPanel activeValue={value} tabsId="t" value="tuition">
        Panel học phí
      </TabPanel>
    </>
  );
}

describe("Tabs", () => {
  it("switches panels by click and arrow keys, skipping disabled tabs", async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);

    expect(screen.getByRole("tablist", { name: "Mục trong lớp học" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Tổng quan" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Học phí 4 việc tồn" })).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Buổi học 36" }));
    expect(screen.getByText("Panel buổi học")).toBeVisible();
    expect(screen.getByText("Panel tổng quan")).not.toBeVisible();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Học phí 4 việc tồn" })).toHaveFocus();
    expect(screen.getByText("Panel học phí")).toBeVisible();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Tổng quan" })).toHaveFocus();
  });

  it("renders link tabs with aria-current and no panels", () => {
    render(
      <Tabs
        items={[
          { value: "a", label: "Thanh toán", href: "/students/1" },
          { value: "b", label: "Lớp", count: 2, href: "/students/1/classes" },
        ]}
        label="Mục trong hồ sơ"
        value="a"
      />,
    );

    const active = screen.getByRole("tab", { name: "Thanh toán" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("href", "/students/1");
    expect(screen.getByRole("tab", { name: "Lớp 2" })).toHaveAttribute("aria-selected", "false");
  });

  it("gives only the active tab the accent colour", () => {
    render(
      <Tabs
        items={[
          { value: "a", label: "Tổng quan" },
          { value: "b", label: "Học sinh", href: "/classes/1?tab=students" },
        ]}
        label="Mục trong lớp học"
        value="a"
      />,
    );

    const active = screen.getByRole("tab", { name: "Tổng quan" });
    expect(active).toHaveClass("text-action-link");
    expect(active).not.toHaveClass("text-text-default");
    expect(active).not.toHaveClass("hover:text-text-strong");

    const inactive = screen.getByRole("tab", { name: "Học sinh" });
    expect(inactive).toHaveClass("text-text-default");
    expect(inactive).not.toHaveClass("text-action-link");
  });
});

describe("ResultBanner", () => {
  it("keeps title, description, and an inline action together", async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();

    render(
      <ResultBanner
        action={<Button onClick={onReload} size="sm" variant="secondary">Tải lại</Button>}
        description="Người khác vừa sửa buổi này."
        title="Dữ liệu đã cũ."
        tone="conflict"
      />,
    );

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Dữ liệu đã cũ. Người khác vừa sửa buổi này.");
    await user.click(screen.getByRole("button", { name: "Tải lại" }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("treats danger as the error family", () => {
    render(<ResultBanner title="Không gửi được" tone="danger" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Không gửi được");
  });
});

describe("Field controls", () => {
  it("keep the single-line height on inputs but never on textareas", () => {
    render(
      <>
        <Input aria-label="Tên lớp" />
        <Textarea aria-label="Ghi chú" />
        <Textarea aria-label="Lý do" className="min-h-28" />
        <Textarea aria-label="Hướng dẫn" className="min-h-11" rows={1} />
        <Textarea aria-label="Mô tả" className="md:min-h-28" />
      </>,
    );

    expect(screen.getByLabelText("Tên lớp")).toHaveClass("min-h-11", "md:min-h-10");
    // cn() does not merge classes and md:min-h-10 is emitted after every min-h-*, so a textarea carrying it collapses to 40px from 768px.
    for (const label of ["Ghi chú", "Lý do", "Hướng dẫn", "Mô tả"]) {
      const textarea = screen.getByLabelText(label);
      expect(textarea).toHaveClass("py-2", "rounded-md");
      expect(textarea).not.toHaveClass("md:min-h-10");
    }
    // The 80px default applies unless the caller sets its own minimum; a shorter one would otherwise lose to min-h-20 by CSS order.
    expect(screen.getByLabelText("Ghi chú")).toHaveClass("min-h-20");
    expect(screen.getByLabelText("Lý do")).toHaveClass("min-h-28");
    expect(screen.getByLabelText("Lý do")).not.toHaveClass("min-h-20");
    expect(screen.getByLabelText("Hướng dẫn")).toHaveClass("min-h-11");
    expect(screen.getByLabelText("Hướng dẫn")).not.toHaveClass("min-h-20");
    // A breakpoint-only minimum keeps the default below that breakpoint.
    expect(screen.getByLabelText("Mô tả")).toHaveClass("min-h-20", "md:min-h-28");
  });
});
