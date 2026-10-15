"use client";

import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ErrorState } from "@/components/shared/error-state";
import type { CoachingActionOverrides } from "@/features/coaching/coaching-action-overrides";
import { CoachingDetailPage } from "@/features/coaching/coaching-detail-page";
import type {
  CoachingFormSummary,
  CoachingPublicLinkSummary,
  CoachingRecordResponseSummary,
} from "@/features/coaching/coaching-form-data";
import { CoachingFormBuilder, type CoachingFormBuilderProps } from "@/features/coaching/components/coaching-form-builder";
import { PublicCoachingForm } from "@/features/coaching/components/public-coaching-form";
import {
  getStudentGivenName,
  PublicCoachingFormState,
} from "@/features/coaching/components/public-coaching-form-shell";
import type { CoachingQuestionDraft, PublicCoachingQuestion } from "@/features/coaching/forms/coaching-form-types";
import type { CoachingRecordDashboardEntry, CoachingRecordEvent } from "@/features/coaching/read-models";
import type { PermissionCode } from "@/lib/permissions/types";

export type CoachingPreviewView = "record" | "builder" | "public";
export type CoachingPreviewRole = "manager" | "editor" | "viewer";
export type CoachingRecordPreviewState = "in_progress" | "open" | "closed" | "empty" | "error";
export type CoachingBuilderPreviewState = "draft" | "first" | "published" | "new" | "error";
/** "unavailable": the page could not read the link (retryable), not a link state. */
export type CoachingPublicPreviewState = "active" | "submitted" | "expired" | "revoked" | "invalid" | "unavailable";

export type CoachingPreviewProps = { role: CoachingPreviewRole } & (
  | { state: CoachingRecordPreviewState; view: "record" }
  | { state: CoachingBuilderPreviewState; view: "builder" }
  | { state: CoachingPublicPreviewState; view: "public" }
);

const STUB = "Bản xem trước không ghi dữ liệu.";

const stub = async (): Promise<{ message: string; status: "error" }> => ({ message: STUB, status: "error" });

/**
 * Inert stand-ins for every Coaching server action (record notes and status,
 * form drafts and publishing, public links, the parent's submission). The
 * preview runs on localhost where .env.local may point at production, so no
 * control may reach a server action: each answers with the stub message,
 * which is the error shape of all three Coaching action modules.
 */
export const previewCoachingActions: Required<CoachingActionOverrides> = {
  addCoachingNote: stub,
  advanceCoachingStatus: stub,
  createCoachingFormVersionDraft: stub,
  createCoachingRecord: stub,
  issueCoachingPublicLink: stub,
  publishCoachingForm: stub,
  revokeCoachingPublicLink: stub,
  saveCoachingFormDraft: stub,
  submitPublicCoachingForm: stub,
};

