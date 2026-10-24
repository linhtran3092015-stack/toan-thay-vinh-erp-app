"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { StickySaveBar } from "@/components/patterns/sticky-save-bar";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { controlClassName, Field, textareaClassName } from "@/components/ui/field";
import type { SettingsActionState } from "@/features/settings/action-types";
import { updateSystemSettingsAction } from "@/features/settings/actions";
import { useLeaveGuard, useSaveInFlightGuard } from "@/features/settings/components/leave-guard";
import { SettingsCard } from "@/features/settings/components/settings-card";
import { ZaloAccountPicker } from "@/features/settings/components/zalo-account-picker";
import type { SettingsActionOverrides } from "@/features/settings/settings-action-overrides";
import type { SystemSettings } from "@/features/settings/system-settings";
import { cn } from "@/lib/utils";

/** Control labels shared by the form and the read-only view. */
const EXPIRY_DAYS_LABEL = "Thời hạn liên kết mặc định (ngày)";
const AUTO_LOCK_DAYS_LABEL = "Tự khóa buổi học sau (ngày)";

/** Form field names, in on-screen order, with the label used in the save bar. */
const FIELD_LABELS = {
  displayName: "Tên hiển thị trung tâm",
  teacherDisplayName: "Tên giáo viên / thương hiệu",
  contactPhone: "Số điện thoại liên hệ",
  contactEmail: "Email liên hệ",
  address: "Địa chỉ",
  defaultPublicLinkExpiryDays: "Thời hạn liên kết mặc định",
  sessionAutoLockAfterDays: "Tự khóa buổi học",
  zaloCenterAccountId: "Nick trung tâm gửi tin",
  zaloCenterAccountName: "Nick trung tâm gửi tin",
  zaloAbsenceMessageEnabled: "Tạo tin khi vắng không phép",
  zaloCommentMessageEnabled: "Tạo tin nhận xét cuối buổi",
  zaloAbsenceTemplate: "Mẫu tin vắng không phép",
} as const;

export type SystemSettingsFieldName = keyof typeof FIELD_LABELS;
export type SystemSettingsFields = Record<SystemSettingsFieldName, string>;

const FIELD_NAMES = Object.keys(FIELD_LABELS) as SystemSettingsFieldName[];

