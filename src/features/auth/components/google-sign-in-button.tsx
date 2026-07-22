"use client";

import { useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface GoogleSignInButtonProps {
  configured: boolean;
  nextPath: string;
}

export function GoogleSignInButton({
  configured,
  nextPath,
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSignIn() {
    if (!configured || isLoading) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(undefined);

    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", nextPath);

      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        throw new Error("OAuth redirect unavailable");
      }

      window.location.assign(data.url);
    } catch {
      setErrorMessage("Không thể bắt đầu đăng nhập Google. Vui lòng thử lại.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        className={cn(
          "flex h-12 w-full items-center justify-center gap-3 rounded-md border border-hairline bg-white px-4 text-sm font-semibold text-ink shadow-sm transition-colors",
          "hover:border-secondary hover:bg-canvas focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-secondary/25",
          "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-subtle",
        )}
        disabled={!configured || isLoading}
        onClick={handleSignIn}
        type="button"
      >
        <span
          aria-hidden="true"
          className="flex h-6 w-6 items-center justify-center rounded-pill border border-hairline text-sm font-bold text-secondary"
        >
          G
        </span>
        {isLoading ? "Đang chuyển đến Google..." : "Tiếp tục với Google"}
      </button>
      {errorMessage ? (
        <p className="text-sm leading-6 text-danger" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
