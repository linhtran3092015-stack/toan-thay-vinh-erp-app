// Value: protects=the FormWithToc/FormSection contract from design 17a: one `nav` (default label "Mục trong form") of in-page `#id` anchors with right-hand statuses in tones (danger 600, success, muted), the first item `aria-current="location"` without IntersectionObserver and the scroll-spy moving it with one, sections labelled by their h2 (tabIndex -1) with an optional description and header action, anchor activation scrolling (instant with reduced motion), writing the hash and moving focus to the section heading, modified clicks left to the browser, the 240px sticky card at lg+ and the 44px scrolling row below lg; the pattern sources stay on the design tokens;
// fails_when=an anchor stops pointing at its section, a status loses its tone or its text, aria-current lands on a wrong or second item, a section loses aria-labelledby or the focusable heading, activation leaves focus on the link, a ctrl-click is hijacked, the mobile row or the sticky card classes disappear, or a legacy token / outline-none / raw hex enters the pattern files;
// why_new=step 15a adds the shared long-form pattern (FormWithToc, FormSection) and promotes the stepper;
// seam=IntersectionObserver, matchMedia and Element.scrollIntoView are stubbed per test (jsdom has none); no_claim=does not prove the real scroll position, the sticky layout or the scroll-spy band visually (checked in /dev/forms) nor any feature's status logic (lane tests)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FormSection, FormWithToc, type FormTocItem } from "@/components/patterns/form-with-toc";

const items: FormTocItem[] = [
  { id: "ho-so", label: "Hồ sơ", status: "5/7", tone: "muted" },
  { id: "phu-huynh", label: "Phụ huynh chính", status: "1 lỗi", tone: "danger" },
  { id: "ly-do", label: "Lý do thao tác", status: "1/1", tone: "success" },
  { id: "ghi-chu", label: "Ghi chú" },
];

function renderForm(props: { items?: FormTocItem[]; label?: string } = {}) {
  return render(
    <FormWithToc items={props.items ?? items} label={props.label}>
      <FormSection description="Thông tin học viên." headerAction={<button type="button">Kiểm tra hồ sơ trùng</button>} id="ho-so" title="Hồ sơ">
        <input aria-label="Họ và tên" />
      </FormSection>
      <FormSection id="phu-huynh" title="Phụ huynh chính">
        <input aria-label="Số điện thoại" />
      </FormSection>
      <FormSection id="ly-do" title="Lý do thao tác">
        <input aria-label="Lý do" />
      </FormSection>
      <FormSection id="ghi-chu" title="Ghi chú">
        <input aria-label="Ghi chú" />
      </FormSection>
    </FormWithToc>,
  );
}

