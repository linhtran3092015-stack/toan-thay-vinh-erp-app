import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useLayoutEffect, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui/dialog";

afterEach(cleanup);

/**
 * Reads document.activeElement from a layout effect of the commit that closes
 * the dialog. Layout effects run after every layout cleanup of that commit but
 * before any passive effect, so this sees focus exactly when the dialog's DOM
 * is gone, which is when `waitFor(() => dialog gone)` can resolve.
 */
function ClosedCommitProbe({ isOpen, onClosedCommit }: { isOpen: boolean; onClosedCommit: (element: Element | null) => void }) {
  const wasOpen = useRef(false);

  useLayoutEffect(() => {
    if (wasOpen.current && !isOpen) {
      onClosedCommit(document.activeElement);
    }
    wasOpen.current = isOpen;
  }, [isOpen, onClosedCommit]);

  return null;
}

function Harness({ onClosedCommit }: { onClosedCommit: (element: Element | null) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button onClick={() => setIsOpen(true)} ref={triggerRef} type="button">
        Mở hộp thoại
      </button>
      <Dialog ariaLabelledBy="dialog-title" isOpen={isOpen} onClose={() => setIsOpen(false)} returnFocusRef={triggerRef}>
        <h2 id="dialog-title">Hộp thoại thử</h2>
        <button type="button">Bên trong</button>
      </Dialog>
      <ClosedCommitProbe isOpen={isOpen} onClosedCommit={onClosedCommit} />
    </>
  );
}

describe("Dialog focus return", () => {
  it("REGRESSION: returns focus to the trigger in the same commit that removes the dialog", () => {
    const onClosedCommit = vi.fn();
    render(<Harness onClosedCommit={onClosedCommit} />);

    const trigger = screen.getByRole("button", { name: "Mở hộp thoại" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Hộp thoại thử" });
    screen.getByRole("button", { name: "Bên trong" }).focus();

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // A passive (useEffect) cleanup would still leave focus on <body> here: a
    // test or assistive technology reading focus right after the dialog
    // disappears would race it.
    expect(onClosedCommit).toHaveBeenCalledOnce();
    expect(onClosedCommit.mock.calls[0][0]).toBe(trigger);
    expect(trigger).toHaveFocus();
  });

  // Value: protects=closing a dialog whose invoker is still on the page returns focus there; when the invoker was removed
  // (its row deleted) focus lands on the fallback instead of <body>; fails_when=the fallback is applied even though the invoker
  // exists, or ignored when it is gone; why_new=only returnFocusRef was covered; seam=none; no_claim=jsdom focus, not a screen reader
  it("returns focus to a still-present invoker, and to the fallback only when the invoker is gone", () => {
    function FallbackHarness() {
      const [isOpen, setIsOpen] = useState(false);
      const [showRow, setShowRow] = useState(true);
      const fallbackRef = useRef<HTMLButtonElement>(null);

      return (
        <>
          <button ref={fallbackRef} type="button">Thêm công bù</button>
          {showRow ? (
            <button onClick={() => setIsOpen(true)} type="button">Xóa dòng</button>
          ) : null}
          <Dialog ariaLabelledBy="fallback-title" fallbackFocusRef={fallbackRef} isOpen={isOpen} onClose={() => setIsOpen(false)}>
            <h2 id="fallback-title">Xác nhận</h2>
            <button onClick={() => setShowRow(false)} type="button">Xóa</button>
          </Dialog>
        </>
      );
    }

    render(<FallbackHarness />);
    const rowButton = screen.getByRole("button", { name: "Xóa dòng" });
    rowButton.focus();
    fireEvent.click(rowButton);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(rowButton).toHaveFocus();

    rowButton.focus();
    fireEvent.click(rowButton);
    fireEvent.click(screen.getByRole("button", { name: "Xóa" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Xóa dòng" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm công bù" })).toHaveFocus();
  });
});
