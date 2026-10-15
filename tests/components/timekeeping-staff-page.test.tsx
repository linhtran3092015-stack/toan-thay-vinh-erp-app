// Value: protects=the staff-only /timekeeping layout (step 12, D11/D12/D13): a person whose only permission is timekeeping.check gets a compact "Chấm công" page header (visually hidden below md) and the action card first, then the "Chấm công cần xác minh" panel, the monthly timesheet and the adjustment history, each handed the same actions overrides; anyone with a management or approval permission keeps the original "Chấm công & Ca làm" page with the exception panel on top; the pulse keyframes exist and the global reduced-motion rule still switches all animation off;
// fails_when=the staff page loses its h1 or keeps the manager header, the exception panel is placed above the action card for staff (or below it for approvers), a staff child stops receiving the overrides (the /dev preview would then call real server actions), the exception panel appears without exceptionReviewEnabled, a mixed role falls into the staff layout, or globals.css drops the pulse keyframes or the reduced-motion kill switch;
// why_new=timekeeping-management.test.tsx renders TimekeepingPage only with canCheck false, and timekeeping-route.test.tsx stubs the page entirely;
// seam=every child panel mocked to a marker that records its props (next/navigation mocked for the real header/dialog code still imported by the page); no_claim=does not prove the children render correctly (their own tests do) or how the layout looks at a given width
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TimekeepingActionOverrides } from "@/features/timekeeping/timekeeping-action-overrides";
import type { AttendanceVerificationPolicy, TimekeepingMyEntry } from "@/features/timekeeping/types";

const rendered = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/timekeeping/components/my-timekeeping-panel", () => ({
  MyTimekeepingPanel: (props: object) => {
    rendered("my-panel", props);
    return <section data-testid="my-panel" />;
  },
}));
vi.mock("@/features/timekeeping/components/attendance-exception-panel", () => ({
  AttendanceExceptionPanel: (props: object) => {
    rendered("exception-panel", props);
    return <section data-testid="exception-panel" />;
  },
}));
vi.mock("@/features/timekeeping/components/my-monthly-timesheet-panel", () => ({
  MyMonthlyTimesheetPanel: (props: object) => {
    rendered("monthly-panel", props);
    return <section data-testid="monthly-panel" />;
  },
}));
vi.mock("@/features/timekeeping/components/timekeeping-adjustment-requests", () => ({
  TimekeepingAdjustmentRequests: (props: object) => {
    rendered("adjustment-history", props);
    return <section data-testid="adjustment-history" />;
  },
}));
vi.mock("@/features/timekeeping/components/timekeeping-adjustment-approval-queue", () => ({
  TimekeepingAdjustmentApprovalQueue: () => <section data-testid="approval-queue" />,
}));
vi.mock("@/features/timekeeping/components/center-monthly-timesheet-management", () => ({
  CenterMonthlyTimesheetManagement: () => <section data-testid="center-monthly" />,
}));
vi.mock("@/features/timekeeping/components/timekeeping-day-entries", () => ({ TimekeepingDayEntries: () => null }));
vi.mock("@/features/timekeeping/components/weekly-schedule-panel", () => ({ WeeklySchedulePanel: () => null }));
vi.mock("@/features/timekeeping/components/attendance-verification-settings", () => ({ AttendanceVerificationSettings: () => null }));

import { TimekeepingPage } from "@/features/timekeeping/timekeeping-page";

const policy: AttendanceVerificationPolicy = {
  attendanceRadiusM: 150,
  centerName: "Cơ sở chính",
  configured: true,
  continuousGpsTrackingRequired: false,
  exceptionReviewEnabled: true,
  gpsMaxAccuracyM: 60,
  gpsRequiredForOffline: true,
  wifiRequiredForOffline: false,
};

const openEntry: TimekeepingMyEntry = {
  autoEndedAt: null,
  checkInAt: "2026-10-12T01:30:00.000Z",
  checkInMode: "offline",
  checkOutAt: null,
  checkOutMode: null,
  hasCheckInGpsEvidence: true,
  hasCheckInWifiEvidence: false,
  hasCheckOutGpsEvidence: false,
  hasCheckOutWifiEvidence: false,
  id: "entry-1",
  scheduledEndTime: null,
  scheduledStartTime: null,
  status: "open",
  workDate: "2026-10-12",
  workShiftCode: null,
  workShiftName: null,
};

const overrides: TimekeepingActionOverrides = {
  checkInTimeEntry: vi.fn(),
  fetchMyMonthlyTimesheet: vi.fn(),
  geolocation: null,
  getAttendanceExceptionReviews: vi.fn(),
  requestTimeEntryAdjustment: vi.fn(),
};

type Permissions = {
  canApproveAdjustments?: boolean;
  canManage?: boolean;
  canManageVerification?: boolean;
  canView?: boolean;
};

function renderPage(permissions: Permissions = {}, attendancePolicy: AttendanceVerificationPolicy = policy) {
  return render(
    <TimekeepingPage
      actions={overrides}
      adjustmentApprovalQueue={[]}
      adjustmentEntries={[]}
      attendancePolicy={attendancePolicy}
      canApproveAdjustments={permissions.canApproveAdjustments ?? false}
      canCheck
      canManage={permissions.canManage ?? false}
      canManageVerification={permissions.canManageVerification ?? false}
      canView={permissions.canView ?? false}
      dayEntries={[]}
      entries={[]}
      myAdjustmentRequests={[]}
      myEntries={[openEntry]}
      staffOptions={[]}
      workShifts={[]}
    />,
  );
}

function propsOf(name: string): Record<string, unknown> {
  const call = rendered.mock.calls.filter(([marker]) => marker === name).at(-1);
  if (!call) throw new Error(`${name} was not rendered.`);
  return call[1] as Record<string, unknown>;
}

