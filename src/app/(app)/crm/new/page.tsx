"use client";

import { cloneElement, isValidElement, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/patterns/page-header";
import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { createCrmCaseAction } from "@/features/crm/actions/crm-actions";
import { getCrmDirectoryHref } from "@/features/crm/crm-directory-url-state";
import type { CrmActionResultState } from "@/features/crm/forms/crm-action-types";

const fieldClassName = "h-10 w-full rounded-md border border-border-subtle bg-field-bg px-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring";

export default function NewCrmLeadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const directoryHref = getCrmDirectoryHref(searchParams);
  const [fullName, setFullName] = useState("");
  const [birthYear, setBirthYear] = useState(2015);
  const [expectedGrade, setExpectedGrade] = useState(5);
  const [guardianFullName, setGuardianFullName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [leadSourceCode, setLeadSourceCode] = useState("mma_fanpage");
  const [expectedLevel, setExpectedLevel] = useState<"A" | "B" | "CLC">("CLC");
  const [expectedMode, setExpectedMode] = useState<"online" | "offline" | "hybrid">("offline");
  const [provinceCity, setProvinceCity] = useState("Hà Nội");
  const [notes, setNotes] = useState("");
  const [actionState, setActionState] = useState<CrmActionResultState | null>(null);
  const [isPending, startTransition] = useTransition();
  const fieldErrors = actionState?.status === "error" ? actionState.fieldErrors : undefined;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setActionState(null);
    startTransition(async () => {
      const result = await createCrmCaseAction({ birthYear, expectedGrade, expectedLevel, expectedMode, fullName, guardianFullName, guardianPhone, leadSourceCode, notes, provinceCity });
      setActionState(result);
      if (result.status === "success") router.push(`/crm/${result.id}`);
    });
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="grid gap-3">
        <Link className="inline-flex w-fit items-center gap-2 text-control font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={directoryHref}><ArrowLeft aria-hidden="true" size={18} strokeWidth={1.8} /> Quay lại CRM & Tuyển sinh</Link>
        <PageHeader title="Tạo hồ sơ Lead mới"><p className="mt-1 text-secondary text-text-muted">Thông tin được dùng để tạo hồ sơ tuyển sinh và phân công sale theo quy trình hiện có.</p></PageHeader>
      </div>
      <form className="grid gap-6 rounded-lg border border-border-subtle bg-surface-base p-5 sm:p-6" onSubmit={handleSubmit}>
        {actionState?.status === "error" ? <ResultBanner title={actionState.message} tone="error" /> : null}
        <FormSection title="Thông tin học viên dự kiến"><div className="grid gap-4 md:grid-cols-2"><Field error={fieldErrors?.fullName?.[0]} label="Họ và tên học viên" required><input className={fieldClassName} id="crm-full-name" onChange={(event) => setFullName(event.target.value)} placeholder="Nhập họ và tên con" required value={fullName} /></Field><Field error={fieldErrors?.birthYear?.[0]} label="Năm sinh học viên" required><input className={fieldClassName} id="crm-birth-year" max={2025} min={2000} onChange={(event) => setBirthYear(Number(event.target.value))} required type="number" value={birthYear} /></Field><SelectField label="Khối dự kiến" required value={String(expectedGrade)} onChange={(value) => setExpectedGrade(Number(value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Khối {index + 1}</option>)}</SelectField><SelectField label="Mức học lực dự kiến" value={expectedLevel} onChange={(value) => setExpectedLevel(value as "A" | "B" | "CLC")}><option value="CLC">Chất lượng cao (CLC)</option><option value="A">Mức A</option><option value="B">Mức B</option></SelectField><SelectField label="Hình thức học mong muốn" value={expectedMode} onChange={(value) => setExpectedMode(value as "online" | "offline" | "hybrid")}><option value="offline">Offline (Tại trung tâm)</option><option value="online">Online (Trực tuyến)</option><option value="hybrid">Hybrid (Kết hợp)</option></SelectField></div></FormSection>
        <FormSection title="Thông tin phụ huynh và nhu cầu"><div className="grid gap-4 md:grid-cols-2"><Field error={fieldErrors?.guardianFullName?.[0]} label="Họ và tên phụ huynh" required><input className={fieldClassName} id="crm-guardian-name" onChange={(event) => setGuardianFullName(event.target.value)} placeholder="Nhập họ và tên bố hoặc mẹ" required value={guardianFullName} /></Field><Field error={fieldErrors?.guardianPhone?.[0]} label="Số điện thoại phụ huynh" required><input className={fieldClassName} id="crm-guardian-phone" onChange={(event) => setGuardianPhone(event.target.value)} placeholder="09xx…" required type="tel" value={guardianPhone} /></Field><SelectField label="Nguồn Lead" required value={leadSourceCode} onChange={setLeadSourceCode}><option value="mma_fanpage">MMA Fanpage Facebook</option><option value="mma_zalo">MMA Zalo OA / Hotline</option><option value="mma_website">MMA Website</option><option value="sandbox_partner">Đối tác Sandbox</option><option value="referral_student">Giới thiệu từ học viên cũ</option><option value="referral_teacher">Giới thiệu từ giáo viên</option><option value="direct_walkin">Đến trực tiếp trung tâm</option></SelectField><Field label="Tỉnh / Thành phố"><input className={fieldClassName} id="crm-province-city" onChange={(event) => setProvinceCity(event.target.value)} value={provinceCity} /></Field><Field className="md:col-span-2" label="Ghi chú nhu cầu học tập"><textarea className="min-h-28 w-full rounded-md border border-border-subtle bg-field-bg p-3 text-body text-text-strong outline-none transition focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring" id="crm-notes" onChange={(event) => setNotes(event.target.value)} placeholder="Nhu cầu ôn thi, mục tiêu điểm số, lịch rảnh…" value={notes} /></Field></div></FormSection>
        <div className="flex flex-col-reverse gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:justify-end"><Link href={directoryHref}><Button className="min-h-11 w-full sm:w-auto" type="button" variant="outline">Hủy</Button></Link><Button className="min-h-11" disabled={isPending || !fullName || !guardianPhone || !guardianFullName} type="submit">{isPending ? "Đang lưu…" : "Tạo hồ sơ Lead"}</Button></div>
      </form>
    </div>
  );
}

function FormSection({ children, title }: { children: React.ReactNode; title: string }) { return <section className="grid gap-4"><h2 className="text-section-title font-semibold text-text-strong">{title}</h2>{children}</section>; }
function Field({ children, className, error, label, required = false }: { children: React.ReactNode; className?: string; error?: string; label: string; required?: boolean }) { const id = findControlId(children); const errorId = id ? `${id}-error` : undefined; const control = isValidElement(children) ? cloneElement(children as React.ReactElement<Record<string, unknown>>, { "aria-describedby": error ? errorId : undefined, "aria-invalid": Boolean(error) }) : children; return <div className={`grid gap-1.5 ${className ?? ""}`}><label className="text-label font-medium text-text-muted" htmlFor={id}>{label}{required ? <span aria-hidden="true" className="text-danger"> *</span> : null}</label>{control}{error ? <p className="text-caption text-danger" id={errorId}>{error}</p> : null}</div>; }
function SelectField({ children, label, onChange, required = false, value }: { children: React.ReactNode; label: string; onChange: (value: string) => void; required?: boolean; value: string }) { const id = `crm-${label.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-")}`; return <div className="grid gap-1.5"><label className="text-label font-medium text-text-muted" htmlFor={id}>{label}{required ? <span aria-hidden="true" className="text-danger"> *</span> : null}</label><select className={fieldClassName} id={id} onChange={(event) => onChange(event.target.value)} value={value}>{children}</select></div>; }
function findControlId(children: React.ReactNode): string | undefined { return typeof children === "object" && children && "props" in children ? (children as { props: { id?: string } }).props.id : undefined; }
