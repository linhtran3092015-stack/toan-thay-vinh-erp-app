"use client";

import { useFormStatus } from "react-dom";

export function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="flex h-11 w-full items-center px-3 text-left text-sm font-semibold text-danger hover:bg-danger-bg disabled:cursor-wait disabled:text-danger/60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Đang đăng xuất..." : "Đăng xuất"}
    </button>
  );
}
