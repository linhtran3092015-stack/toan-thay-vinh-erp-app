"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createCrmCaseAction } from "@/features/crm/actions/crm-actions";
import type { CrmActionResultState } from "@/features/crm/forms/crm-action-types";

export default function NewCrmLeadPage() {
  const router = useRouter();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionState(null);
    startTransition(async () => {
      const result = await createCrmCaseAction({
        birthYear,
        expectedGrade,
        expectedLevel,
        expectedMode,
        fullName,
        guardianFullName,
        guardianPhone,
        leadSourceCode,
        notes,
        provinceCity,
      });
      setActionState(result);
      if (result.status === "success") {
        router.push(`/crm/${result.id}`);
      }
    });
  };

  return (
    <div className="mx-auto max-w-2xl grid gap-4">
      <section className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:p-5">
        <nav className="mb-2 flex items-center gap-2 text-sm text-ink-muted">
          <Link className="font-semibold text-primary hover:underline" href="/crm">
            CRM & Tuyển sinh
          </Link>
          <span>/</span>
          <span className="font-semibold text-ink">Thêm Lead mới</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Tạo Hồ sơ Lead Mới</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Hệ thống sẽ tự động gán Sale theo thuật toán Round-robin hoặc có thể gán thủ công sau.
        </p>
      </section>

      <form className="rounded-lg border border-hairline bg-surface-1 p-6 shadow-card grid gap-4" onSubmit={handleSubmit}>
        {actionState?.status === "error" ? (
          <div className="rounded-md bg-danger/10 p-4 text-sm font-semibold text-danger">
            {actionState.message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Họ và tên học viên <span className="text-danger">*</span>
            </label>
            <input
              className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập họ và tên con..."
              required
              type="text"
              value={fullName}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Năm sinh học viên <span className="text-danger">*</span>
            </label>
            <input
              className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              max={2025}
              min={2000}
              onChange={(e) => setBirthYear(Number(e.target.value))}
              required
              type="number"
              value={birthYear}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Họ và tên Phụ huynh <span className="text-danger">*</span>
            </label>
            <input
              className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onChange={(e) => setGuardianFullName(e.target.value)}
              placeholder="Nhập họ và tên bố/mẹ..."
              required
              type="text"
              value={guardianFullName}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Số điện thoại Phụ huynh <span className="text-danger">*</span>
            </label>
            <input
              className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onChange={(e) => setGuardianPhone(e.target.value)}
              placeholder="09xx..."
              required
              type="tel"
              value={guardianPhone}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Khối dự kiến <span className="text-danger">*</span>
            </label>
            <select
              className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onChange={(e) => setExpectedGrade(Number(e.target.value))}
              value={expectedGrade}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  Khối {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Nguồn Lead <span className="text-danger">*</span>
            </label>
            <select
              className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onChange={(e) => setLeadSourceCode(e.target.value)}
              value={leadSourceCode}
            >
              <option value="mma_fanpage">MMA Fanpage Facebook</option>
              <option value="mma_zalo">MMA Zalo OA / Hotline</option>
              <option value="mma_website">MMA Website</option>
              <option value="sandbox_partner">Đối tác Sandbox</option>
              <option value="referral_student">Giới thiệu từ học viên cũ</option>
              <option value="referral_teacher">Giới thiệu từ giáo viên</option>
              <option value="direct_walkin">Đến trực tiếp trung tâm</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Mức học lực dự kiến
            </label>
            <select
              className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onChange={(e) => setExpectedLevel(e.target.value as "A" | "B" | "CLC")}
              value={expectedLevel}
            >
              <option value="CLC">Chất lượng cao (CLC)</option>
              <option value="A">Mức A</option>
              <option value="B">Mức B</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Hình thức học mong muốn
            </label>
            <select
              className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              onChange={(e) => setExpectedMode(e.target.value as "online" | "offline" | "hybrid")}
              value={expectedMode}
            >
              <option value="offline">Offline (Tại trung tâm)</option>
              <option value="online">Online (Trực tuyến)</option>
              <option value="hybrid">Hybrid (Kết hợp)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Tỉnh / Thành phố
          </label>
          <input
            className="mt-1 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            onChange={(e) => setProvinceCity(e.target.value)}
            type="text"
            value={provinceCity}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Ghi chú nhu cầu học tập
          </label>
          <textarea
            className="mt-1 w-full rounded-md border border-hairline bg-canvas p-3 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Nhu cầu ôn thi, mục tiêu điểm số, lịch rảnh..."
            rows={3}
            value={notes}
          />
        </div>

        <div className="mt-4 flex items-center justify-end gap-3 border-t border-hairline pt-4">
          <Link href="/crm">
            <Button type="button" variant="outline">
              Hủy
            </Button>
          </Link>
          <Button disabled={isPending || !fullName || !guardianPhone || !guardianFullName} type="submit">
            {isPending ? "Đang lưu..." : "Tạo Hồ sơ Lead"}
          </Button>
        </div>
      </form>
    </div>
  );
}