function expectInOrder(...elements: Element[]) {
  for (let index = 1; index < elements.length; index += 1) {
    expect(
      elements[index - 1].compareDocumentPosition(elements[index]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TimekeepingPage staff-only layout (design 14)", () => {
  it("puts the action card first under a compact Chấm công header and threads the overrides to every staff section", () => {
    renderPage();

    const heading = screen.getByRole("heading", { level: 1, name: "Chấm công" });
    expect(heading.closest("header")).toHaveClass("max-md:sr-only");
    expect(screen.getByText("Thực hiện chấm công cá nhân và quản lý yêu cầu điều chỉnh công.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Chấm công & Ca làm" })).not.toBeInTheDocument();
    expect(screen.queryByText("Cá nhân")).not.toBeInTheDocument();

    expectInOrder(
      heading,
      screen.getByTestId("my-panel"),
      screen.getByTestId("exception-panel"),
      screen.getByTestId("monthly-panel"),
      screen.getByTestId("adjustment-history"),
    );
    expect(screen.queryByTestId("approval-queue")).not.toBeInTheDocument();
    expect(screen.queryByTestId("center-monthly")).not.toBeInTheDocument();

    expect(propsOf("my-panel")).toMatchObject({ attendancePolicy: policy, canCheck: true, entries: [openEntry] });
    expect(propsOf("exception-panel")).toMatchObject({ canApprove: false, refreshKey: "entry-1:open" });
    for (const name of ["my-panel", "exception-panel", "monthly-panel", "adjustment-history"]) {
      expect(propsOf(name).actions).toBe(overrides);
    }
  });

  it("leaves out the verification panel when exception review is off", () => {
    renderPage({}, { ...policy, exceptionReviewEnabled: false });

    expect(screen.getByRole("heading", { level: 1, name: "Chấm công" })).toBeInTheDocument();
    expect(screen.queryByTestId("exception-panel")).not.toBeInTheDocument();
    expectInOrder(screen.getByTestId("my-panel"), screen.getByTestId("monthly-panel"), screen.getByTestId("adjustment-history"));
  });

  it("keeps the original page with the verification panel on top for approvers", () => {
    renderPage({ canApproveAdjustments: true });

    const heading = screen.getByRole("heading", { level: 1, name: "Chấm công & Ca làm" });
    expect(screen.queryByRole("heading", { level: 1, name: "Chấm công" })).not.toBeInTheDocument();
    expectInOrder(screen.getByTestId("exception-panel"), heading, screen.getByTestId("my-panel"), screen.getByTestId("monthly-panel"));
    expect(screen.getByTestId("approval-queue")).toBeInTheDocument();
    expect(propsOf("exception-panel")).toMatchObject({ actions: overrides, canApprove: true });
  });

  it.each([
    ["timekeeping.view", { canView: true }],
    ["staff.manage", { canManage: true }],
    ["timekeeping.manage_verification", { canManageVerification: true }],
  ] as const)("keeps the original header and order for a checker who also has %s", (_permission, permissions) => {
    renderPage(permissions);

    const heading = screen.getByRole("heading", { level: 1, name: "Chấm công & Ca làm" });
    expect(screen.queryByRole("heading", { level: 1, name: "Chấm công" })).not.toBeInTheDocument();
    expectInOrder(screen.getByTestId("exception-panel"), heading, screen.getByTestId("my-panel"), screen.getByTestId("monthly-panel"));
  });
});

describe("Shift action pulse CSS contract", () => {
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

  it("defines the pulse on the idle action and the live dot, and never on a disabled button", () => {
    expect(css).toContain("@keyframes shift-action-pulse");
    expect(css).toMatch(/\.shift-action-pulse::after,\s*\.shift-live-dot::after\s*\{\s*animation:\s*shift-action-pulse\b[^}]*infinite;/);
    expect(css).toMatch(/\.shift-action-pulse:disabled::after\s*\{\s*animation:\s*none;/);
  });

  // The loop runs for as long as the card is on screen (a phone can sit there for hours):
  // keyframes that animate box-shadow repaint every frame, opacity/transform stay on the compositor.
  it("animates only compositor properties in the pulse keyframes", () => {
    for (const name of ["shift-action-pulse", "shift-live-pulse"]) {
      const block = css.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1];
      expect(block, name).toBeDefined();
      const properties = new Set(Array.from(block!.matchAll(/([a-z-]+)\s*:/g), (match) => match[1]));
      expect([...properties].sort(), name).toEqual(["opacity", "transform"]);
    }
  });

  // Value: protects=with the animation switched off (the reduced-motion rule below, or any animation:none), the pulse ring and the live-dot copy stay invisible because their resting opacity is 0; only the keyframes make them visible;
  // fails_when=`opacity: 0;` is dropped from the shared ::after base rule, so reduced-motion users get a frozen ring/blob around "Vào ca" and the live dot;
  // why_new=added in review cycle 1; the contract above only pins the animation declaration;
  // seam=none (reads globals.css as text); no_claim=does not prove the browser honours prefers-reduced-motion or how the ring looks
  it("hides the pulse ring at rest so a stopped animation leaves nothing behind", () => {
    const baseRule = css.match(/\.shift-action-pulse::after,\s*\.shift-live-dot::after\s*\{([^}]*)\}/)?.[1];
    expect(baseRule).toBeDefined();
    expect(baseRule).toMatch(/(^|[\s;])opacity:\s*0;/);
    expect(baseRule).toMatch(/animation:\s*shift-action-pulse\b/);
  });

  it("keeps the global reduced-motion rule that switches every animation off", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*,\s*\*::before,\s*\*::after\s*\{\s*animation:\s*none !important;\s*transition:\s*none !important;/,
    );
  });
});
