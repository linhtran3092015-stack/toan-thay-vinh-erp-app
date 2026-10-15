"use client";

import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  memo,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { PageHeader } from "@/components/patterns/page-header";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Label, Textarea } from "@/components/ui/field";
import {
  createCoachingFormVersionDraftAction,
  publishCoachingFormAction,
  saveCoachingFormDraftAction,
} from "@/features/coaching/actions/coaching-form-actions";
import type { CoachingActionOverrides } from "@/features/coaching/coaching-action-overrides";
import { COACHING_CONNECTION_ERROR_MESSAGE } from "@/features/coaching/coaching-presentation";
import {
  coachingQuestionLabels,
  coachingQuestionTypes,
  defaultQuestion,
  type CoachingQuestionDraft,
  type CoachingQuestionType,
} from "@/features/coaching/forms/coaching-form-types";
import {
  COACHING_MAX_NAME_LENGTH,
  COACHING_MAX_OPTION_LENGTH,
  COACHING_MAX_OPTIONS,
  COACHING_MAX_QUESTION_TITLE_LENGTH,
  COACHING_MAX_QUESTIONS,
  COACHING_MAX_SCALE_LABEL_LENGTH,
  COACHING_MAX_TEXT_LENGTH,
  COACHING_SCALE_BOUNDS,
  getChoiceOptions,
  getQuestionConfigIssues,
  isChoiceQuestion,
  isScaleConfigurationValid,
  normalizeQuestionConfiguration,
} from "@/features/coaching/forms/coaching-question-rules";
import {
  GuardedLink,
  LeaveGuardProvider,
  useLeaveGuard,
  useSaveInFlightGuard,
} from "@/features/settings/components/leave-guard";
import { permissionLabel } from "@/lib/permissions/labels";
import { cn } from "@/lib/utils";

import { CoachingQuestionRenderer, type CoachingRendererQuestion } from "./coaching-question-renderer";
import { PUBLIC_FORM_SUBMIT_NOTE, PublicFormIntro } from "./public-coaching-form-shell";

export interface CoachingFormBuilderProps {
  /** Inert stubs in the /dev preview; the real pages pass nothing. */
  actions?: Pick<
    CoachingActionOverrides,
    "createCoachingFormVersionDraft" | "publishCoachingForm" | "saveCoachingFormDraft"
  >;
  canManage: boolean;
  canPublish: boolean;
  formId: string | null;
  formVersionId: string | null;
  initialInstructions: string;
  initialName: string;
  initialQuestions: CoachingQuestionDraft[];
  initialTitle: string;
  isDraft: boolean;
  /** Back link target; defaults to the forms list. */
  listHref?: string;
  /** Version shown; null for a form that has never been saved (it becomes v1). */
  versionNumber?: number | null;
}

interface EditorQuestion extends CoachingQuestionDraft {
  /** Client-only identity so React keeps each card (and its focus) across moves and deletes. */
  key: string;
}

interface EditorState {
  instructions: string;
  name: string;
  questions: EditorQuestion[];
  title: string;
}

type BuilderResult = { message: string; status: "error" | "success" };

/** What a rejected call reads as: the actions' own error shape, without a formId. */
type ConnectionFailure = { formId?: undefined; message: string; status: "error" };

/**
 * What the banner under the header shows. A server result stays until the
 * next action; a local check ("issues", "empty") is recomputed from the
 * current form and disappears once the problem is fixed.
 */
type BuilderNotice = BuilderResult | { kind: "empty" } | { kind: "issues" };

const PREVIEW_STUDENT = "Tên học sinh";

function toDraft(question: EditorQuestion): CoachingQuestionDraft {
  return {
    configuration: question.configuration,
    description: question.description,
    required: question.required,
    title: question.title,
    type: question.type,
  };
}

function snapshot(state: EditorState): string {
  return JSON.stringify({ ...state, questions: state.questions.map(toDraft) });
}

/**
 * Awaits one server action. A rejected call (a deploy while the tab was open
 * leaves the action id unknown, the network drops, a 5xx that is not an
 * action answer) becomes an error result: a rejected call must not reach the
 * error boundary and wipe what was typed.
 */
async function settle<T extends BuilderResult>(call: () => Promise<T>): Promise<T | ConnectionFailure> {
  try {
    return await call();
  } catch {
    return { message: COACHING_CONNECTION_ERROR_MESSAGE, status: "error" };
  }
}

/** Blank, or a repeat (after trimming) of an earlier option: what the database rejects. */
function isInvalidOptionAt(trimmed: readonly string[], index: number): boolean {
  return trimmed[index] === "" || trimmed.indexOf(trimmed[index]!) !== index;
}

