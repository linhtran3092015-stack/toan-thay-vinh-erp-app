"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition, type RefObject } from "react";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { controlClassName } from "@/components/ui/field";
import {
  issueCoachingPublicLinkAction,
  revokeCoachingPublicLinkAction,
} from "@/features/coaching/actions/coaching-form-actions";
import type { CoachingActionOverrides } from "@/features/coaching/coaching-action-overrides";
import type { CoachingFormSummary, CoachingPublicLinkSummary } from "@/features/coaching/coaching-form-data";
import {
  COACHING_CONNECTION_ERROR_MESSAGE,
  formatCoachingDateTimeLocal,
  formatCoachingShortDateTime,
  parseCoachingDateTimeLocal,
} from "@/features/coaching/coaching-presentation";
import { COACHING_MAX_REVOKE_REASON_LENGTH } from "@/features/coaching/forms/coaching-question-rules";
import { permissionLabel } from "@/lib/permissions/labels";
import { cn } from "@/lib/utils";

interface CoachingPublicLinkPanelProps {
  /** Inert stubs in the /dev preview; the real page passes nothing. */
  actions?: Pick<CoachingActionOverrides, "issueCoachingPublicLink" | "revokeCoachingPublicLink">;
  /** coaching_forms.view: without it the route loads no forms, so "no published form" would name the wrong cause. */
  canViewForms?: boolean;
  coachingRecordId: string;
  defaultExpiryDays?: number;
  forms: CoachingFormSummary[];
  /** The permitted forms loader failed (returned null): the version picker cannot be offered. */
  formsUnavailable?: boolean;
  links?: CoachingPublicLinkSummary[];
  /**
   * The history could not be loaded (the loader returned null). An empty list
   * would then read as "no link yet" and invite issuing one, which silently
   * revokes the parent's real active link for that version; issuing is
   * therefore unavailable until a reload.
   */
  linksUnavailable?: boolean;
}

/** `focus` moves focus to the status line once the message is on screen (after a revoke removes the form). */
type PanelMessage = { focus?: boolean; text: string; tone: "error" | "success" };

const linkStatus: Record<CoachingPublicLinkSummary["status"], { label: string; tone: BadgeTone }> = {
  active: { label: "Đang hoạt động · chưa nộp", tone: "warning" },
  revoked: { label: "Đã thu hồi", tone: "neutral" },
  submitted: { label: "Đã nộp", tone: "success" },
};

const NO_REASON = "Cần nêu lý do thu hồi liên kết.";
/** Shown once, in the history area; the disabled "Phát link mới" points at it as its reason. */
const LINKS_UNAVAILABLE_MESSAGE = "Không tải được lịch sử liên kết. Tải lại trang trước khi phát link mới.";

/**
 * Now + `days` as the "Hết hạn lúc" value, in Vietnam time on the server (UTC)
 * and in the browser alike: the runtime's own zone made the server-rendered
 * field 7 hours off the state that hydration then issued with.
 */
function defaultExpiry(days: number): string {
  return formatCoachingDateTimeLocal(new Date(Date.now() + days * 86_400_000));
}

/**
 * "Link phiếu công khai" on the Coaching record (design 13c). "Phát link mới"
 * opens the create form (open from the start while no link exists); it is
 * disabled when the history failed to load, and the form names a missing
 * coaching_forms.view, a forms list that failed to load or a draft hiding a
 * published version instead of the publish hint. Issuing replaces the
 * student's active link for the same form version on any Coaching record
 * (issue_coaching_public_link revokes it; one active link per student and
 * version), so the form says so before "Tạo liên kết": the exact link when it
 * is this record's, otherwise a line covering other records. The new link's
 * URL is shown once in a read-only field with "Sao chép liên kết": tokens are
 * stored only as hashes, so older rows cannot be copied again. Each row shows
 * the form version, issue/expiry times and its status in words; an active row
 * can be revoked after writing a reason, which stays in the history. Every
 * result, including a call that never reached the server, is announced in the
 * panel's single status line.
 */