function toc() {
  return screen.getByRole("navigation", { name: "Mục trong form" });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("FormWithToc", () => {
  it("lists one in-page anchor per section with its status and tone", () => {
    renderForm();
    const links = within(toc()).getAllByRole("link");

    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["#ho-so", "#phu-huynh", "#ly-do", "#ghi-chu"]);
    expect(links[0]).toHaveTextContent("Hồ sơ: 5/7");
    expect(links[1]).toHaveAccessibleName("Phụ huynh chính: 1 lỗi");
    expect(links[3]).toHaveAccessibleName("Ghi chú");

    const danger = within(links[1]).getByText("1 lỗi");
    expect(danger).toHaveAttribute("data-tone", "danger");
    expect(danger).toHaveClass("text-danger", "font-semibold", "text-caption");
    expect(within(links[2]).getByText("1/1")).toHaveClass("text-success");
    // The first item is active: its neutral status takes the item's primary colour.
    expect(within(links[0]).getByText("5/7")).toHaveClass("text-action-primary");
  });

  it("uses a feature label when given", () => {
    renderForm({ label: "Mục của lớp" });
    expect(screen.getByRole("navigation", { name: "Mục của lớp" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Mục trong form" })).not.toBeInTheDocument();
  });

  it("marks the first item as the current location without IntersectionObserver", () => {
    expect(typeof IntersectionObserver).toBe("undefined");
    renderForm();
    const links = within(toc()).getAllByRole("link");

    expect(links.filter((link) => link.getAttribute("aria-current") === "location")).toEqual([links[0]]);
    expect(links[0]).toHaveClass("bg-surface-selected", "font-semibold", "text-action-primary!");
    expect(links[1]).not.toHaveClass("bg-surface-selected");
  });

  it("follows the section in view with IntersectionObserver and falls back to the first item when it disappears", () => {
    let notify: ((entries: Array<{ isIntersecting: boolean; target: Element }>) => void) | undefined;
    const observed: Element[] = [];
    class FakeIntersectionObserver {
      constructor(callback: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void) {
        notify = callback;
      }
      disconnect() {}
      observe(element: Element) {
        observed.push(element);
      }
      unobserve() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

    const { rerender } = renderForm();
    expect(observed.map((element) => element.id)).toEqual(["ho-so", "phu-huynh", "ly-do", "ghi-chu"]);

    act(() =>
      notify?.([
        { isIntersecting: false, target: document.getElementById("ho-so")! },
        { isIntersecting: true, target: document.getElementById("ly-do")! },
      ]),
    );
    expect(within(toc()).getByRole("link", { name: /Lý do thao tác/ })).toHaveAttribute("aria-current", "location");
    expect(within(toc()).getByRole("link", { name: /Hồ sơ/ })).not.toHaveAttribute("aria-current");

    // The active section leaves the form (e.g. a conditional section): the first item takes over.
    rerender(
      <FormWithToc items={items.filter((item) => item.id !== "ly-do")}>
        <FormSection id="ho-so" title="Hồ sơ">
          <input aria-label="Họ và tên" />
        </FormSection>
      </FormWithToc>,
    );
    expect(within(toc()).getByRole("link", { name: /Hồ sơ/ })).toHaveAttribute("aria-current", "location");
  });

  it("keeps the clicked item active while the page scrolls to it, then follows the scroll again", () => {
    vi.useFakeTimers();
    let notify: ((entries: Array<{ isIntersecting: boolean; target: Element }>) => void) | undefined;
    class FakeIntersectionObserver {
      constructor(callback: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void) {
        notify = callback;
      }
      disconnect() {}
      observe() {}
      unobserve() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    try {
      renderForm();
      fireEvent.click(within(toc()).getByRole("link", { name: /Ghi chú/ }));
      // The smooth scroll passes "Phụ huynh chính" on its way down: ignored, the clicked item stays current.
      act(() => notify?.([{ isIntersecting: true, target: document.getElementById("phu-huynh")! }]));
      expect(within(toc()).getByRole("link", { name: /Ghi chú/ })).toHaveAttribute("aria-current", "location");

      act(() => vi.advanceTimersByTime(1000));
      act(() => notify?.([{ isIntersecting: true, target: document.getElementById("ly-do")! }]));
      expect(within(toc()).getByRole("link", { name: /Phụ huynh chính/ })).toHaveAttribute("aria-current", "location");
    } finally {
      vi.useRealTimers();
    }
  });

  it("scrolls to the section, writes the hash and moves focus to its heading", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      renderForm();
      const link = within(toc()).getByRole("link", { name: /Phụ huynh chính/ });
      const clicked = fireEvent.click(link);

      expect(clicked).toBe(false); // default prevented: the component scrolled itself
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
      expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("phu-huynh"));
      expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: "Phụ huynh chính" }));
      expect(window.location.hash).toBe("#phu-huynh");
      expect(link).toHaveAttribute("aria-current", "location");
    } finally {
      // @ts-expect-error jsdom has no scrollIntoView; remove the stub again.
      delete Element.prototype.scrollIntoView;
    }
  });

  it("jumps without smooth scrolling when the person prefers reduced motion", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ addEventListener: vi.fn(), matches: query === "(prefers-reduced-motion: reduce)", removeEventListener: vi.fn() })));
    try {
      renderForm();
      fireEvent.click(within(toc()).getByRole("link", { name: /Lý do thao tác/ }));
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    } finally {
      // @ts-expect-error jsdom has no scrollIntoView; remove the stub again.
      delete Element.prototype.scrollIntoView;
    }
  });

  it("moves focus without scrolling support (jsdom) and leaves modified clicks to the browser", () => {
    renderForm();
    const link = within(toc()).getByRole("link", { name: /Lý do thao tác/ });

    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
    expect(document.activeElement).not.toBe(screen.getByRole("heading", { level: 2, name: "Lý do thao tác" }));
    expect(window.location.hash).toBe("");

    fireEvent.click(link);
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: "Lý do thao tác" }));
  });

  it("shows a horizontal 44px anchor row below lg and a 240px sticky card at lg+", () => {
    const { container } = renderForm();
    const nav = toc();
    const grid = container.firstElementChild as HTMLElement;

    expect(grid).toHaveClass("grid", "gap-6", "lg:grid-cols-[240px_minmax(0,1fr)]");
    expect(nav.parentElement).toHaveClass("lg:sticky", "lg:top-[calc(var(--topbar-h)+24px)]");
    // Below lg: a row that scrolls sideways; lg+: the bordered card.
    expect(nav).toHaveClass("overflow-x-auto", "lg:overflow-visible", "lg:rounded-lg", "lg:border", "lg:bg-surface-base", "lg:p-2");
    expect(within(nav).getByRole("list")).toHaveClass("flex", "min-w-max", "lg:flex-col");
    for (const link of within(nav).getAllByRole("link")) {
      expect(link).toHaveClass("min-h-11", "lg:min-h-10", "rounded-md", "whitespace-nowrap");
    }
    // The sections column follows the navigation (20px between sections).
    expect(nav.parentElement?.nextElementSibling).toHaveClass("flex", "flex-col", "gap-5");
  });
});

