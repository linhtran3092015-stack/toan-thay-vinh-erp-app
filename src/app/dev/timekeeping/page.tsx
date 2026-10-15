import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TimekeepingPreview, type TimekeepingPreviewState } from "./timekeeping-preview";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Chấm công · dev",
};

// The first entry is the default; unknown values fall back to it.
const states: readonly [TimekeepingPreviewState, ...TimekeepingPreviewState[]] = [
  "idle",
  "blocked",
  "open",
  "open-online",
  "ended",
  "unconfigured",
  "wifi",
];

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function pick<T extends string>(allowed: readonly [T, ...T[]], value: string | undefined): T {
  return allowed.find((item) => item === value) ?? allowed[0];
}

/**
 * Staff timekeeping preview mirroring `14-cham-cong-mobile.dc.html` (frames
 * 14a–14e) with fixture data for a teaching assistant who only has
 * `timekeeping.check`. `?state=`:
 * - `idle` (default): no shift yet today; the sheet's location stub reports
 *   ±12 m
 * - `blocked`: ±85 m against a 50 m limit, and "Vào ca" answers with the
 *   server's outside-the-centre message (design 14e)
 * - `open`: an on-site shift in progress (14b); `open-online`: an online one
 * - `ended`: today's shift was closed by the 22:30 cutoff
 * - `unconfigured`: the centre has no saved location yet
 * - `wifi`: the owner requires the centre Wi-Fi to be typed in
 * The monthly timesheet (14c) and the adjustment sheet (14d) are on every
 * state. Every timekeeping server action and the device location are inert
 * stubs (TimekeepingActionOverrides); the shell's own sign-out in the user
 * menu is real (shared by every /dev preview). Development only: 404 in
 * production.
 */
export default async function DevTimekeepingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const params = await searchParams;

  // One clock for the server render and hydration: fixtures derive from it.
  return <TimekeepingPreview now={new Date().toISOString()} state={pick(states, first(params.state))} />;
}
