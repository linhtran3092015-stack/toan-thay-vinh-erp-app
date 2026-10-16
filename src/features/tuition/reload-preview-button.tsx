"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

/**
 * Draft period header action: re-runs the server page (preview, labels, class
 * names) without a full reload. Secondary on purpose: the lock button stays
 * the page's one primary.
 */
export function ReloadPreviewButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      className="max-md:h-11"
      isLoading={isPending}
      onClick={() => startTransition(() => router.refresh())}
      variant="secondary"
    >
      Tải lại xem trước
    </Button>
  );
}
