"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { CoachingResponseSummary } from "@/features/coaching/coaching-form-data";
import { compareStudentNames } from "@/lib/student-order";

const formatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

export function CoachingResponseList({ responses }: { responses: CoachingResponseSummary[] }) {
  const [form, setForm] = useState("");
  const [student, setStudent] = useState("");
  const [version, setVersion] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const forms = useMemo(() => [...new Set(responses.map((response) => response.formName))].sort(), [responses]);
  const students = useMemo(() => [...new Set(responses.map((response) => response.studentName))].sort(compareStudentNames), [responses]);
  const filtered = responses.filter((response) => {
    const day = response.submittedAt.slice(0, 10);
    return (!form || response.formName === form)
      && (!student || response.studentName === student)
      && (!version || String(response.versionNumber) === version)
      && (!from || day >= from)
      && (!to || day <= to);
  });

  return <section className="rounded-lg border border-hairline bg-surface-1 shadow-card">
    <div className="grid gap-3 border-b border-hairline p-4 md:grid-cols-5">
      <label className="grid gap-1 text-sm font-medium">Biểu mẫu<select aria-label="Lọc biểu mẫu" className="rounded-md border border-hairline bg-surface-1 p-2" value={form} onChange={(event) => setForm(event.target.value)}><option value="">Tất cả</option>{forms.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-medium">Học viên<select aria-label="Lọc học viên" className="rounded-md border border-hairline bg-surface-1 p-2" value={student} onChange={(event) => setStudent(event.target.value)}><option value="">Tất cả</option>{students.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-medium">Phiên bản<select aria-label="Lọc phiên bản" className="rounded-md border border-hairline bg-surface-1 p-2" value={version} onChange={(event) => setVersion(event.target.value)}><option value="">Tất cả</option>{[...new Set(responses.map((response) => response.versionNumber))].sort().map((value) => <option key={value} value={value}>v{value}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-medium">Từ ngày<input aria-label="Từ ngày gửi" className="rounded-md border border-hairline bg-surface-1 p-2" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className="grid gap-1 text-sm font-medium">Đến ngày<input aria-label="Đến ngày gửi" className="rounded-md border border-hairline bg-surface-1 p-2" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
    </div>
    <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-hairline text-ink-muted"><tr><th className="p-4">Học viên</th><th className="p-4">Biểu mẫu</th><th className="p-4">Phiên bản</th><th className="p-4">Đã gửi</th><th className="p-4" /></tr></thead><tbody>{filtered.map((response) => <tr className="border-b border-hairline last:border-0" key={response.id}><td className="p-4 font-semibold">{response.studentName}</td><td className="p-4">{response.formName}</td><td className="p-4">v{response.versionNumber}</td><td className="p-4">{formatter.format(new Date(response.submittedAt))}</td><td className="p-4"><Link className="font-semibold text-primary hover:underline" href={`/coaching/responses/${response.id}`}>Xem phản hồi</Link></td></tr>)}</tbody></table></div>
    {filtered.length === 0 ? <p className="p-8 text-center text-ink-muted">Không có phản hồi phù hợp bộ lọc.</p> : null}
  </section>;
}