describe("FormSection", () => {
  it("is a section labelled by its focusable h2, with description, header action and body", () => {
    renderForm();
    const section = screen.getByRole("region", { name: "Hồ sơ" });
    const heading = within(section).getByRole("heading", { level: 2, name: "Hồ sơ" });

    expect(section.tagName).toBe("SECTION");
    expect(section).toHaveAttribute("id", "ho-so");
    expect(section).toHaveAttribute("aria-labelledby", heading.id);
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(heading).toHaveClass("text-section-title", "font-semibold");
    expect(section).toHaveTextContent("Thông tin học viên.");
    expect(within(section).getByRole("button", { name: "Kiểm tra hồ sơ trùng" })).toBeInTheDocument();
    expect(within(section).getByRole("textbox", { name: "Họ và tên" })).toBeInTheDocument();
    // The anchor lands below the sticky topbar; the card is the design 17a section card.
    expect(section).toHaveClass("scroll-mt-[calc(var(--topbar-h)+16px)]", "rounded-lg", "border-border-subtle", "bg-surface-base");
    expect(heading.closest(".border-b")).toHaveClass("border-border-row", "px-5", "py-4");
  });

  it("renders no description or header action when none is given", () => {
    renderForm();
    const section = screen.getByRole("region", { name: "Phụ huynh chính" });
    expect(within(section).queryByRole("button")).not.toBeInTheDocument();
    expect(section.querySelector("p")).toBeNull();
  });
});

describe("form pattern sources", () => {
  it("use the shared focus outline and design tokens only (no outline-none, focus rings, legacy aliases or raw hex)", () => {
    const files = [
      "src/components/patterns/form-with-toc.tsx",
      "src/components/patterns/stepper.tsx",
      "src/components/patterns/sticky-save-bar.tsx",
      "src/features/finance/components/period-stepper.tsx",
    ];
    const forbidden =
      /outline-none|focus:ring|focus-visible:ring|\b(text-ink[\w-]*|border-hairline[\w-]*|bg-surface-[12]|bg-canvas|shadow-card|font-display|bg-white|text-primary|bg-primary)\b|#[0-9a-fA-F]{3,8}\b/;

    for (const file of files) {
      expect(readFileSync(join(process.cwd(), file), "utf8"), file).not.toMatch(forbidden);
    }
  });
});
