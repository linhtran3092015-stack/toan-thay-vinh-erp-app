"use client";

import { ArrowLeft, Download, Printer } from "lucide-react";
import Link from "next/link";

import { Button, getButtonClassName } from "@/components/ui/button";

export function PayslipToolbar({
  pdfDownloadUrl,
  pdfUnavailableReason,
}: {
  pdfDownloadUrl: string;
  /** When set, the PDF action is disabled and this reason is shown under it. */
  pdfUnavailableReason?: string;
}) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle bg-surface-base px-4 py-3 print:hidden sm:px-6">
      <Link
        className={getButtonClassName({ className: "max-md:h-11", size: "sm", variant: "ghost" })}
        href="/payroll"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        <span>Quay lại bảng lương</span>
      </Link>

      <div className="flex flex-wrap items-start gap-2">
        <Button
          className="max-md:h-11"
          onClick={handlePrint}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Printer aria-hidden="true" className="h-4 w-4" />
          <span>In phiếu lương</span>
        </Button>

        {pdfUnavailableReason ? (
          <Button className="max-md:h-11" disabled disabledReason={pdfUnavailableReason} size="sm" type="button" variant="primary">
            <Download aria-hidden="true" className="h-4 w-4" />
            <span>Xuất PDF</span>
          </Button>
        ) : (
          <a
            className={getButtonClassName({ className: "max-md:h-11", size: "sm", variant: "primary" })}
            download
            href={pdfDownloadUrl}
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            <span>Xuất PDF</span>
          </a>
        )}
      </div>
    </div>
  );
}
