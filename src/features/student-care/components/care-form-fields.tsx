import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { CareDashboard } from "../models";

const controlClassName =
  "w-full min-w-0 rounded-md border border-border-strong bg-field-bg px-3 text-body font-normal text-text-strong outline-none placeholder:text-field-placeholder focus:border-border-focus focus:shadow-[0_0_0_3px_var(--focus-ring)] disabled:bg-disabled-bg disabled:text-text-disabled";

export const careInputClassName = cn(controlClassName, "h-10");
export const careTextareaClassName = cn(controlClassName, "min-h-14 py-2");

function FieldLabel({ children, hint, label, required }: { children: ReactNode; hint?: ReactNode; label: string; required?: boolean }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-label font-medium text-text-strong">
      <span>
        {label}
        {required ? <span aria-hidden="true" className="text-danger"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="text-caption font-normal text-text-muted">{hint}</span> : null}
    </label>
  );
}

/** Optional 2-row text (the contact checklist fields). */
export function CareTextField({ label, name }: { label: string; name: string }) {
  return (
    <FieldLabel label={label}>
      <textarea className={careTextareaClassName} maxLength={4000} name={name} rows={2} />
    </FieldLabel>
  );
}

/** Required `note` (reason / content) — every care command except claim and configure carries one. */
export function CareNoteField({ label = "Nội dung / lý do", placeholder }: { label?: string; placeholder?: string }) {
  return (
    <FieldLabel label={label} required>
      <textarea className={careTextareaClassName} maxLength={4000} name="note" placeholder={placeholder} required rows={3} />
    </FieldLabel>
  );
}

/** `next_followup_at` as a `datetime-local`, read as Vietnam time by CareActionForm. */
export function CareDateTimeField({ hint, label, required = false }: { hint?: ReactNode; label: string; required?: boolean }) {
  return (
    <FieldLabel hint={hint} label={label} required={required}>
      <input className={careInputClassName} name="next_followup_at" required={required} type="datetime-local" />
    </FieldLabel>
  );
}

export function CareOwnerSelect({ assignees, label = "Người phụ trách" }: { assignees: CareDashboard["assignees"]; label?: string }) {
  return (
    <FieldLabel label={label} required>
      <select className={careInputClassName} defaultValue="" name="owner_id" required>
        <option disabled value="">
          Chọn trợ lý
        </option>
        {assignees.map((assignee) => (
          <option key={assignee.id} value={assignee.id}>
            {assignee.name ?? "Nhân sự"}
            {assignee.open_tasks !== undefined ? ` · ${assignee.open_tasks} việc đang mở` : ""}
          </option>
        ))}
      </select>
    </FieldLabel>
  );
}

export function CareSelectField({ children, label, name, required = false }: { children: ReactNode; label: string; name: string; required?: boolean }) {
  return (
    <FieldLabel label={label} required={required}>
      <select className={careInputClassName} defaultValue="" name={name} required={required}>
        {children}
      </select>
    </FieldLabel>
  );
}

/**
 * Segmented choice built from real radio inputs (one tab stop, arrow keys
 * move the choice, the label is the click target). The checked segment uses
 * the soft primary surface, a semibold label and a check mark, so the choice
 * does not rest on colour alone.
 */
export function CareSegmentedRadio<T extends string>({
  defaultValue,
  label,
  name,
  options,
}: {
  defaultValue: T;
  label: string;
  name: string;
  options: readonly { label: string; value: T }[];
}) {
  return (
    <fieldset className="grid min-w-0 gap-1.5">
      <legend className="mb-1.5 text-label font-medium text-text-strong">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label
            className="relative inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-md border border-border-strong bg-surface-base px-3 text-secondary font-medium text-text-default hover:bg-interactive-hover has-[:checked]:border-action-primary has-[:checked]:bg-action-primary-soft has-[:checked]:font-semibold has-[:checked]:text-action-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-border-focus has-[:disabled]:cursor-default has-[:disabled]:opacity-60 max-md:h-11"
            key={option.value}
          >
            <input
              className="peer sr-only"
              defaultChecked={option.value === defaultValue}
              name={name}
              type="radio"
              value={option.value}
            />
            <Check aria-hidden="true" className="hidden shrink-0 peer-checked:block" size={14} strokeWidth={2.4} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