export function CoachingPublicLinkPanel({
  actions,
  canViewForms = true,
  coachingRecordId,
  defaultExpiryDays = 7,
  forms,
  formsUnavailable = false,
  links = [],
  linksUnavailable = false,
}: CoachingPublicLinkPanelProps) {
  const issueLink = actions?.issueCoachingPublicLink ?? issueCoachingPublicLinkAction;
  const revokeLink = actions?.revokeCoachingPublicLink ?? revokeCoachingPublicLinkAction;
  const published = forms.filter((form) => form.versionStatus === "published");
  // get_coaching_forms returns only each form's latest version: a draft v4 hides the published v3 from the picker.
  const hiddenByDraft = forms.filter((form) => form.versionStatus === "draft" && form.versionNumber > 1);
  const titleId = useId();
  const createId = useId();
  const versionFieldId = useId();
  const expiryFieldId = useId();
  const replaceNoteId = useId();
  const draftNoteId = useId();
  const linksErrorId = useId();
  const [createOpen, setCreateOpen] = useState(links.length === 0 && !linksUnavailable);
  const [chosenVersionId, setVersionId] = useState(published[0]?.versionId ?? "");
  // The forms list can change under the panel (a refresh after publishing): fall back to the first published version.
  const versionId = published.some((form) => form.versionId === chosenVersionId)
    ? chosenVersionId
    : (published[0]?.versionId ?? "");
  const selectedForm = published.find((form) => form.versionId === versionId);
  const replacedLink = links.find((link) => link.status === "active" && link.formVersionId === versionId);
  const [expiresAt, setExpiresAt] = useState(() => defaultExpiry(defaultExpiryDays));
  const [message, setMessage] = useState<PanelMessage | null>(null);
  const [issuedUrl, setIssuedUrl] = useState("");
  // The issue action returns no link id; the RPC keeps one active link per student and version, so the version identifies it.
  const [issuedVersionId, setIssuedVersionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [reasonError, setReasonError] = useState<string | null>(null);
  // Which call the shared transition is running, so only its button shows the spinner.
  const [running, setRunning] = useState<"issue" | "revoke" | null>(null);
  const [pending, startTransition] = useTransition();
  // Without the history the panel cannot tell what issuing would replace: no create form at all.
  const showCreate = createOpen && !linksUnavailable;
  const reasonRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  // Row whose "Thu hồi" button takes focus back when it remounts after "Hủy".
  const returnFocusToRef = useRef<string | null>(null);

  useEffect(() => {
    if (revokingId) reasonRef.current?.focus();
  }, [revokingId]);

  useEffect(() => {
    if (message?.focus) statusRef.current?.focus();
  }, [message]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const issue = () => {
    // The field holds Vietnam wall time whatever the browser's zone (see defaultExpiry).
    const expiry = parseCoachingDateTimeLocal(expiresAt);
    if (!expiry) {
      setMessage({ text: "Cần chọn thời hạn cho liên kết.", tone: "error" });
      return;
    }
    const formVersionId = versionId;
    setRunning("issue");
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof issueLink>>;
      try {
        result = await issueLink({ coachingRecordId, expiresAt: expiry.toISOString(), formVersionId });
      } catch {
        // A rejected call (deploy skew, offline, a non-RSC 5xx) must not reach the error boundary; the form keeps its choices.
        result = { message: COACHING_CONNECTION_ERROR_MESSAGE, status: "error" };
      }
      setMessage({ text: result.message, tone: result.status === "success" ? "success" : "error" });
      setCopied(false);
      if (result.linkUrl) {
        setIssuedUrl(`${window.location.origin}${result.linkUrl}`);
        setIssuedVersionId(formVersionId);
      }
    });
  };

  const copy = () => {
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (!clipboard) {
      setMessage({ text: "Trình duyệt không cho sao chép tự động. Hãy chọn liên kết và sao chép thủ công.", tone: "error" });
      return;
    }
    clipboard.writeText(issuedUrl).then(
      () => {
        setCopied(true);
        setMessage({ text: "Đã sao chép liên kết.", tone: "success" });
      },
      () => {
        setCopied(false);
        setMessage({ text: "Không sao chép được. Hãy chọn liên kết và sao chép thủ công.", tone: "error" });
      },
    );
  };

  const revoke = (linkId: string) => {
    // Enter in the reason field reaches here too; one revoke per confirmation.
    if (pending) return;
    const reason = reasons[linkId]?.trim() ?? "";
    if (!reason) {
      setReasonError(NO_REASON);
      setMessage({ text: NO_REASON, tone: "error" });
      reasonRef.current?.focus();
      return;
    }
    setReasonError(null);
    const revokedVersionId = links.find((link) => link.id === linkId)?.formVersionId;
    setRunning("revoke");
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof revokeLink>>;
      try {
        result = await revokeLink({ coachingRecordId, linkId, reason });
      } catch {
        // As in issue(): the form stays open with the typed reason, ready to retry.
        result = { message: COACHING_CONNECTION_ERROR_MESSAGE, status: "error" };
      }
      const succeeded = result.status === "success";
      // The form (and the focus in it) goes away on success: the status line takes the focus.
      setMessage({ focus: succeeded, text: result.message, tone: succeeded ? "success" : "error" });
      if (!succeeded) return;
      setRevokingId(null);
      // The one-time URL box must not keep offering a link that no longer opens.
      if (revokedVersionId && revokedVersionId === issuedVersionId) {
        setIssuedUrl("");
        setIssuedVersionId(null);
        setCopied(false);
      }
    });
  };

  const startRevoke = (linkId: string) => {
    setRevokingId(linkId);
    setReasonError(null);
  };

  const cancelRevoke = () => {
    returnFocusToRef.current = revokingId;
    setRevokingId(null);
    setReasonError(null);
  };

  return (
    <section
      aria-labelledby={titleId}
      className="min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-row px-4 py-3">
        <h2 className="text-body font-semibold text-text-strong" id={titleId}>
          Link phiếu công khai
        </h2>
        <Button
          aria-controls={showCreate ? createId : undefined}
          aria-expanded={showCreate}
          className="max-md:h-11"
          // The history line below is the visible reason; a disabledReason caption would repeat it.
          aria-describedby={linksUnavailable ? linksErrorId : undefined}
          disabled={linksUnavailable}
          onClick={() => setCreateOpen((open) => !open)}
          size="sm"
          variant="secondary"
        >
          Phát link mới
        </Button>
      </div>

      <p
        className={cn(
          "px-4 text-secondary outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-border-focus",
          message ? "pt-3" : null,
          message?.tone === "error" ? "font-medium text-danger" : "text-success-ink",
        )}
        ref={statusRef}
        role="status"
        tabIndex={-1}
      >
        {message?.text}
      </p>

      {showCreate ? (
        <div className="grid gap-3 border-b border-border-row px-4 py-3" id={createId}>
          <p className="text-secondary text-text-muted">
            Liên kết chỉ dùng một lần, có thời hạn và gắn với học viên của phiếu này.
          </p>
          {/* No version to offer has four causes, named in this order: no coaching_forms.view, a forms list that
              failed to load, a draft above v1 hiding the published version, and only then "publish a form first". */}
          {!canViewForms ? (
            <p className="text-secondary text-text-default">
              Cần quyền {permissionLabel("coaching_forms.view")} để chọn phiên bản khi phát link.
            </p>
          ) : formsUnavailable ? (
            <p className="text-secondary font-medium text-danger">
              Không tải được danh sách biểu mẫu. Tải lại trang để phát link.
            </p>
          ) : published.length === 0 ? (
            hiddenByDraft.length > 0 ? (
              <DraftVersionNotes className="text-text-default" forms={hiddenByDraft} />
            ) : (
              <p className="text-secondary text-text-default">Cần xuất bản ít nhất một biểu mẫu trước khi tạo liên kết.</p>
            )
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-label font-medium text-text-strong" htmlFor={versionFieldId}>
                    Phiên bản biểu mẫu
                  </label>
                  <select
                    aria-describedby={hiddenByDraft.length > 0 ? draftNoteId : undefined}
                    className={controlClassName}
                    id={versionFieldId}
                    onChange={(event) => setVersionId(event.target.value)}
                    value={versionId}
                  >
                    {published.map((form) => (
                      <option key={form.versionId} value={form.versionId}>
                        {form.name} · v{form.versionNumber}
                      </option>
                    ))}
                  </select>
                  {hiddenByDraft.length > 0 ? (
                    <DraftVersionNotes className="text-text-muted" forms={hiddenByDraft} id={draftNoteId} />
                  ) : null}
                </div>
                <div className="grid gap-1.5">
                  <label className="text-label font-medium text-text-strong" htmlFor={expiryFieldId}>
                    Hết hạn lúc
                  </label>
                  <input
                    className={cn(controlClassName, "tabular-nums")}
                    id={expiryFieldId}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    required
                    type="datetime-local"
                    value={expiresAt}
                  />
                </div>
              </div>
              {/* Lowercase "đang hoạt động" / "hoạt động": the row badge stays the only "Đang hoạt động" on the panel. */}
              {replacedLink ? (
                <p
                  className="rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-secondary text-warning-ink"
                  id={replaceNoteId}
                >
                  Link v{replacedLink.versionNumber} đang hoạt động (phát{" "}
                  {formatCoachingShortDateTime(replacedLink.issuedAt)}) sẽ bị thu hồi và thay bằng link mới.
                </p>
              ) : selectedForm ? (
                // The unique index is per student and version across records; this panel only sees its own links.
                <p className="text-secondary text-text-muted" id={replaceNoteId}>
                  Nếu học sinh đang có link v{selectedForm.versionNumber} hoạt động ở phiếu Coaching khác, link đó sẽ bị
                  thu hồi.
                </p>
              ) : null}
              <div>
                <Button
                  aria-describedby={replacedLink || selectedForm ? replaceNoteId : undefined}
                  className="max-md:h-11"
                  disabled={pending}
                  isLoading={pending && running === "issue"}
                  onClick={issue}
                  variant="secondary"
                >
                  Tạo liên kết
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {issuedUrl ? (
        <div className="grid gap-2 border-b border-border-row bg-surface-raised px-4 py-3">
          <p className="text-secondary font-medium text-text-strong">Liên kết vừa tạo (chỉ hiện một lần)</p>
          {/* A focusable field so the URL can be selected and copied by hand when the clipboard is refused. */}
          <input
            aria-label="Liên kết vừa tạo"
            className={cn(controlClassName, "font-mono")}
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={issuedUrl}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button className="max-md:h-11" onClick={copy} size="sm" variant="secondary">
              <Copy aria-hidden="true" size={16} strokeWidth={1.8} />
              Sao chép liên kết
            </Button>
            {copied ? (
              <span aria-hidden="true" className="inline-flex items-center gap-1 text-caption font-medium text-success">
                <Check size={14} strokeWidth={2} />
                Đã sao chép
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <h3 className="px-4 pb-1 pt-3 text-caption font-semibold text-text-muted">Lịch sử liên kết</h3>
      {linksUnavailable ? (
        <p className="px-4 pb-3 text-secondary font-medium text-danger" id={linksErrorId}>
          {LINKS_UNAVAILABLE_MESSAGE}
        </p>
      ) : links.length === 0 ? (
        <p className="px-4 pb-3 text-secondary text-text-muted">Chưa phát hành liên kết nào.</p>
      ) : (
        <ul className="grid">
          {links.map((link) => {
            // Object.hasOwn: a status such as "constructor" must not read a prototype member.
            const status = Object.hasOwn(linkStatus, link.status) ? linkStatus[link.status] : null;
            const rowTitleId = `${titleId}-${link.id}`;
            const isRevoking = revokingId === link.id;
            return (
              <li className="grid gap-2 border-b border-border-row px-4 py-3 last:border-b-0" key={link.id}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {/* A real basis: with flex-1 (0 basis) the title shrank to ~32px at 375px instead of wrapping the badge below. */}
                  <div className="min-w-0 flex-[1_1_14rem] text-secondary">
                    <p className="font-semibold text-text-strong" id={rowTitleId}>
                      {link.formName} · v{link.versionNumber}
                    </p>
                    <p className="tabular-nums text-text-muted">
                      phát {formatCoachingShortDateTime(link.issuedAt)} · hết hạn{" "}
                      {formatCoachingShortDateTime(link.expiresAt)}
                      {link.revokedAt ? ` · thu hồi ${formatCoachingShortDateTime(link.revokedAt)}` : null}
                    </p>
                  </div>
                  {status ? (
                    <Badge tone={status.tone}>{status.label}</Badge>
                  ) : (
                    <Badge tone="neutral">Trạng thái chưa hỗ trợ: {link.status}</Badge>
                  )}
                  {link.status === "active" && !isRevoking ? (
                    <Button
                      aria-describedby={rowTitleId}
                      className="max-md:h-11"
                      disabled={pending}
                      onClick={() => startRevoke(link.id)}
                      ref={(node) => {
                        if (node && returnFocusToRef.current === link.id) {
                          returnFocusToRef.current = null;
                          node.focus();
                        }
                      }}
                      size="sm"
                      variant="danger-outline"
                    >
                      Thu hồi
                    </Button>
                  ) : null}
                </div>
                {link.status === "revoked" && link.revokeReason ? (
                  <p className="whitespace-pre-wrap break-words text-secondary text-text-muted">
                    Lý do thu hồi: {link.revokeReason}
                  </p>
                ) : null}
                {link.status === "active" && isRevoking ? (
                  <RevokeForm
                    error={reasonError}
                    inputRef={reasonRef}
                    linkId={link.id}
                    loading={pending && running === "revoke"}
                    onCancel={cancelRevoke}
                    onChange={(value) => setReasons((current) => ({ ...current, [link.id]: value }))}
                    onConfirm={() => revoke(link.id)}
                    pending={pending}
                    value={reasons[link.id] ?? ""}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** One line per form whose draft (v2 or later) hides its published version from the picker. */
function DraftVersionNotes({
  className,
  forms,
  id,
}: {
  className: string;
  forms: readonly CoachingFormSummary[];
  id?: string;
}) {
  return (
    <div className={cn("grid gap-0.5 text-secondary", className)} id={id}>
      {forms.map((form) => (
        <p key={form.versionId}>
          «{form.name}» đang soạn v{form.versionNumber}: chỉ phát được link mới sau khi xuất bản v{form.versionNumber}.
        </p>
      ))}
    </div>
  );
}

function RevokeForm({
  error,
  inputRef,
  linkId,
  loading,
  onCancel,
  onChange,
  onConfirm,
  pending,
  value,
}: {
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  linkId: string;
  /** This revoke is running: spinner on the confirm button (its name stays "Thu hồi"). */
  loading: boolean;
  onCancel: () => void;
  onChange: (value: string) => void;
  onConfirm: () => void;
  pending: boolean;
  value: string;
}) {
  const consequenceId = useId();
  const errorId = useId();
  const inputId = useId();
  return (
    <div className="grid gap-2 rounded-md border border-danger-border bg-danger-bg px-3 py-3">
      <p className="text-secondary text-danger-ink" id={consequenceId}>
        Liên kết ngừng hoạt động ngay: phụ huynh không mở hay nộp phiếu qua liên kết này được nữa. Lý do được lưu trong
        lịch sử liên kết.
      </p>
      <div className="grid gap-1.5">
        {/* Visible label; the field's aria-label (pinned by the tests, names the link) stays its accessible name. */}
        <label className="text-label font-medium text-text-strong" htmlFor={inputId}>
          Lý do thu hồi (bắt buộc)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <input
            aria-describedby={error ? `${consequenceId} ${errorId}` : consequenceId}
            aria-invalid={error ? true : undefined}
            aria-label={`Lý do thu hồi ${linkId}`}
            className={cn(controlClassName, "min-w-0 flex-1")}
            id={inputId}
            maxLength={COACHING_MAX_REVOKE_REASON_LENGTH}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              // The Enter that commits a Vietnamese IME word must not fire the irreversible revoke
              // (Safari reports that keydown as keyCode 229 rather than isComposing).
              if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                onConfirm();
              }
            }}
            placeholder="Lý do thu hồi"
            ref={inputRef}
            value={value}
          />
          <div className="flex gap-2">
            <Button className="max-md:h-11" disabled={pending} onClick={onCancel} size="sm" variant="ghost">
              Hủy
            </Button>
            <Button
              className="max-md:h-11"
              disabled={pending}
              isLoading={loading}
              onClick={onConfirm}
              size="sm"
              variant="danger-outline"
            >
              Thu hồi
            </Button>
          </div>
        </div>
      </div>
      {error ? (
        <p className="text-caption font-medium text-danger" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
