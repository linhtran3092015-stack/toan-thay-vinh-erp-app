"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Printer } from "lucide-react";
import Link from "next/link";

export function PayslipToolbar({
  pdfDownloadUrl,
}: {
  pdfDownloadUrl: string;
}) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface-base px-4 py-3 print:hidden sm:px-6">
      {/* Back button */}
      <Link
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-text-default hover:bg-surface-raised active:bg-interactive-pressed"
        href="/payroll"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        <span>Quay lại bảng lương</span>
      </Link>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          className="whitespace-nowrap active:bg-interactive-pressed"
          onClick={handlePrint}
          size="sm"
          type="button"
          variant="outline"
        >
          <Printer aria-hidden="true" className="h-4 w-4" />
          <span>In phiếu lương</span>
        </Button>

        <a
          className="inline-flex items-center gap-1.5 rounded-md bg-action-primary px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-action-primary-hover active:bg-interactive-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          download
          href={pdfDownloadUrl}
        >
          <Download aria-hidden="true" className="h-4 w-4" />
          <span>Xuất PDF</span>
        </a>
      </div>
    </div>
  );
}