/** Fixed ids with a per-feature prefix so fixtures never collide with other previews. */
const id = (n: number) => `d1100000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const IDS = {
  draftVersion: id(14),
  firstVersion: id(15),
  form: id(10),
  owner: id(2),
  publishedVersion: id(11),
  record: id(1),
  student: id(3),
  supersededVersion: id(12),
} as const;

const OWNER_NAME = "Phạm Thu Hạnh";
const STUDENT_NAME = "Bùi Quang Minh";
const FORM_NAME = "Phiếu tự đánh giá tháng";
const FORM_TITLE = "Con học tháng này thế nào?";
const FORM_INSTRUCTIONS =
  "Phụ huynh và con cùng trả lời, mất khoảng 3 phút. Thông tin chỉ dùng để trung tâm hỗ trợ con tốt hơn.";
const OUTCOME = "Đồng ý học thêm 1 buổi bổ trợ hình/tuần từ 20/10";

const basePermissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "notifications.view",
  "students.view",
];

const rolePermissions: Record<CoachingPreviewRole, readonly PermissionCode[]> = {
  /** Quản lý: records events, issues links, edits and publishes forms, reads responses. */
  manager: [
    ...basePermissions,
    "coaching.view",
    "coaching.manage",
    "coaching_links.manage",
    "coaching_forms.view",
    "coaching_forms.manage",
    "coaching_forms.publish",
    "coaching_responses.view",
  ],
  /** Soạn biểu mẫu: edits forms and reads responses, but cannot publish, issue links or record events. */
  editor: [
    ...basePermissions,
    "coaching.view",
    "coaching_forms.view",
    "coaching_forms.manage",
    "coaching_responses.view",
  ],
  /** Chỉ xem. */
  viewer: [...basePermissions, "coaching.view", "coaching_forms.view"],
};

const roleUsers: Record<CoachingPreviewRole, string> = {
  editor: OWNER_NAME,
  manager: "Nguyễn Văn Vinh",
  viewer: "Đặng Phương Thảo",
};

const questionDrafts: CoachingQuestionDraft[] = [
  {
    configuration: { max: 5, maxLabel: "Rất tự tin", min: 1, minLabel: "Chưa tự tin" },
    description: "",
    required: true,
    title: "Con cảm thấy tự tin với môn Toán ở mức nào?",
    type: "scale",
  },
  {
    configuration: { options: ["Hình học", "Đại số", "Bài tập về nhà quá nhiều"] },
    description: "",
    required: false,
    title: "Phần nào con thấy khó?",
    type: "multiple_choice",
  },
  {
    configuration: {},
    description: "",
    required: false,
    title: "Phụ huynh muốn trung tâm lưu ý điều gì?",
    type: "long_text",
  },
  {
    configuration: {},
    description: "",
    required: false,
    title: "Con muốn cải thiện thêm điều gì trong tháng tới?",
    type: "short_text",
  },
  {
    configuration: { options: ["Buổi tối trong tuần", "Cuối tuần"] },
    description: "",
    required: false,
    title: "Con học hiệu quả nhất vào buổi nào?",
    type: "single_choice",
  },
  {
    configuration: { max: 40, min: 0 },
    description: "",
    required: false,
    title: "Mỗi tuần con làm bài tập về nhà khoảng mấy giờ?",
    type: "number",
  },
];

const publicQuestions: PublicCoachingQuestion[] = questionDrafts.map((question, index) => ({
  ...question,
  description: question.description || null,
  id: id(50 + index),
}));

const publishedForm: CoachingFormSummary = {
  formId: IDS.form,
  formStatus: "active",
  name: FORM_NAME,
  publishedAt: "2026-10-01T02:00:00Z",
  responseCount: 18,
  title: FORM_TITLE,
  versionId: IDS.publishedVersion,
  versionNumber: 3,
  versionStatus: "published",
};

const publicLinks: CoachingPublicLinkSummary[] = [
  {
    expiresAt: "2026-10-17T16:59:00Z",
    formName: FORM_NAME,
    formVersionId: IDS.publishedVersion,
    id: id(31),
    issuedAt: "2026-10-10T03:00:00Z",
    revokeReason: null,
    revokedAt: null,
    status: "active",
    versionNumber: 3,
  },
  {
    expiresAt: "2026-10-06T16:59:00Z",
    formName: FORM_NAME,
    formVersionId: IDS.publishedVersion,
    id: id(32),
    issuedAt: "2026-10-05T03:00:00Z",
    revokeReason: "Gửi nhầm cho phụ huynh khác",
    revokedAt: "2026-10-05T04:30:00Z",
    status: "revoked",
    versionNumber: 3,
  },
  {
    expiresAt: "2026-09-19T16:59:00Z",
    formName: FORM_NAME,
    formVersionId: IDS.supersededVersion,
    id: id(33),
    issuedAt: "2026-09-12T03:00:00Z",
    revokeReason: null,
    revokedAt: null,
    status: "submitted",
    versionNumber: 2,
  },
];

const responses: CoachingRecordResponseSummary[] = [
  {
    formName: FORM_NAME,
    id: id(40),
    studentName: STUDENT_NAME,
    submittedAt: "2026-09-14T14:10:00Z",
    versionNumber: 2,
  },
];

/** Oldest first, as the RPC returns them (event_sequence). */
const events: Record<"closed" | "noted" | "opened" | "started", CoachingRecordEvent> = {
  closed: {
    eventType: "outcome_recorded",
    id: id(24),
    note: null,
    occurredAt: "2026-10-13T03:20:00Z",
    occurredByDisplayName: OWNER_NAME,
    outcome: OUTCOME,
    status: "closed",
  },
  noted: {
    eventType: "note_added",
    id: id(23),
    note: "Em áp lực thi vào 10, ngủ muộn",
    occurredAt: "2026-09-28T03:00:00Z",
    occurredByDisplayName: OWNER_NAME,
    outcome: null,
    status: null,
  },
  opened: {
    eventType: "opened",
    id: id(21),
    note: null,
    occurredAt: "2026-09-20T02:00:00Z",
    occurredByDisplayName: OWNER_NAME,
    outcome: null,
    status: "open",
  },
  started: {
    eventType: "status_changed",
    id: id(22),
    note: "Đã gọi phụ huynh, thống nhất trao đổi hằng tuần qua Zalo",
    occurredAt: "2026-09-22T03:00:00Z",
    occurredByDisplayName: OWNER_NAME,
    outcome: null,
    status: "in_progress",
  },
};

type RecordFixtureState = Exclude<CoachingRecordPreviewState, "error">;

const recordHistory: Record<RecordFixtureState, CoachingRecordEvent[]> = {
  closed: [events.opened, events.started, events.noted, events.closed],
  empty: [events.opened],
  in_progress: [events.opened, events.started, events.noted],
  open: [events.opened],
};

const recordStatus: Record<RecordFixtureState, string> = {
  closed: "closed",
  empty: "open",
  in_progress: "in_progress",
  open: "open",
};

function recordFor(state: RecordFixtureState): CoachingRecordDashboardEntry {
  const history = recordHistory[state];
  return {
    assistantOwnerDisplayName: OWNER_NAME,
    assistantOwnerId: IDS.owner,
    campaignName: "Theo sát HS lớp 9",
    currentStatus: recordStatus[state],
    id: IDS.record,
    latestEventAt: history[history.length - 1]?.occurredAt ?? null,
    latestOutcome: state === "closed" ? OUTCOME : null,
    openedAt: events.opened.occurredAt,
    priority: "high",
    reason:
      "Điểm giảm liên tục 3 tuần\nKiểm tra 15 phút: 8 → 6,5 → 5\nVắng 2 buổi tối, phụ huynh chưa phản hồi tin nhắn Zalo.",
    reviewAt: "2026-10-20",
    studentFullName: STUDENT_NAME,
    studentId: IDS.student,
    studentPublicCode: "TTV-00117",
  };
}

type BuilderFixtureState = Exclude<CoachingBuilderPreviewState, "error">;

type BuilderFixture = Pick<
  CoachingFormBuilderProps,
  | "formId"
  | "formVersionId"
  | "initialInstructions"
  | "initialName"
  | "initialQuestions"
  | "initialTitle"
  | "isDraft"
  | "versionNumber"
>;

const filledBuilder = { initialInstructions: FORM_INSTRUCTIONS, initialName: FORM_NAME, initialQuestions: questionDrafts, initialTitle: FORM_TITLE };

const builderFixtures: Record<BuilderFixtureState, BuilderFixture> = {
  /** v4 draft over the published v3. */
  draft: { ...filledBuilder, formId: IDS.form, formVersionId: IDS.draftVersion, isDraft: true, versionNumber: 4 },
  /** The first draft of a form: nothing published yet. */
  first: { ...filledBuilder, formId: IDS.form, formVersionId: IDS.firstVersion, isDraft: true, versionNumber: 1 },
  /** Never saved: no form, no version. */
  new: {
    formId: null,
    formVersionId: null,
    initialInstructions: "",
    initialName: "",
    initialQuestions: [],
    initialTitle: "",
    isDraft: true,
    versionNumber: null,
  },
  /** Read-only published v3 (its action is "Tạo bản nháp phiên bản mới"). */
  published: { ...filledBuilder, formId: IDS.form, formVersionId: IDS.publishedVersion, isDraft: false, versionNumber: 3 },
};

function PreviewShell({ children, pathname, role }: { children: ReactNode; pathname: string; role: CoachingPreviewRole }) {
  const name = roleUsers[role];
  return (
    <AppShell
      authUser={{ displayName: name, email: "preview@example.com", id: "dev-user", initials: name.split(" ").map((part) => part[0]).slice(-2).join("") }}
      centerDisplayName="Toán Thầy Vinh"
      permissions={rolePermissions[role]}
      previewPathname={pathname}
      unreadNotificationCount={3}
    >
      {children}
    </AppShell>
  );
}

function RecordPreview({ role, state }: { role: CoachingPreviewRole; state: CoachingRecordPreviewState }) {
  const can = (code: PermissionCode) => rolePermissions[role].includes(code);
  const canManageLinks = can("coaching_links.manage");
  const canViewResponses = can("coaching_responses.view");

  return (
    <PreviewShell pathname={`/coaching/${IDS.record}`} role={role}>
      {state === "error" ? (
        <ErrorState description="Không tải được phiếu Coaching." />
      ) : (
        <CoachingDetailPage
          actions={previewCoachingActions}
          canManage={can("coaching.manage")}
          canManageLinks={canManageLinks}
          canViewResponses={canViewResponses}
          events={recordHistory[state]}
          forms={can("coaching_forms.view") ? [publishedForm] : []}
          links={canManageLinks && state !== "empty" ? publicLinks : []}
          listHref="/dev/coaching?view=record"
          record={recordFor(state)}
          responses={canViewResponses && state !== "empty" ? responses : []}
        />
      )}
    </PreviewShell>
  );
}

function BuilderPreview({ role, state }: { role: CoachingPreviewRole; state: CoachingBuilderPreviewState }) {
  const can = (code: PermissionCode) => rolePermissions[role].includes(code);

  return (
    <PreviewShell pathname={state === "new" ? "/coaching/forms/new" : `/coaching/forms/${IDS.form}`} role={role}>
      {state === "error" ? (
        <ErrorState description="Không tải được biểu mẫu Coaching." />
      ) : (
        <CoachingFormBuilder
          {...builderFixtures[state]}
          actions={previewCoachingActions}
          canManage={can("coaching_forms.manage")}
          canPublish={can("coaching_forms.publish")}
          // A new key per fixture so switching states in the URL never carries editor state over.
          key={state}
          listHref="/dev/coaching?view=builder"
        />
      )}
    </PreviewShell>
  );
}

/** Not a placeholder: any 32+ character token is fine because the stub never reads it. */
const PREVIEW_TOKEN = "preview-token-preview-token-preview-token";

function PublicPreview({ state }: { state: CoachingPublicPreviewState }) {
  // The real route sits outside the app shell: no session, no chrome.
  if (state !== "active") {
    // "Tải lại trang" reloads this preview, as the real screen reloads its own token page.
    return <PublicCoachingFormState reloadHref="/dev/coaching?view=public&state=unavailable" state={state} />;
  }

  return (
    <PublicCoachingForm
      action={previewCoachingActions.submitPublicCoachingForm}
      instructions={FORM_INSTRUCTIONS}
      questions={publicQuestions}
      // As the route does: the public page shows the given name only.
      studentName={getStudentGivenName(STUDENT_NAME)}
      title={FORM_TITLE}
      token={PREVIEW_TOKEN}
    />
  );
}

export function CoachingPreview(props: CoachingPreviewProps) {
  if (props.view === "builder") {
    return <BuilderPreview role={props.role} state={props.state} />;
  }

  if (props.view === "public") {
    return <PublicPreview state={props.state} />;
  }

  return <RecordPreview role={props.role} state={props.state} />;
}