/**
 * Which control of a flagged question takes focus after a failed check: its
 * "Nội dung" when blank, else its first blank or repeated option, else the
 * scale's "Từ"; the question text for anything else.
 */
function firstInvalidPart(question: CoachingQuestionDraft): string {
  if (!question.title.trim()) return "title";
  if (isChoiceQuestion(question.type)) {
    const trimmed = getChoiceOptions(question.configuration).map((option) => option.trim());
    const index = trimmed.findIndex((_, optionIndex) => isInvalidOptionAt(trimmed, optionIndex));
    return index >= 0 ? `option-${index}` : "title";
  }
  return question.type === "scale" ? "min" : "title";
}

/**
 * The preview's question list, skipped while its (deferred) questions are
 * unchanged, so a keystroke in the editor does not wait for the preview.
 */
const PreviewQuestions = memo(CoachingQuestionRenderer);

/**
 * /coaching/forms/[formId] and /coaching/forms/new (design 13c, right
 * canvas). Header: form name, `vN · Nháp|Đang xuất bản`, what publishing
 * changes, "Lưu nháp" and the page's one primary "Xuất bản vN". Two columns
 * from lg: the editor (form fields, numbered question cards with type,
 * "Bắt buộc", order, delete and type settings, then six "Thêm câu hỏi" type
 * buttons) and a sticky "Phụ huynh sẽ thấy" preview that renders the public
 * form's own question component, inert. Below lg the preview follows the
 * editor.
 *
 * Publishing asks first (questions lock; new links use this version, links
 * already sent keep working) and saves unsaved edits before publishing them,
 * so the published version is always what the screen shows. Problems the
 * database would reject (blank or repeated options, scale outside 0–10) are
 * named on their question before anything is sent. A published version is
 * read-only; its action is "Tạo bản nháp phiên bản mới".
 *
 * Unsaved edits: the browser asks before reload/close, and the back link asks
 * through the leave dialog. Sidebar links and browser back are not held (same
 * limits as the settings hub).
 */
export function CoachingFormBuilder(props: CoachingFormBuilderProps) {
  return (
    <LeaveGuardProvider>
      <BuilderScreen {...props} />
    </LeaveGuardProvider>
  );
}

