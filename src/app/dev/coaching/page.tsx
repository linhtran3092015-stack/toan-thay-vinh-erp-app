import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CoachingPreview,
  type CoachingBuilderPreviewState,
  type CoachingPreviewRole,
  type CoachingPreviewView,
  type CoachingPublicPreviewState,
  type CoachingRecordPreviewState,
} from "./coaching-preview";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Coaching · dev",
};

// The first entry of each list is its default; unknown values fall back to it.
const views: readonly [CoachingPreviewView, ...CoachingPreviewView[]] = ["record", "builder", "public"];
const roles: readonly [CoachingPreviewRole, ...CoachingPreviewRole[]] = ["manager", "editor", "viewer"];
const recordStates: readonly [CoachingRecordPreviewState, ...CoachingRecordPreviewState[]] = [
  "in_progress",
  "open",
  "closed",
  "empty",
  "error",
];
const builderStates: readonly [CoachingBuilderPreviewState, ...CoachingBuilderPreviewState[]] = [
  "draft",
  "first",
  "published",
  "new",
  "error",
];
const publicStates: readonly [CoachingPublicPreviewState, ...CoachingPublicPreviewState[]] = [
  "active",
  "submitted",
  "expired",
  "revoked",
  "invalid",
  "unavailable",
];

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function pick<T extends string>(allowed: readonly [T, ...T[]], value: string | undefined): T {
  return allowed.find((item) => item === value) ?? allowed[0];
}

/**
 * Coaching preview mirroring `13-cham-soc-va-coaching.dc.html` (frame 13c)
 * with fixture data: the record page and the form builder inside the shell,
 * and the parent's public form outside it.
 * `?view=record|builder|public&role=manager|editor|viewer&state=…`, where the
 * states depend on the view (an unknown or foreign state shows the view's
 * default, the first of each list):
 * - record: `in_progress`, `open`, `closed`, `empty`, `error`
 * - builder: `draft` (v4 over a published v3), `first` (v1), `published`,
 *   `new`, `error`
 * - public: `active`, `submitted`, `expired`, `revoked`, `invalid`,
 *   `unavailable` (the read failed)
 * Every Coaching server action is an inert stub (previewCoachingActions); the
 * shell's own sign-out in the user menu is real (shared by every /dev
 * preview). Development only: 404 in production.
 */
export default async function DevCoachingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const params = await searchParams;
  const view = pick(views, first(params.view));
  const role = pick(roles, first(params.role));
  const state = first(params.state);

  if (view === "builder") {
    return <CoachingPreview role={role} state={pick(builderStates, state)} view="builder" />;
  }

  if (view === "public") {
    return <CoachingPreview role={role} state={pick(publicStates, state)} view="public" />;
  }

  return <CoachingPreview role={role} state={pick(recordStates, state)} view="record" />;
}
