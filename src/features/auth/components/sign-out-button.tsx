"use client";

import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-body font-medium text-danger hover:bg-danger-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus disabled:cursor-wait disabled:text-danger/60"
      disabled={pending}
      role="menuitem"
      type="submit"
    >
      <LogOut aria-hidden="true" size={16} strokeWidth={1.8} />
      {pending ? "Đang đăng xuất..." : "Đăng xuất"}
    </button>
  );
}