function BuilderScreen({
  actions,
  canManage,
  canPublish,
  formId,
  formVersionId,
  initialInstructions,
  initialName,
  initialQuestions,
  initialTitle,
  isDraft,
  listHref = "/coaching/forms",
  versionNumber = null,
}: CoachingFormBuilderProps) {
  const saveDraft = actions?.saveCoachingFormDraft ?? saveCoachingFormDraftAction;
  const publishForm = actions?.publishCoachingForm ?? publishCoachingFormAction;
  const createDraft = actions?.createCoachingFormVersionDraft ?? createCoachingFormVersionDraftAction;
  const router = useRouter();
  // Initial cards are q0…q(n-1); cards added later continue from n.
  const keyCounter = useRef(initialQuestions.length);
  const nextKey = () => `q${keyCounter.current++}`;

  const [state, setState] = useState<EditorState>(() => ({
    instructions: initialInstructions,
    name: initialName,
    questions: initialQuestions.map((question, index) => ({ ...question, key: `q${index}` })),
    title: initialTitle,
  }));
  const [baseline, setBaseline] = useState(() => snapshot(state));
  const [showIssues, setShowIssues] = useState(false);
  const [result, setResult] = useState<BuilderNotice | null>(null);
  /** The form the first save of /coaching/forms/new created, so later saves update it instead of creating another. */
  const [savedFormId, setSavedFormId] = useState(formId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /** The action the transition runs, so only a running save reads "Đang lưu…" (publishing saves on the way too). */
  const [running, setRunning] = useState<"create" | "publish" | "save" | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const focusResult = useRef(false);
  /**
   * Set when a publish ends in an error. The dialog closes while the
   * transition is still pending, so its own focus return reaches a disabled
   * "Xuất bản vN" and lands on <body>; focus goes back once it is enabled.
   */
  const returnFocusToPublish = useRef(false);
  /** id to focus after the next commit (a new card, a moved arrow, a neighbour of a deleted card). */
  const focusTarget = useRef<string | null>(null);
  const setFocusTarget = (id: string) => {
    focusTarget.current = id;
  };
  const publishRef = useRef<HTMLButtonElement>(null);
  const cancelPublishRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const previewTitleId = useId();
  const previewIdPrefix = useId();
  const confirmTitleId = useId();
  const confirmDescriptionId = useId();
  const addLabelId = useId();
  const questionsHeadingId = useId();

  const readOnly = !isDraft || !canManage;
  const version = versionNumber ?? 1;
  const current = useMemo(() => snapshot(state), [state]);
  const dirty = !readOnly && current !== baseline;
  const nameIssue = state.name.trim() ? null : "Cần nhập tên biểu mẫu.";
  const titleIssue = state.title.trim() ? null : "Cần nhập tiêu đề hiển thị cho phụ huynh.";
  const questionIssues = useMemo(
    () => state.questions.map((question) => getQuestionConfigIssues(question)),
    [state.questions],
  );
  const issueCount =
    (nameIssue ? 1 : 0) + (titleIssue ? 1 : 0) + questionIssues.filter((issues) => issues.length > 0).length;

  const discard = () => {
    const saved = JSON.parse(baseline) as Omit<EditorState, "questions"> & { questions: CoachingQuestionDraft[] };
    setState({ ...saved, questions: saved.questions.map((question) => ({ ...question, key: nextKey() })) });
    setShowIssues(false);
    // "Rời trang" opens the list: a first save's pending redirect to the new form's page must not override it.
    setRedirectTo(null);
  };

  useLeaveGuard(dirty && !pending, discard);
  useSaveInFlightGuard(pending);

  useEffect(() => {
    // After the first save of a new form: open its page once the draft counts as saved.
    if (redirectTo && !dirty) router.replace(redirectTo);
  }, [dirty, redirectTo, router]);

  useEffect(() => {
    if (!focusTarget.current) return;
    document.getElementById(focusTarget.current)?.focus();
    focusTarget.current = null;
  });

  useEffect(() => {
    if (result && focusResult.current) {
      focusResult.current = false;
      resultRef.current?.focus();
    }
  }, [result]);

  useEffect(() => {
    if (pending || !returnFocusToPublish.current) return;
    returnFocusToPublish.current = false;
    publishRef.current?.focus();
  }, [pending]);

  const questionDomId = (key: string, part: string) => `${baseId}-${key}-${part}`;

  const updateQuestion = (key: string, patch: Partial<CoachingQuestionDraft>) =>
    setState((value) => ({
      ...value,
      questions: value.questions.map((question) => (question.key === key ? { ...question, ...patch } : question)),
    }));

  const addQuestion = (type: CoachingQuestionType) => {
    const key = nextKey();
    setState((value) => ({ ...value, questions: [...value.questions, { ...defaultQuestion(type), key }] }));
    setFocusTarget(questionDomId(key, "title"));
  };

  const moveQuestion = (key: string, direction: -1 | 1) => {
    const index = state.questions.findIndex((question) => question.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= state.questions.length) return;
    const questions = [...state.questions];
    [questions[index], questions[target]] = [questions[target]!, questions[index]!];
    setState((value) => ({ ...value, questions }));
    // Keep focus on the arrow that was used, or on the other one once the card reaches an end.
    const reachedEnd = target === 0 || target === questions.length - 1;
    const part = direction === -1 ? (reachedEnd ? "down" : "up") : reachedEnd ? "up" : "down";
    setFocusTarget(questionDomId(key, part));
  };

  const deleteQuestion = (key: string) => {
    const index = state.questions.findIndex((question) => question.key === key);
    const remaining = state.questions.filter((question) => question.key !== key);
    setState((value) => ({ ...value, questions: remaining }));
    const neighbour = remaining[index] ?? remaining[index - 1];
    setFocusTarget(neighbour ? questionDomId(neighbour.key, "title") : `${addLabelId}-first`);
  };

  const payload = () => ({
    formId: savedFormId,
    instructions: state.instructions,
    name: state.name,
    questions: state.questions.map((question) => ({
      ...toDraft(question),
      configuration: normalizeQuestionConfiguration(question),
    })),
    title: state.title,
  });

  /** Moves focus to the first control a failed check names, in screen order. */
  const focusFirstProblem = () => {
    if (nameIssue) {
      nameRef.current?.focus();
    } else if (titleIssue) {
      titleRef.current?.focus();
    } else {
      const question = state.questions[questionIssues.findIndex((issues) => issues.length > 0)];
      if (question) document.getElementById(questionDomId(question.key, firstInvalidPart(question)))?.focus();
    }
  };

  /** Names the problems first and focuses the first one; returns false when something would be rejected. */
  const checkBeforeSending = (forPublish: boolean): boolean => {
    setShowIssues(true);
    if (issueCount > 0) {
      setResult({ kind: "issues" });
      focusFirstProblem();
      return false;
    }
    if (forPublish && state.questions.length === 0) {
      setResult({ kind: "empty" });
      document.getElementById(`${addLabelId}-first`)?.focus();
      return false;
    }
    return true;
  };

  /** Saves the draft; on success the saved copy becomes the new "no changes" baseline. */
  const runSave = async () => {
    const sent = current;
    const saved = await settle(() => saveDraft(payload()));
    if (saved.status === "success") {
      setBaseline(sent);
      if (!formId && saved.formId) {
        setSavedFormId(saved.formId);
        setRedirectTo(`/coaching/forms/${saved.formId}`);
      }
    }
    return saved;
  };

  const save = () => {
    if (pending || !checkBeforeSending(false)) return;
    setResult(null);
    setRunning("save");
    startTransition(async () => {
      const saved = await runSave();
      setResult({ message: saved.message, status: saved.status });
    });
  };

  const openPublish = () => {
    if (pending || !checkBeforeSending(true)) return;
    setResult(null);
    setConfirmOpen(true);
  };

  const publish = () => {
    if (pending || !formVersionId) return;
    setRunning("publish");
    startTransition(async () => {
      const savesFirst = dirty;
      if (savesFirst) {
        const saved = await runSave();
        if (saved.status === "error") {
          setConfirmOpen(false);
          returnFocusToPublish.current = true;
          setResult({ message: `Chưa xuất bản: ${saved.message}`, status: "error" });
          return;
        }
      }
      const published = await settle(() => publishForm(formVersionId));
      setConfirmOpen(false);
      // The publish button leaves the page on success; the result takes focus instead.
      focusResult.current = published.status === "success";
      returnFocusToPublish.current = published.status === "error";
      setResult({
        // The edits were saved on the way: say so, or the person may think they are lost.
        message:
          savesFirst && published.status === "error"
            ? `Đã lưu bản nháp nhưng chưa xuất bản: ${published.message}`
            : published.message,
        status: published.status,
      });
    });
  };

  const startNewVersion = () => {
    if (pending || !formId) return;
    setRunning("create");
    startTransition(async () => {
      const created = await settle(() => createDraft(formId));
      focusResult.current = created.status === "success";
      setResult({ message: created.message, status: created.status });
    });
  };

  // Typing stays responsive: the preview catches up with the questions after the editor has updated.
  const previewSource = useDeferredValue(state.questions);
  const previewQuestions = useMemo<CoachingRendererQuestion[]>(
    () =>
      previewSource.map((question) => ({
        configuration: question.configuration,
        description: question.description.trim() ? question.description : null,
        id: question.key,
        required: question.required,
        title: question.title.trim() || "(Chưa có nội dung câu hỏi)",
        type: question.type,
      })),
    [previewSource],
  );

  const notice: BuilderResult | null = !result
    ? null
    : "status" in result
      ? // "Đã lưu…" must not stay up over edits made since; errors stay until the next action.
        result.status === "success" && dirty
        ? null
        : result
      : result.kind === "issues"
        ? issueCount > 0
          ? { message: `Còn ${issueCount} chỗ cần sửa, được đánh dấu bên dưới.`, status: "error" }
          : null
        : state.questions.length === 0
          ? { message: "Cần có ít nhất một câu hỏi trước khi xuất bản.", status: "error" }
          : null;

  const publishReason = !canPublish
    ? `Cần quyền ${permissionLabel("coaching_forms.publish")}.`
    : !formVersionId
      ? "Lưu nháp lần đầu rồi mới xuất bản được."
      : undefined;

  const headerActions = readOnly ? (
    !isDraft && canManage && formId ? (
      <Button className="max-md:h-11" isLoading={pending} onClick={startNewVersion} variant="secondary">
        Tạo bản nháp phiên bản mới
      </Button>
    ) : undefined
  ) : (
    <>
      <Button className="max-md:h-11" disabled={pending} onClick={save} variant="secondary">
        {pending && running === "save" ? "Đang lưu…" : "Lưu nháp"}
      </Button>
      <Button
        className="max-md:h-11"
        disabled={pending || Boolean(publishReason)}
        disabledReason={publishReason}
        onClick={openPublish}
        ref={publishRef}
      >
        Xuất bản v{version}
      </Button>
    </>
  );

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <nav aria-label="Điều hướng biểu mẫu Coaching" className="text-secondary">
        <GuardedLink
          className="inline-flex min-h-11 items-center gap-1 font-semibold text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus md:min-h-0"
          href={listHref}
        >
          <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
          Biểu mẫu Coaching
        </GuardedLink>
      </nav>

      <PageHeader
        actions={headerActions}
        context={
          formId ? (
            <Badge tone={isDraft ? "neutral" : "success"}>
              v{version} · {isDraft ? "Nháp" : "Đang xuất bản"}
            </Badge>
          ) : (
            <Badge tone="neutral">Bản nháp mới</Badge>
          )
        }
        title={formId ? initialName || "Biểu mẫu chưa đặt tên" : "Tạo biểu mẫu Coaching"}
      >
        <p className="mt-1 break-words text-secondary tabular-nums text-text-muted">
          {[getVersionContext(formId, isDraft, version), `${state.questions.length} câu hỏi`].join(" · ")}
        </p>
      </PageHeader>

      {/* Always present so it can take focus; empty, it must not add a grid row and its gap. */}
      <div
        className="outline-hidden empty:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-border-focus"
        ref={resultRef}
        tabIndex={-1}
      >
        {notice ? (
          <ResultBanner title={notice.message} tone={notice.status === "success" ? "success" : "error"} />
        ) : null}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,390px)]">
        <div className="grid min-w-0 gap-4">
          {readOnly ? (
            <p className="rounded-md border border-info-border bg-info-bg px-3 py-2.5 text-secondary text-info-ink">
              {isDraft
                ? `Bạn chỉ xem được bản nháp này; cần quyền ${permissionLabel("coaching_forms.manage")} để sửa.`
                : "Phiên bản đã xuất bản chỉ đọc; sửa đổi phải tạo bản nháp mới."}
            </p>
          ) : null}

          <EditorCard>
            <div className="grid gap-3">
              <Field
                error={showIssues ? nameIssue : null}
                hint="Chỉ nhân viên thấy: dùng trong danh sách biểu mẫu và khi phát link."
                label="Tên biểu mẫu"
                required
              >
                {(control) => (
                  <Input
                    {...control}
                    disabled={readOnly}
                    maxLength={COACHING_MAX_NAME_LENGTH}
                    onChange={(event) => setState((value) => ({ ...value, name: event.target.value }))}
                    ref={nameRef}
                    value={state.name}
                  />
                )}
              </Field>
              <Field error={showIssues ? titleIssue : null} label="Tiêu đề hiển thị cho phụ huynh" required>
                {(control) => (
                  <Input
                    {...control}
                    disabled={readOnly}
                    maxLength={COACHING_MAX_NAME_LENGTH}
                    onChange={(event) => setState((value) => ({ ...value, title: event.target.value }))}
                    ref={titleRef}
                    value={state.title}
                  />
                )}
              </Field>
              <Field label="Hướng dẫn">
                {(control) => (
                  <Textarea
                    {...control}
                    className="min-h-14"
                    disabled={readOnly}
                    maxLength={COACHING_MAX_TEXT_LENGTH}
                    onChange={(event) => setState((value) => ({ ...value, instructions: event.target.value }))}
                    value={state.instructions}
                  />
                )}
              </Field>
            </div>
          </EditorCard>

          {/* Keeps the heading order: each card's "Câu n" is an h3 under this h2. */}
          <h2 className="sr-only" id={questionsHeadingId}>
            Câu hỏi
          </h2>
          {state.questions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-secondary text-text-muted">
              {readOnly ? "Phiên bản này chưa có câu hỏi nào." : "Chưa có câu hỏi nào. Thêm câu hỏi bằng các nút bên dưới."}
            </p>
          ) : (
            <ol aria-labelledby={questionsHeadingId} className="grid gap-3">
              {state.questions.map((question, index) => (
                <QuestionCard
                  domId={(part) => questionDomId(question.key, part)}
                  index={index}
                  issues={showIssues ? questionIssues[index]! : []}
                  key={question.key}
                  onChange={(patch) => updateQuestion(question.key, patch)}
                  onDelete={() => deleteQuestion(question.key)}
                  onFocus={setFocusTarget}
                  onMove={(direction) => moveQuestion(question.key, direction)}
                  question={question}
                  readOnly={readOnly}
                  total={state.questions.length}
                />
              ))}
            </ol>
          )}

          {readOnly ? null : (
            <div aria-labelledby={addLabelId} className="flex flex-wrap items-center gap-1.5" role="group">
              <span className="mr-1 text-secondary text-text-muted" id={addLabelId}>
                Thêm câu hỏi:
              </span>
              {coachingQuestionTypes.map((type, index) => (
                <Button
                  className="max-md:h-11"
                  disabled={state.questions.length >= COACHING_MAX_QUESTIONS}
                  id={index === 0 ? `${addLabelId}-first` : undefined}
                  key={type}
                  onClick={() => addQuestion(type)}
                  size="sm"
                  variant="secondary"
                >
                  <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
                  {coachingQuestionLabels[type]}
                </Button>
              ))}
              {state.questions.length >= COACHING_MAX_QUESTIONS ? (
                <p className="basis-full text-caption text-text-muted">
                  Đã đủ {COACHING_MAX_QUESTIONS} câu hỏi, số câu tối đa của một phiếu.
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Focusable so a keyboard can scroll the sticky preview (its controls are all disabled). */}
        <section
          aria-labelledby={previewTitleId}
          className="min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus lg:sticky lg:top-[calc(var(--topbar-h)+1rem)] lg:max-h-[calc(100dvh-var(--topbar-h)-2rem)] lg:overflow-y-auto"
          tabIndex={0}
        >
          <h2
            className="border-b border-border-row bg-surface-sunken px-3 py-2.5 text-caption font-semibold text-text-muted"
            id={previewTitleId}
          >
            Phụ huynh sẽ thấy (390px)
          </h2>
          <div className="mx-auto grid w-full max-w-[390px] gap-5 p-4">
            <PublicFormIntro
              instructions={state.instructions.trim() ? state.instructions : null}
              studentName={PREVIEW_STUDENT}
              title={state.title.trim()}
              titleAs="p"
            />
            {previewQuestions.length === 0 ? (
              <p className="text-secondary text-text-muted">Câu hỏi sẽ hiện ở đây.</p>
            ) : (
              <PreviewQuestions idPrefix={previewIdPrefix} mode="preview" questions={previewQuestions} />
            )}
            <div className="grid gap-2">
              <Button className="h-12! w-full" disabled disabledReason="Xem trước — không gửi được." size="lg">
                Gửi phiếu
              </Button>
              <p className="text-center text-caption text-text-muted">{PUBLIC_FORM_SUBMIT_NOTE}</p>
            </div>
          </div>
        </section>
      </div>

      <Dialog
        ariaDescribedBy={confirmDescriptionId}
        ariaLabelledBy={confirmTitleId}
        className="p-5 sm:max-w-md"
        initialFocusRef={cancelPublishRef}
        isOpen={confirmOpen}
        onClose={() => {
          if (!pending) setConfirmOpen(false);
        }}
        returnFocusRef={publishRef}
      >
        <h2 className="text-section-title font-semibold text-text-strong" id={confirmTitleId}>
          Xuất bản v{version}?
        </h2>
        <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-body text-text-default" id={confirmDescriptionId}>
          <li>Câu hỏi của v{version} bị khóa; muốn sửa phải tạo bản nháp phiên bản mới.</li>
          <li>
            Link phát từ nay dùng v{version}
            {version > 1 ? `; link v${version - 1} đã gửi vẫn nộp được.` : "."}
          </li>
          {dirty ? <li>Thay đổi chưa lưu được lưu trước, rồi mới xuất bản.</li> : null}
        </ul>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            className="max-sm:h-11"
            disabled={pending}
            onClick={() => setConfirmOpen(false)}
            ref={cancelPublishRef}
            variant="ghost"
          >
            Hủy
          </Button>
          <Button className="max-sm:h-11" isLoading={pending} onClick={publish}>
            {pending ? "Đang xuất bản…" : `Xuất bản v${version}`}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function getVersionContext(formId: string | null, isDraft: boolean, version: number): string {
  if (!formId) return "Lưu nháp lần đầu để có thể xuất bản và phát link";
  if (!isDraft) return "Câu hỏi đã khóa; link đã phát vẫn nộp được";
  if (version > 1) {
    // While a draft exists the forms list returns only the draft, so the record page cannot issue links for this form until vN is published.
    return `v${version - 1} đang xuất bản (link đã gửi vẫn nộp được) · trong lúc soạn v${version}, chưa phát được link mới cho biểu mẫu này`;
  }
  return "Chưa xuất bản phiên bản nào · phụ huynh chỉ thấy phiếu sau khi xuất bản";
}

function EditorCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-border-subtle bg-surface-base p-4 shadow-[var(--panel-shadow)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

const iconButtonClassName = "max-md:h-11 max-md:w-11";

function QuestionCard({
  domId,
  index,
  issues,
  onChange,
  onDelete,
  onFocus,
  onMove,
  question,
  readOnly,
  total,
}: {
  domId: (part: string) => string;
  index: number;
  issues: string[];
  onChange: (patch: Partial<CoachingQuestionDraft>) => void;
  onDelete: () => void;
  onFocus: (id: string) => void;
  onMove: (direction: -1 | 1) => void;
  question: EditorQuestion;
  readOnly: boolean;
  total: number;
}) {
  const number = index + 1;
  const headingId = domId("heading");
  const issuesId = domId("issues");
  const descriptionId = domId("description");
  const flagged = issues.length > 0;
  const titleInvalid = flagged && !question.title.trim();

  return (
    <li>
      <EditorCard className={cn("grid gap-3", issues.length > 0 && "border-danger-border")}>
        {/* A group, not a section: a named section is a region landmark, one per question. */}
        <div aria-labelledby={headingId} className="grid gap-3" role="group">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-caption font-semibold text-text-muted" id={headingId}>
              Câu {number}
            </h3>
            <Badge tone="neutral">{coachingQuestionLabels[question.type]}</Badge>
            <label className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 text-caption text-text-muted md:min-h-8">
              Bắt buộc<span className="sr-only"> câu {number}</span>
              <input
                checked={question.required}
                className="h-4 w-4 accent-action-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-default"
                disabled={readOnly}
                onChange={(event) => onChange({ required: event.target.checked })}
                type="checkbox"
              />
            </label>
            {readOnly ? null : (
              <div className="flex gap-1">
                <Button
                  aria-label={`Đưa câu ${number} lên`}
                  className={iconButtonClassName}
                  disabled={index === 0}
                  iconOnly
                  id={domId("up")}
                  onClick={() => onMove(-1)}
                  size="sm"
                  variant="ghost"
                >
                  <ArrowUp aria-hidden="true" size={16} strokeWidth={1.8} />
                </Button>
                <Button
                  aria-label={`Đưa câu ${number} xuống`}
                  className={iconButtonClassName}
                  disabled={index === total - 1}
                  iconOnly
                  id={domId("down")}
                  onClick={() => onMove(1)}
                  size="sm"
                  variant="ghost"
                >
                  <ArrowDown aria-hidden="true" size={16} strokeWidth={1.8} />
                </Button>
                <Button
                  aria-label={`Xóa câu ${number}`}
                  className={cn(iconButtonClassName, "text-danger!")}
                  iconOnly
                  onClick={onDelete}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" size={16} strokeWidth={1.8} />
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={domId("title")} required>
              Nội dung<span className="sr-only"> câu {number}</span>
            </Label>
            <Input
              aria-describedby={titleInvalid ? issuesId : undefined}
              aria-invalid={titleInvalid || undefined}
              disabled={readOnly}
              id={domId("title")}
              maxLength={COACHING_MAX_QUESTION_TITLE_LENGTH}
              onChange={(event) => onChange({ title: event.target.value })}
              value={question.title}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={descriptionId}>
              Hướng dẫn<span className="sr-only"> câu {number}</span>
              <span className="font-normal text-text-muted"> (không bắt buộc)</span>
            </Label>
            <Textarea
              className="min-h-11"
              disabled={readOnly}
              id={descriptionId}
              maxLength={COACHING_MAX_TEXT_LENGTH}
              onChange={(event) => onChange({ description: event.target.value })}
              rows={1}
              value={question.description}
            />
          </div>

          {isChoiceQuestion(question.type) ? (
            <ChoiceSettings
              domId={domId}
              issuesId={flagged ? issuesId : undefined}
              number={number}
              onChange={onChange}
              onFocus={onFocus}
              question={question}
              readOnly={readOnly}
            />
          ) : null}
          {question.type === "scale" ? (
            <ScaleSettings
              domId={domId}
              issuesId={flagged ? issuesId : undefined}
              number={number}
              onChange={onChange}
              question={question}
              readOnly={readOnly}
            />
          ) : null}

          {issues.length > 0 ? (
            <ul className="grid gap-1 text-caption font-medium text-danger" id={issuesId}>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </EditorCard>
    </li>
  );
}

function ChoiceSettings({
  domId,
  issuesId,
  number,
  onChange,
  onFocus,
  question,
  readOnly,
}: {
  domId: (part: string) => string;
  /** Set while the question's problems are shown: blank or repeated options point at them. */
  issuesId?: string;
  number: number;
  onChange: (patch: Partial<CoachingQuestionDraft>) => void;
  onFocus: (id: string) => void;
  question: EditorQuestion;
  readOnly: boolean;
}) {
  const options = getChoiceOptions(question.configuration);
  const setOptions = (next: string[]) => onChange({ configuration: { ...question.configuration, options: next } });
  const full = options.length >= COACHING_MAX_OPTIONS;
  const trimmed = options.map((option) => option.trim());
  const isInvalidOption = (index: number) => Boolean(issuesId) && isInvalidOptionAt(trimmed, index);

  return (
    <fieldset className="m-0 grid min-w-0 gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-label font-medium text-text-strong">
        Lựa chọn<span className="sr-only"> của câu {number}</span>
      </legend>
      {options.map((option, optionIndex) => (
        <div className="flex items-center gap-1.5" key={optionIndex}>
          <Input
            aria-describedby={isInvalidOption(optionIndex) ? issuesId : undefined}
            aria-invalid={isInvalidOption(optionIndex) || undefined}
            aria-label={`Lựa chọn ${optionIndex + 1} của câu ${number}`}
            className="md:min-h-8 md:text-secondary"
            disabled={readOnly}
            id={domId(`option-${optionIndex}`)}
            maxLength={COACHING_MAX_OPTION_LENGTH}
            onChange={(event) => setOptions(options.map((item, i) => (i === optionIndex ? event.target.value : item)))}
            value={option}
          />
          {readOnly || options.length <= 1 ? null : (
            <Button
              aria-label={`Xóa lựa chọn ${optionIndex + 1} của câu ${number}`}
              className={iconButtonClassName}
              iconOnly
              onClick={() => {
                setOptions(options.filter((_, i) => i !== optionIndex));
                onFocus(domId(`option-${Math.max(0, optionIndex - 1)}`));
              }}
              size="sm"
              variant="ghost"
            >
              <X aria-hidden="true" size={16} strokeWidth={1.8} />
            </Button>
          )}
        </div>
      ))}
      {readOnly ? null : (
        <div>
          <Button
            // The link colour is important (it beats the global `a` rule), so the disabled colour must be too.
            className="max-md:h-11 text-action-link! disabled:text-text-disabled!"
            disabled={full}
            disabledReason={full ? `Tối đa ${COACHING_MAX_OPTIONS} lựa chọn.` : undefined}
            onClick={() => {
              setOptions([...options, ""]);
              onFocus(domId(`option-${options.length}`));
            }}
            size="sm"
            variant="ghost"
          >
            <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
            Thêm lựa chọn<span className="sr-only"> cho câu {number}</span>
          </Button>
        </div>
      )}
    </fieldset>
  );
}

function ScaleSettings({
  domId,
  issuesId,
  number,
  onChange,
  question,
  readOnly,
}: {
  domId: (part: string) => string;
  /** Set while the question's problems are shown: an invalid range points at them. */
  issuesId?: string;
  number: number;
  onChange: (patch: Partial<CoachingQuestionDraft>) => void;
  question: EditorQuestion;
  readOnly: boolean;
}) {
  const config = question.configuration;
  const set = (key: string, value: unknown) => onChange({ configuration: { ...config, [key]: value } });
  const numberValue = (value: string) => (value === "" ? "" : Number(value));
  const text = (value: unknown) => (typeof value === "number" || typeof value === "string" ? String(value) : "");
  const field = "grid min-w-0 gap-1 text-caption text-text-muted";
  const input = "md:min-h-8 md:text-secondary tabular-nums";
  const rangeInvalid = Boolean(issuesId) && !isScaleConfigurationValid(config);
  const rangeProps = {
    "aria-describedby": rangeInvalid ? issuesId : undefined,
    "aria-invalid": rangeInvalid || undefined,
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <label className={field}>
        <span>
          Từ<span className="sr-only"> (câu {number})</span>
        </span>
        <Input
          {...rangeProps}
          className={input}
          disabled={readOnly}
          id={domId("min")}
          inputMode="numeric"
          max={COACHING_SCALE_BOUNDS.max}
          min={COACHING_SCALE_BOUNDS.min}
          onChange={(event) => set("min", numberValue(event.target.value))}
          step={1}
          type="number"
          value={text(config.min)}
        />
      </label>
      <label className={field}>
        <span>
          Đến<span className="sr-only"> (câu {number})</span>
        </span>
        <Input
          {...rangeProps}
          className={input}
          disabled={readOnly}
          id={domId("max")}
          inputMode="numeric"
          max={COACHING_SCALE_BOUNDS.max}
          min={COACHING_SCALE_BOUNDS.min}
          onChange={(event) => set("max", numberValue(event.target.value))}
          step={1}
          type="number"
          value={text(config.max)}
        />
      </label>
      <label className={field}>
        <span>
          Nhãn thấp<span className="sr-only"> (câu {number})</span>
        </span>
        <Input
          className={input}
          disabled={readOnly}
          maxLength={COACHING_MAX_SCALE_LABEL_LENGTH}
          onChange={(event) => set("minLabel", event.target.value)}
          value={text(config.minLabel)}
        />
      </label>
      <label className={field}>
        <span>
          Nhãn cao<span className="sr-only"> (câu {number})</span>
        </span>
        <Input
          className={input}
          disabled={readOnly}
          maxLength={COACHING_MAX_SCALE_LABEL_LENGTH}
          onChange={(event) => set("maxLabel", event.target.value)}
          value={text(config.maxLabel)}
        />
      </label>
    </div>
  );
}
