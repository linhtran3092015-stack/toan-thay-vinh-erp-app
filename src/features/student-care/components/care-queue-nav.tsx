"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Pagination } from "@/components/patterns/pagination";
import { Tabs } from "@/components/ui/tabs";

import { withCareQuery, type CareTab } from "../student-care-url-state";

/** RPC page size: `get_student_care_dashboard` and `get_student_care_students` both `limit 50`. */
export const CARE_PAGE_SIZE = 50;

/** Display order (design 13a); not Object.keys, which would sort the tabs by key. */
const careTabs: readonly { label: string; value: CareTab }[] = [
  { label: "Công việc", value: "tasks" },
  { label: "Phân công lâu dài", value: "assignments" },
  { label: "Theo dõi riêng", value: "inactive" },
];

/** Page tabs as links; a tab switch drops the other tab's filters but keeps foreign query keys. */
export function CareQueueTabs({ tab }: { tab: CareTab }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams?.toString() ?? "";

  return (
    <Tabs
      items={careTabs.map(({ label, value }) => {
        const query = withCareQuery(current, {}, value);
        return { href: query ? `${pathname}?${query}` : pathname, label, value };
      })}
      label="Mục trong chăm sóc học sinh"
      value={tab}
    />
  );
}

/**
 * Frame footer: "a–b trong N task" and the 32px pager; keeps every other query
 * key. A URL page past the last one shows no rows, so the footer says
 * "0 trong N task", marks no page current, and "Trước" leads to the last page.
 */
export function CarePager({ itemLabel, page, total }: { itemLabel: string; page: number; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageCount = Math.max(1, Math.ceil(total / CARE_PAGE_SIZE));
  const pastLast = page > pageCount;

  return (
    <Pagination
      itemLabel={itemLabel}
      label="Phân trang"
      onPageChange={(requested) => {
        const next = Math.min(requested, pageCount);
        const query = new URLSearchParams(searchParams?.toString() ?? "");
        if (next > 1) query.set("page", String(next));
        else query.delete("page");
        const text = query.toString();
        router.push(text ? `${pathname}?${text}` : pathname);
      }}
      page={page}
      pageCount={pageCount}
      rangeEnd={pastLast ? 0 : Math.min(total, page * CARE_PAGE_SIZE)}
      rangeStart={total === 0 || pastLast ? 0 : (page - 1) * CARE_PAGE_SIZE + 1}
      total={total}
      variant="frame"
    />
  );
}

/** "Về trang 1" for a page past the last one (the URL kept a page the list no longer has); keeps every other query key. */
export function CareFirstPageLink() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = new URLSearchParams(searchParams?.toString() ?? "");
  query.delete("page");
  const text = query.toString();
  return (
    <Link
      className="font-semibold text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      href={text ? `${pathname}?${text}` : pathname}
    >
      Về trang 1
    </Link>
  );
}
