"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  createStaffGradeAssignmentAction,
  createStaffPayrollTaskVersionAction,
} from "@/features/staff/staff-actions";
import {
  payrollTaskCodes,
  payrollTaskLabels,
  type PayrollTaskCode,
} from "@/features/staff/payroll-profile-types";
import {
  initialStaffManagementActionState,
  type StaffManagementActionState,
} from "@/features/staff/staff-action-types";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

export function StaffPayrollAssignmentDialog({ staffId }: { staffId: string }) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<StaffManagementActionState>(initialStaffManagementActionState);
  const [grade, setGrade] = useState(2);
  const [gradeFrom, setGradeFrom] = useState("");
  const [gradeTo, setGradeTo] = useState("");
  const [gradeReason, setGradeReason] = useState("");
  const [taskCode, setTaskCode] = useState<PayrollTaskCode>("center_renewal_duty");
  const [taskEnabled, setTaskEnabled] = useState(true);
  const [taskFrom, setTaskFrom] = useState("");
  const [taskReason, setTaskReason] = useState("");
  const locked = isPending && state.status !== "error";

  const run = (work: () => Promise<StaffManagementActionState>): void => {
    if (locked) return;
    setState(initialStaffManagementActionState);
    startTransition(async () => {
      const result = await work();
      setState(result);
      if (result.status === "success") {
        setIsOpen(false);
        router.refresh();
      }
    });
  };

  const close = (): void => {
    if (locked) return;
    setIsOpen(false);
    setState(initialStaffManagementActionState);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} ref={triggerRef} type="button" variant="secondary">Phân công và nhiệm vụ</Button>
      <Dialog ariaDescribedBy={descriptionId} ariaLabelledBy={titleId} className="max-w-2xl" isOpen={isOpen} onClose={close} returnFocusRef={triggerRef}>
        <div className="grid gap-5 p-4 sm:p-5">
          <div>
            <h2 className="text-section-title text-text-strong" id={titleId}>Phân công khối và nhiệm vụ tính lương</h2>
            <p className="mt-1 text-secondary text-text-muted" id={descriptionId}>Mỗi thay đổi có ngày hiệu lực và được lưu thành lịch sử bất biến.</p>
          </div>

          <section className="grid gap-3 rounded-lg border border-border-subtle p-4" aria-labelledby="grade-assignment-title">
            <div>
              <h3 className="font-semibold text-text-strong" id="grade-assignment-title">Phân công khối cho trợ lý vận hành</h3>
              <p className="mt-1 text-caption text-text-muted">Một khối chỉ có một trợ lý trong cùng khoảng thời gian.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Khối"><select className={inputClassName} disabled={locked} onChange={(event) => setGrade(Number(event.target.value))} value={grade}>{Array.from({ length: 11 }, (_, index) => index + 2).map((value) => <option key={value} value={value}>Khối {value}</option>)}</select></Field>
              <Field label="Từ ngày"><input className={inputClassName} disabled={locked} onChange={(event) => setGradeFrom(event.target.value)} type="date" value={gradeFrom} /></Field>
              <Field label="Đến ngày (nếu có)"><input className={inputClassName} disabled={locked} onChange={(event) => setGradeTo(event.target.value)} type="date" value={gradeTo} /></Field>
            </div>
            <Field label="Lý do"><textarea className={`${inputClassName} min-h-20 py-3`} disabled={locked} onChange={(event) => setGradeReason(event.target.value)} value={gradeReason} /></Field>
            <div><Button disabled={locked} onClick={() => run(() => createStaffGradeAssignmentAction({ effectiveFrom: gradeFrom, effectiveTo: gradeTo, grade, reason: gradeReason, staffId }))} type="button">Lưu phân công khối</Button></div>
          </section>

          <section className="grid gap-3 rounded-lg border border-border-subtle p-4" aria-labelledby="payroll-task-title">
            <div>
              <h3 className="font-semibold text-text-strong" id="payroll-task-title">Nhiệm vụ được tính thưởng</h3>
              <p className="mt-1 text-caption text-text-muted">Bật hoặc tắt riêng cho từng nhân sự.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nhiệm vụ"><select className={inputClassName} disabled={locked} onChange={(event) => setTaskCode(event.target.value as PayrollTaskCode)} value={taskCode}>{payrollTaskCodes.map((code) => <option key={code} value={code}>{payrollTaskLabels[code]}</option>)}</select></Field>
              <Field label="Hiệu lực từ"><input className={inputClassName} disabled={locked} onChange={(event) => setTaskFrom(event.target.value)} type="date" value={taskFrom} /></Field>
            </div>
            <label className="flex min-h-11 items-center gap-3 rounded-md border border-border-subtle px-3 text-control text-text-default"><input checked={taskEnabled} disabled={locked} onChange={(event) => setTaskEnabled(event.target.checked)} type="checkbox" /><span>{taskEnabled ? "Được tính khoản thưởng này" : "Ngừng tính khoản thưởng này"}</span></label>
            <Field label="Lý do"><textarea className={`${inputClassName} min-h-20 py-3`} disabled={locked} onChange={(event) => setTaskReason(event.target.value)} value={taskReason} /></Field>
            <div><Button disabled={locked} onClick={() => run(() => createStaffPayrollTaskVersionAction({ effectiveFrom: taskFrom, isEnabled: taskEnabled, reason: taskReason, staffId, taskCode }))} type="button">Lưu trạng thái nhiệm vụ</Button></div>
          </section>

          {state.status === "error" ? <ResultBanner description={state.message} title="Không thể lưu thay đổi" tone="error" /> : null}
          <div className="flex justify-end"><Button disabled={locked} onClick={close} type="button" variant="ghost">Đóng</Button></div>
        </div>
      </Dialog>
    </>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="grid gap-1.5 text-label text-text-default"><span>{label}</span>{children}</label>;
}
