// Value: protects=the tuition period stepper (HANDOFF §2) renders 4 ordered steps, marks only the current one with aria-current="step", writes each state in words (not colour alone) and shows a step link only where given;
// fails_when=aria-current lands on a done/upcoming step or on several steps, a state is conveyed only by colour, the list is not an <ol>, or the review link renders on a step without one or on a voided step 4 (nothing owed, nothing collected);
// why_new=PeriodStepper is new in step 7a;
// seam=none (presentational); no_claim=does not prove which step a period maps to (buildTuitionPeriodSteps in tuition-period-summary.test.ts) or its visual layout
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildTuitionPeriodSteps, PeriodStepper } from "@/features/finance/components/period-stepper";

afterEach(cleanup);

describe("PeriodStepper", () => {
  it("marks exactly the current step and names every state in text", () => {
    render(<PeriodStepper steps={buildTuitionPeriodSteps({ counts: { paid: 4, partial: 1, unpaid: 2 }, itemCount: 7, requestCount: 7, reviewHref: "/finance/sepay?queue=review", status: "locked" })} />);

    const list = screen.getByRole("list", { name: "Các bước của kỳ thu" });
    expect(list.tagName).toBe("OL");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items.filter((item) => item.getAttribute("aria-current") === "step")).toEqual([items[3]]);
    expect(items[0]).toHaveTextContent("Đã xong: 1. Nháp · chuẩn bị");
    expect(items[3]).toHaveTextContent("Đang ở bước này: 4. Thu & đối soát");
    expect(within(items[3]).getByRole("link", { name: "Mở hàng đợi đối soát SePay" })).toHaveAttribute("href", "/finance/sepay?queue=review");
    expect(within(items[0]).queryByRole("link")).not.toBeInTheDocument();
  });

  it("passes its className to the list", () => {
    render(<PeriodStepper className="mt-2" steps={buildTuitionPeriodSteps({ counts: null, itemCount: 0, requestCount: 0, status: "draft" })} />);

    expect(screen.getByRole("list", { name: "Các bước của kỳ thu" })).toHaveClass("mt-2");
  });

  it("starts a draft on step 1 with the later steps upcoming", () => {
    render(<PeriodStepper steps={buildTuitionPeriodSteps({ counts: null, itemCount: 0, requestCount: 0, status: "draft" })} />);

    const items = within(screen.getByRole("list", { name: "Các bước của kỳ thu" })).getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("aria-current", "step");
    expect(items[1]).toHaveTextContent("Chưa tới: 2. Khóa kỳ · tạo yêu cầu thanh toán");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("hides the SePay review link on a voided step 4, like the header hides its primary when nothing is owed", () => {
    render(
      <PeriodStepper
        steps={buildTuitionPeriodSteps({ collectedVnd: 0, counts: { paid: 0, partial: 0, unpaid: 0 }, itemCount: 2, requestCount: 2, reviewHref: "/finance/sepay?queue=review", status: "locked" })}
      />,
    );

    const items = within(screen.getByRole("list", { name: "Các bước của kỳ thu" })).getAllByRole("listitem");
    expect(items[3]).toHaveAttribute("aria-current", "step");
    expect(items[3]).toHaveTextContent("Không còn yêu cầu hiệu lực");
    expect(screen.queryByRole("link", { name: "Mở hàng đợi đối soát SePay" })).not.toBeInTheDocument();
  });
});
