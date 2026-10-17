// Value: protects=server-rendered pages (coaching list, session ledger) print timestamps in Vietnam time whatever
// zone the server runs in, so production on Vercel (UTC) shows the same hours as a Vietnam machine;
// fails_when=a page formats an ISO timestamp with Intl and no timeZone (a coaching record opened at 01:30 on 18/10 in
// Vietnam showed "18:30 17/10/2026" on a UTC server);
// seam=server actions and next/navigation mocked; process.env.TZ switched per case, then the page module is loaded
// fresh so module-level formatters are built in that zone, as on a server that booted in it; pages go through
// react-dom/server renderToString;
// no_claim=does not cover the route loaders; the advances and commissions lists are covered by their own tests
// (advances-management, commission-directory-models)
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CoachingRecordDashboardEntry } from "@/features/coaching/read-models";
import type { CenterSessionLedgerEntryReadModel } from "@/features/finance/read-models";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/coaching/actions/coaching-actions", () => ({
  addCoachingNoteAction: vi.fn(),
  advanceCoachingStatusAction: vi.fn(),
  createCoachingRecordAction: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

/** 01:30:45 on Sunday 18/10/2026 in Vietnam, still 17/10 in UTC. */
const lateEvening = "2026-10-17T18:30:45Z";

/** Minutes from local time to UTC, as `Date#getTimezoneOffset` reports them. */
const zoneOffsets = { "Asia/Ho_Chi_Minh": -420, UTC: 0 } as const;
type Zone = keyof typeof zoneOffsets;

/** Switches the process zone, then loads the page's module graph fresh in that zone. */
async function loadIn<T>(zone: Zone, load: () => Promise<T>): Promise<T> {
  vi.stubEnv("TZ", zone);
  // Guard: the switch must reach Date and Intl, or every case would run in the runner's own zone.
  expect(new Date(lateEvening).getTimezoneOffset()).toBe(zoneOffsets[zone]);
  vi.resetModules();
  return load();
}

/** Server HTML of the element built by `build` from modules loaded in `zone`. */
async function serverHtmlIn<T>(zone: Zone, load: () => Promise<T>, build: (loaded: T) => ReactElement): Promise<string> {
  return renderToString(build(await loadIn(zone, load)));
}

/** Visible text of the server HTML, without React's `<!-- -->` text separators. */
function textOf(html: string): string {
  return html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

/** Renders on a UTC server and in Vietnam time: the UTC text, and whether both HTML strings match. */
async function renderInBothZones<T>(load: () => Promise<T>, build: (loaded: T) => ReactElement): Promise<{ matchesVietnamRender: boolean; text: string }> {
  const utcHtml = await serverHtmlIn("UTC", load, build);
  const vietnamHtml = await serverHtmlIn("Asia/Ho_Chi_Minh", load, build);
  return { matchesVietnamRender: utcHtml === vietnamHtml, text: textOf(utcHtml) };
}

describe("Server-rendered pages print timestamps in Vietnam time on a UTC server", () => {
  it("the coaching list shows when a record was opened in Vietnam time", async () => {
    const entry: CoachingRecordDashboardEntry = { assistantOwnerDisplayName: "Phạm Thị Lan", assistantOwnerId: "ta-1", campaignName: "Kèm học kỳ 1", currentStatus: "open", id: "coaching-1", latestEventAt: null, latestOutcome: null, openedAt: lateEvening, priority: "medium", reason: "Điểm kiểm tra giảm", reviewAt: null, studentFullName: "Nguyễn Minh An", studentId: "student-1", studentPublicCode: "HV001" };

    const { matchesVietnamRender, text } = await renderInBothZones(
      () => import("@/features/coaching/coaching-list-page"),
      ({ CoachingListPage }) => <CoachingListPage canManage={false} entries={[entry]} managementOptions={null} />,
    );

    expect(text).toContain("01:30 18/10/2026");
    expect(text).not.toContain("17/10/2026");
    expect(matchesVietnamRender).toBe(true);
  });

  it("the session ledger shows when an entry was recorded in Vietnam time", async () => {
    const entry: CenterSessionLedgerEntryReadModel = { classSessionId: null, createdAt: lateEvening, deltaSessions: 10, effectiveOn: "2026-10-18", entryType: "payment_credit", id: "ledger-1", note: null, referenceCode: "YC-001", studentFullName: "Nguyễn Minh An", studentId: "student-1", studentPublicCode: "HV001", unitPriceVnd: 140_000 };

    const { matchesVietnamRender, text } = await renderInBothZones(
      () => import("@/features/finance/components/session-ledger-history"),
      ({ SessionLedgerHistory }) => <SessionLedgerHistory entries={[entry]} />,
    );

    expect(text).toContain("Ghi nhận 01:30 18/10/2026");
    expect(text).not.toContain("17/10/2026");
    expect(matchesVietnamRender).toBe(true);
  });
});
