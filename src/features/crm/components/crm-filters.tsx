"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { LeadSourceOption, SaleOwnerOption } from "@/features/crm/read-models";

interface CrmFiltersProps {
  leadSources: LeadSourceOption[];
  saleOwners: SaleOwnerOption[];
}

export function CrmFilters({ leadSources, saleOwners }: CrmFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get("search") ?? "";
  const currentStatus = searchParams.get("status") ?? "";
  const currentGrade = searchParams.get("grade") ?? "";
  const currentSource = searchParams.get("source") ?? "";
  const currentSale = searchParams.get("sale") ?? "";

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleReset = () => {
    startTransition(() => {
      router.push(pathname);
    });
  };

  return (
    <div className="grid gap-3 rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:grid-cols-6">
      <div className="md:col-span-2">
        <input
          className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          defaultValue={currentSearch}
          onChange={(e) => updateParam("search", e.target.value)}
          placeholder="Tìm tên, SĐT phụ huynh, mã lead..."
          type="text"
        />
      </div>

      <select
        className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        onChange={(e) => updateParam("status", e.target.value)}
        value={currentStatus}
      >
        <option value="">Tất cả trạng thái</option>
        <option value="interested">Đang quan tâm</option>
        <option value="trial_booked">Đã đặt học thử</option>
        <option value="trial_completed">Đã học thử</option>
        <option value="pending_enrollment_confirmation">Chờ xác nhận nhập học</option>
        <option value="converted">Đã nhập học</option>
        <option value="dropped">Đã dừng</option>
      </select>

      <select
        className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        onChange={(e) => updateParam("source", e.target.value)}
        value={currentSource}
      >
        <option value="">Tất cả nguồn Lead</option>
        {leadSources.map((src) => (
          <option key={src.id} value={src.code}>
            {src.name}
          </option>
        ))}
      </select>

      <select
        className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        onChange={(e) => updateParam("grade", e.target.value)}
        value={currentGrade}
      >
        <option value="">Tất cả khối học</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
          <option key={grade} value={String(grade)}>
            Khối {grade}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-2">
        <select
          className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          onChange={(e) => updateParam("sale", e.target.value)}
          value={currentSale}
        >
          <option value="">Tất cả Sale</option>
          {saleOwners.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </select>

        <Button
          disabled={isPending || (!currentSearch && !currentStatus && !currentGrade && !currentSource && !currentSale)}
          onClick={handleReset}
          size="sm"
          variant="outline"
        >
          Xóa
        </Button>
      </div>
    </div>
  );
}
