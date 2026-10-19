"use client";

import { useState } from "react";

import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { BatchSessionCreateWorkspace } from "@/features/sessions/components/batch-session-create-workspace";
import type { SessionBatchActionOverrides } from "@/features/sessions/session-batch-action-overrides";
import { BATCH_CLASSES_VIEW_DENIED, BATCH_SESSIONS_MANAGE_DENIED } from "@/features/sessions/session-batch-route-copy";

import { getPreviewBatchContext, PREVIEW_BATCH_STATES } from "./class-batch-fixtures";
import { FORMS_PREVIEW_TODAY, type BatchFormsPreviewProps } from "./forms-preview-params";

const STUB = "Bản xem trước không ghi dữ liệu.";

/**
 * Inert stand-in for the one write /sessions/batch can reach. The preview
 * runs on localhost where .env.local may point at production, so creating
 * answers with the stub message (nothing refreshes, nothing navigates).
 */
export const previewBatchActions: Required<SessionBatchActionOverrides> = {
  createBatchSessions: async () => ({ message: STUB, status: "error" }),
};

/**
 * /dev/forms `view=batch` body (design 17b, right); rendered inside the
 * AppShell by FormsPreview on the fixed clock. Roles meet what the route
 * shows them: the TA has sessions.manage but not classes.view, the viewer
 * neither. Switching class swaps the fixtures in place instead of navigating
 * to the live route; the state's starting form applies to its own class.
 */
export function BatchPreviewBody({ role, state }: BatchFormsPreviewProps) {
  if (role === "viewer") {
    return <PermissionDeniedState description={BATCH_SESSIONS_MANAGE_DENIED.description} title={BATCH_SESSIONS_MANAGE_DENIED.title} />;
  }
  if (role === "ta") {
    return <PermissionDeniedState description={BATCH_CLASSES_VIEW_DENIED.description} title={BATCH_CLASSES_VIEW_DENIED.title} />;
  }
  // Keyed by state: another `?state=` starts again from that state's class and form.
  return <BatchPreviewWorkspace key={state} state={state} />;
}

function BatchPreviewWorkspace({ state }: { state: BatchFormsPreviewProps["state"] }) {
  const preset = PREVIEW_BATCH_STATES[state];
  const [classId, setClassId] = useState(preset.classId);
  const context = getPreviewBatchContext(classId);

  return (
    <BatchSessionCreateWorkspace
      actions={previewBatchActions}
      classes={context.classes}
      existingSessionCount={context.existingSessionCount}
      existingSessions={context.existingSessions}
      initialSettings={classId === preset.classId ? preset.settings : undefined}
      key={classId}
      onClassChange={setClassId}
      schedules={context.schedules}
      selectedClassId={classId}
      today={FORMS_PREVIEW_TODAY}
    />
  );
}
