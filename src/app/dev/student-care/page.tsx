import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getCareSearchParamValues,
  getCareTab,
  parseCareFilter,
  type CareRouteSearchParams,
} from "@/features/student-care/student-care-url-state";

import {
  StudentCarePreview,
  type StudentCarePreviewRole,
  type StudentCarePreviewState,
  type StudentCarePreviewView,
} from "./student-care-preview";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Chăm sóc học sinh · dev",
};

const views: StudentCarePreviewView[] = ["list", "detail"];
const roles: StudentCarePreviewRole[] = ["handler", "manager", "owner"];
const states: StudentCarePreviewState[] = ["normal", "stale", "paused", "empty", "error"];

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

/**
 * Student-care preview mirroring `13-cham-soc-va-coaching.dc.html` (frames
 * 13a, 13b) with fixture data inside the shell.
 * `?view=list|detail&state=normal|stale|paused|empty|error&role=handler|manager|owner`
 * (plus the queue's own tab, chip and filter keys, which filter the fixtures).
 * mutateCare is an inert stub (previewStudentCareActions): the preview never
 * calls a server action. Development only: 404 in production.
 */
export default async function DevStudentCarePage({ searchParams }: { searchParams: Promise<CareRouteSearchParams> }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const params = await searchParams;
  const view = first(params.view);
  const role = first(params.role);
  const state = first(params.state);
  const values = getCareSearchParamValues(params);

  return (
    <StudentCarePreview
      filter={parseCareFilter(values)}
      role={roles.includes(role as StudentCarePreviewRole) ? (role as StudentCarePreviewRole) : "owner"}
      state={states.includes(state as StudentCarePreviewState) ? (state as StudentCarePreviewState) : "normal"}
      tab={getCareTab(values.tab)}
      view={views.includes(view as StudentCarePreviewView) ? (view as StudentCarePreviewView) : "list"}
    />
  );
}
