import type { ReactNode } from "react";

interface PayrollModalProps {
  children: ReactNode;
  title: string;
  description: string;
}

export function PayrollModal({
  children,
  description,
  title,
}: PayrollModalProps) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
      role="dialog"
    >
      <div className="my-auto w-full max-w-lg rounded-lg border border-hairline bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-ink-muted">{description}</p>
        {children}
      </div>
    </div>
  );
}