/** Line breaks as the form reads them back (LF), so saved and on-screen values compare equal. */
function lf(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function toFields(values: SystemSettings): SystemSettingsFields {
  return {
    address: lf(values["center.address"]),
    contactEmail: lf(values["center.contact_email"]),
    contactPhone: lf(values["center.contact_phone"]),
    defaultPublicLinkExpiryDays: String(values["coaching.default_public_link_expiry_days"]),
    displayName: lf(values["center.display_name"]),
    sessionAutoLockAfterDays: String(values["sessions.auto_lock_after_days"]),
    teacherDisplayName: lf(values["teacher.display_name"]),
    zaloAbsenceMessageEnabled: values["zalo.absence_message_enabled"] === "on" ? "on" : "",
    zaloAbsenceTemplate: lf(values["zalo.absence_template"]),
    zaloCenterAccountId: lf(values["zalo.center_account_id"]),
    zaloCenterAccountName: lf(values["zalo.center_account_name"]),
    zaloCommentMessageEnabled: values["zalo.comment_message_enabled"] === "on" ? "on" : "",
  };
}

function fieldsFromForm(form: HTMLFormElement): SystemSettingsFields {
  const data = new FormData(form);
  const fields = {} as SystemSettingsFields;
  for (const name of FIELD_NAMES) {
    const value = data.get(name);
    fields[name] = typeof value === "string" ? lf(value) : "";
  }
  return fields;
}

/** Server payload from one read of the form (the same snapshot that becomes "saved"). */
function toPayload(fields: SystemSettingsFields) {
  return {
    ...fields,
    defaultPublicLinkExpiryDays: Number(fields.defaultPublicLinkExpiryDays),
    sessionAutoLockAfterDays: Number(fields.sessionAutoLockAfterDays),
    zaloAbsenceMessageEnabled: fields.zaloAbsenceMessageEnabled === "on",
    zaloCommentMessageEnabled: fields.zaloCommentMessageEnabled === "on",
  };
}

function changedFieldNames(saved: SystemSettingsFields, current: SystemSettingsFields): SystemSettingsFieldName[] {
  return FIELD_NAMES.filter((name) => saved[name] !== current[name]);
}

/** Save-bar labels: one per visible control (the Zalo nick is two hidden fields). */
function changedLabels(names: readonly SystemSettingsFieldName[]): string[] {
  return Array.from(new Set(names.map((name) => FIELD_LABELS[name])));
}

/**
 * "Chung" settings (design 09a): one card per section, two columns from md,
 * labels on top. The StickySaveBar sits inside the form (fixed to the bottom)
 * and counts changed controls against the last saved values. Save errors show
 * above the bar and keep what was typed.
 */
export function SystemSettingsForm({
  actions,
  initialDraft,
  initialValues,
}: {
  actions?: Pick<SettingsActionOverrides, "listZaloAccounts" | "updateSystemSettings">;
  /** Dev previews only: start with these unsaved edits on top of the saved values. */
  initialDraft?: Partial<SystemSettingsFields>;
  initialValues: SystemSettings;
}) {
  const updateSystemSettings = actions?.updateSystemSettings ?? updateSystemSettingsAction;
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(() => toFields(initialValues));
  const [defaults, setDefaults] = useState<SystemSettingsFields>(() => ({ ...toFields(initialValues), ...initialDraft }));
  const [fieldsKey, setFieldsKey] = useState(0);
  const [changed, setChanged] = useState(() => changedFieldNames(toFields(initialValues), { ...toFields(initialValues), ...initialDraft }));
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const labels = changedLabels(changed);

  const recompute = () => {
    const form = formRef.current;
    if (form) setChanged(changedFieldNames(saved, fieldsFromForm(form)));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitted = fieldsFromForm(event.currentTarget);
    setMessage("");
    setError(null);
    startTransition(async () => {
      let result: SettingsActionState;
      try {
        result = await updateSystemSettings(toPayload(submitted));
      } catch {
        // A rejected call must not reach the error boundary: typed values stay, the banner explains.
        result = { message: "Không thể kết nối hệ thống cài đặt.", status: "error" };
      }
      if (result.status === "success") {
        setSaved(submitted);
        const current = formRef.current ? fieldsFromForm(formRef.current) : submitted;
        setChanged(changedFieldNames(submitted, current));
        setMessage(result.message);
      } else {
        // Typed values stay in the uncontrolled fields; only the banner changes.
        setError(result.message);
      }
    });
  };

  const onCancel = () => {
    // Never while saving: the save's own result decides what is saved and clean.
    if (pending) return;
    setDefaults(saved);
    setFieldsKey((key) => key + 1);
    setChanged([]);
    setError(null);
    setMessage("");
  };
  // "Rời trang" in the leave dialog drops the draft like Hủy. Not while saving:
  // leaving then must not discard or cut short the save, so links just navigate
  // and the save finishes (its success leaves the form clean). A reload/close
  // while saving still asks, so the request is not cut off.
  useLeaveGuard(changed.length > 0 && !pending, onCancel);
  useSaveInFlightGuard(pending);

  return (
    <form
      className="grid gap-5"
      onChange={() => {
        setMessage("");
        // Read after React commits: the Zalo picker updates its hidden fields from state.
        window.setTimeout(recompute, 0);
      }}
      onSubmit={onSubmit}
      ref={formRef}
    >
      <div className="contents" key={fieldsKey}>
        <SettingsCard
          description="Thông tin hiển thị an toàn. Phiếu học phí đã khóa vẫn dùng mẫu phiên bản đã snapshot."
          title="Thông tin trung tâm"
        >
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            <TextField defaultValue={defaults.displayName} label={FIELD_LABELS.displayName} name="displayName" required />
            <TextField defaultValue={defaults.teacherDisplayName} label={FIELD_LABELS.teacherDisplayName} name="teacherDisplayName" required />
            <TextField defaultValue={defaults.contactPhone} label={FIELD_LABELS.contactPhone} name="contactPhone" type="tel" />
            <TextField defaultValue={defaults.contactEmail} label={FIELD_LABELS.contactEmail} name="contactEmail" type="email" />
            <Field className="md:col-span-2" label={FIELD_LABELS.address}>
              {(props) => (
                <textarea className={textareaClassName} defaultValue={defaults.address} maxLength={500} name="address" {...props} />
              )}
            </Field>
          </div>
        </SettingsCard>

        <div className="grid gap-5 md:grid-cols-2">
          <SettingsCard
            description="Chỉ là giá trị gợi ý khi phát hành liên kết mới; không thay đổi liên kết đã phát hành."
            title="Coaching"
          >
            <Field hint="Từ 1 đến 90 ngày." label={EXPIRY_DAYS_LABEL}>
              {(props) => (
                <input className={controlClassName} defaultValue={defaults.defaultPublicLinkExpiryDays} max={90} min={1} name="defaultPublicLinkExpiryDays" required type="number" {...props} />
              )}
            </Field>
          </SettingsCard>
          <SettingsCard
            description="Buổi đã hoàn thành và điểm danh đủ sẽ được hệ thống tự khóa sau số ngày này (khóa mới trừ buổi và tính thưởng chấm bài)."
            title="Buổi học"
          >
            <Field hint="Từ 0 đến 30 ngày. Nhập 0 để tắt tự khóa." label={AUTO_LOCK_DAYS_LABEL}>
              {(props) => (
                <input className={controlClassName} defaultValue={defaults.sessionAutoLockAfterDays} max={30} min={0} name="sessionAutoLockAfterDays" required type="number" {...props} />
              )}
            </Field>
          </SettingsCard>
        </div>

        <SettingsCard
          description={
            <>
              Gửi qua ZaloCRM từ nick trung tâm vào nhóm sổ liên lạc của từng học sinh. Chọn nick trong danh sách (cần đã cấu hình ZALOCRM_BASE_URL / ZALOCRM_API_KEY). Mẫu tin vắng dùng các biến {"{center} {student} {class} {date} {time}"}. Mẫu tin nhận xét cuối buổi sửa ở{" "}
              <Link className="font-semibold text-action-link hover:underline" href="/settings/zalo">Cài đặt → Tin Zalo</Link>. Kiểm tra kết nối và liên kết nhóm cho học sinh ở{" "}
              <Link className="font-semibold text-action-link hover:underline" href="/parent-messages/groups">Liên kết nhóm Zalo</Link>.
            </>
          }
          title="Tin nhắn phụ huynh (Zalo)"
        >
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            <ZaloAccountPicker
              initialId={defaults.zaloCenterAccountId}
              initialName={defaults.zaloCenterAccountName}
              listAccounts={actions?.listZaloAccounts}
            />
            <CheckboxField defaultChecked={defaults.zaloAbsenceMessageEnabled === "on"} name="zaloAbsenceMessageEnabled">
              {FIELD_LABELS.zaloAbsenceMessageEnabled}
            </CheckboxField>
            <CheckboxField defaultChecked={defaults.zaloCommentMessageEnabled === "on"} name="zaloCommentMessageEnabled">
              {FIELD_LABELS.zaloCommentMessageEnabled}
            </CheckboxField>
            <Field className="md:col-span-2" label={FIELD_LABELS.zaloAbsenceTemplate} required>
              {(props) => (
                <textarea className={textareaClassName} defaultValue={defaults.zaloAbsenceTemplate} maxLength={1000} name="zaloAbsenceTemplate" required {...props} />
              )}
            </Field>
          </div>
        </SettingsCard>
      </div>

      <StickySaveBar
        changedLabels={labels}
        dirtyCount={labels.length}
        error={error ? <ResultBanner description={error} title="Chưa lưu được cài đặt." tone="danger" /> : null}
        isSaving={pending}
        onCancel={onCancel}
        saveLabel="Lưu cài đặt"
        saveType="submit"
        savingLabel="Đang lưu…"
        statusMessage={message}
      />
    </form>
  );
}

function TextField({
  defaultValue,
  label,
  name,
  required,
  type = "text",
}: {
  defaultValue: string;
  label: string;
  name: SystemSettingsFieldName;
  required?: boolean;
  type?: string;
}) {
  return (
    <Field label={label} required={required}>
      {(props) => (
        <input className={controlClassName} defaultValue={defaultValue} name={name} required={required} type={type} {...props} />
      )}
    </Field>
  );
}

function CheckboxField({ children, defaultChecked, name }: { children: ReactNode; defaultChecked: boolean; name: SystemSettingsFieldName }) {
  return (
    <label className="flex min-h-11 items-center gap-2.5 text-body text-text-strong md:min-h-10">
      <input className="h-4 w-4 shrink-0 accent-[var(--action-primary)]" defaultChecked={defaultChecked} name={name} type="checkbox" value="on" />
      {children}
    </label>
  );
}

/** Read-only view for people with settings.view but not settings.manage (no save bar). */
export function SystemSettingsReadOnly({ settings }: { settings: SystemSettings }) {
  const fields = toFields(settings);
  const enabled = (value: string) => (value === "on" ? "Bật" : "Tắt");

  return (
    <div className="grid gap-5">
      <p className="flex flex-wrap items-center gap-2 text-secondary text-text-muted">
        <Badge>Chỉ đọc</Badge>
        Cần quyền settings.manage để sửa cài đặt chung.
      </p>
      <SettingsCard title="Thông tin trung tâm">
        <ReadOnlyList
          items={[
            [FIELD_LABELS.displayName, fields.displayName],
            [FIELD_LABELS.teacherDisplayName, fields.teacherDisplayName],
            [FIELD_LABELS.contactPhone, fields.contactPhone],
            [FIELD_LABELS.contactEmail, fields.contactEmail],
            [FIELD_LABELS.address, fields.address, true],
          ]}
        />
      </SettingsCard>
      <div className="grid gap-5 md:grid-cols-2">
        <SettingsCard title="Coaching">
          <ReadOnlyList items={[[EXPIRY_DAYS_LABEL, fields.defaultPublicLinkExpiryDays]]} />
        </SettingsCard>
        <SettingsCard title="Buổi học">
          <ReadOnlyList items={[[AUTO_LOCK_DAYS_LABEL, fields.sessionAutoLockAfterDays]]} />
        </SettingsCard>
      </div>
      <SettingsCard title="Tin nhắn phụ huynh (Zalo)">
        <ReadOnlyList
          items={[
            [FIELD_LABELS.zaloCenterAccountId, fields.zaloCenterAccountName || fields.zaloCenterAccountId, true],
            [FIELD_LABELS.zaloAbsenceMessageEnabled, enabled(fields.zaloAbsenceMessageEnabled)],
            [FIELD_LABELS.zaloCommentMessageEnabled, enabled(fields.zaloCommentMessageEnabled)],
            [FIELD_LABELS.zaloAbsenceTemplate, fields.zaloAbsenceTemplate, true],
          ]}
        />
      </SettingsCard>
    </div>
  );
}

/** [label, value, full width] rows; empty values show an em dash. */
function ReadOnlyList({ items }: { items: readonly (readonly [string, string, boolean?])[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 md:grid-cols-2">
      {items.map(([label, value, wide]) => (
        <div className={cn("grid min-w-0 content-start gap-1", wide && "md:col-span-2")} key={label}>
          <dt className="text-label font-medium text-text-muted">{label}</dt>
          <dd className="whitespace-pre-line break-words text-body text-text-strong">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
