// Value: protects=the shared Stepper (promoted from PeriodStepper for design 17c/18): a labelled <ol> with one item per step in order, aria-current="step" on the current step only, each state written in words ("Đã xong: ", "Đang ở bước này: ", "Chưa tới: ") with a check for done steps and the number otherwise, optional descriptions and links only where given;
// fails_when=the list is not an <ol> or loses its label, aria-current lands on a done/upcoming step or on several steps, a state is shown by colour only, or an empty description line or a link appears where none was given;
// why_new=step 15a moves the PeriodStepper markup into components/patterns/stepper.tsx so the import wizards (15b) share it;
// seam=none (presentational, server-safe); no_claim=does not prove which step a tuition period maps to (tuition-period-summary.test.ts) or the grid layout visually
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Stepper, type StepperStep } from "@/components/patterns/stepper";

afterEach(cleanup);

const importSteps: StepperStep[] = [
  { state: "done", title: "Tải mẫu & chọn file" },
  { state: "done", title: "Ánh xạ cột" },
  { description: "48 dòng · 2 lỗi", state: "current", title: "Kiểm tra dòng" },
  { link: { href: "/dev/forms", label: "Mở lô" }, state: "upcoming", title: "Xác nhận" },
];

describe("Stepper", () => {
  it("renders a labelled ordered list with every state in words and one current step", () => {
    render(<Stepper label="Các bước nhập liệu" steps={importSteps} />);
    const list = screen.getByRole("list", { name: "Các bước nhập liệu" });
    const items = within(list).getAllByRole("listitem");

    expect(list.tagName).toBe("OL");
    expect(items).toHaveLength(4);
    expect(items.filter((item) => item.getAttribute("aria-current") === "step")).toEqual([items[2]]);
    expect(items[0]).toHaveTextContent("Đã xong: 1. Tải mẫu & chọn file");
    expect(items[2]).toHaveTextContent("Đang ở bước này: 3. Kiểm tra dòng");
    expect(items[3]).toHaveTextContent("Chưa tới: 4. Xác nhận");
    expect(items.map((item) => item.getAttribute("data-state"))).toEqual(["done", "done", "current", "upcoming"]);
    expect(items[2]).toHaveClass("bg-action-primary-soft");
  });

  it("shows a check on done steps and the number otherwise, never as the only signal", () => {
    render(<Stepper label="Các bước nhập liệu" steps={importSteps} />);
    const items = within(screen.getByRole("list", { name: "Các bước nhập liệu" })).getAllByRole("listitem");
    const marker = (item: HTMLElement) => item.querySelector('[aria-hidden="true"]') as HTMLElement;

    expect(marker(items[0]).querySelector("svg")).not.toBeNull();
    expect(marker(items[0])).toHaveClass("bg-success");
    expect(marker(items[2])).toHaveTextContent("3");
    expect(marker(items[2])).toHaveClass("bg-action-primary");
    expect(marker(items[3])).toHaveTextContent("4");
    expect(marker(items[3])).toHaveClass("border", "border-border-strong");
  });

  it("renders descriptions and links only where a step has them", () => {
    render(<Stepper label="Các bước nhập liệu" steps={importSteps} />);
    const items = within(screen.getByRole("list", { name: "Các bước nhập liệu" })).getAllByRole("listitem");

    expect(within(items[2]).getByText("48 dòng · 2 lỗi")).toHaveClass("text-caption", "text-action-primary-hover");
    // No description: only the title line under the marker.
    expect(items[0].querySelectorAll(".text-caption.block")).toHaveLength(0);
    expect(within(items[3]).getByRole("link", { name: "Mở lô" })).toHaveAttribute("href", "/dev/forms");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
