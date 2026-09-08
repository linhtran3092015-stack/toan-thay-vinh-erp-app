"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";
import {
  isSepayTransactionReconcilable,
  SepayReconciliationDialog,
  type SepayReconciliationCandidateView,
} from "@/features/finance/components/sepay-reconciliation-dialog";

export type { SepayReconciliationCandidateView };
export { isSepayTransactionReconcilable };

export interface SepayReconciliationActionsProps {
  candidates: SepayReconciliationCandidateView[];
  defaultOpen?: boolean;
  onOpenDialog?: (transaction: SepayTransactionReadModel, trigger: HTMLElement | null) => void;
  transaction: SepayTransactionReadModel;
}

/**
 * Reconciliation action trigger for SePay transactions.
 * Replaces the in-row expanding form with a clean dialog trigger button.
 */
export function SepayReconciliationActions({
  candidates,
  defaultOpen = false,
  onOpenDialog,
  transaction,
}: SepayReconciliationActionsProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (!isSepayTransactionReconcilable(transaction)) {
    return <span className="text-caption text-text-muted">Không cần thao tác</span>;
  }

  function handleOpen(): void {
    if (onOpenDialog) {
      onOpenDialog(transaction, triggerRef.current);
    } else {
      setIsOpen(true);
    }
  }

  return (
    <>
      <Button
        aria-haspopup="dialog"
        onClick={handleOpen}
        ref={triggerRef}
        size="sm"
        type="button"
        variant="secondary"
      >
        Đối soát
      </Button>

      {/* When running standalone (e.g. in isolated component tests without history wrapper) */}
      {!onOpenDialog ? (
        <SepayReconciliationDialog
          candidates={candidates}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          returnFocusRef={triggerRef}
          transaction={transaction}
        />
      ) : null}
    </>
  );
}
