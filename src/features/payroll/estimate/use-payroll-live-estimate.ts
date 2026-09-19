"use client";

import { useEffect, useState } from "react";

import type {
  OwnerPayrollEstimate,
  PayrollConnectionState,
  StaffPayrollEstimate,
} from "@/features/payroll/estimate/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface UsePayrollLiveEstimateOptions<T> {
  initialData?: T | null;
  month: string;
  positionCode?: string | null;
  scope: "owner" | "staff";
}

export function usePayrollLiveEstimate<
  T extends StaffPayrollEstimate | OwnerPayrollEstimate,
>({
  initialData = null,
  month,
  positionCode,
  scope,
}: UsePayrollLiveEstimateOptions<T>) {
  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialData);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<PayrollConnectionState>("connected");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(() => new Date());

  const refetch = async () => {
    setIsLoading(true);

    try {
      const endpoint =
        scope === "owner"
          ? `/api/payroll/owner-estimate?month=${encodeURIComponent(month)}${positionCode ? `&position=${encodeURIComponent(positionCode)}` : ""}`
          : `/api/payroll/estimate?month=${encodeURIComponent(month)}`;

      const res = await fetch(endpoint, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch estimate: ${res.status}`);
      }

      const json = (await res.json()) as T;
      setData(json);
      setConnectionState("connected");
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error("[usePayrollLiveEstimate] fetch error:", err);
      setConnectionState("stale");
    } finally {
      setIsLoading(false);
      setHasAttemptedFetch(true);
    }
  };

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null;
    let isFetching = false;

    const runFetch = async () => {
      if (isFetching) return;
      isFetching = true;
      setIsLoading(true);

      try {
        const endpoint =
          scope === "owner"
            ? `/api/payroll/owner-estimate?month=${encodeURIComponent(month)}${positionCode ? `&position=${encodeURIComponent(positionCode)}` : ""}`
            : `/api/payroll/estimate?month=${encodeURIComponent(month)}`;

        const res = await fetch(endpoint, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch estimate: ${res.status}`);
        }

        const json = (await res.json()) as T;
        setData(json);
        setConnectionState("connected");
        setLastRefreshedAt(new Date());
      } catch (err) {
        console.error("[usePayrollLiveEstimate] fetch error:", err);
        setConnectionState("stale");
      } finally {
        isFetching = false;
        setIsLoading(false);
        setHasAttemptedFetch(true);
      }
    };

    const scheduleReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void runFetch();
      }, 400);
    };

    let supabase: ReturnType<typeof getSupabaseBrowserClient> | null = null;
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

    try {
      supabase = getSupabaseBrowserClient();
      const channelName = `payroll_live_${scope}_${month}_${positionCode ?? "all"}`;

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            filter: `month=eq.${month}`,
            schema: "public",
            table: "payroll_live_revisions",
          },
          () => {
            scheduleReload();
          },
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            setConnectionState("connected");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setConnectionState("reconnecting");
          }
        });
    } catch {
      // Supabase env not available (e.g. testing / offline)
    }

    // Always fetch fresh estimate on mount / parameter change
    void runFetch();

    const pollInterval: NodeJS.Timeout = setInterval(() => {
      if (document.visibilityState === "visible") {
        void runFetch();
      }
    }, 30000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void runFetch();
      }
    };

    const handleFocus = () => void runFetch();
    const handleOnline = () => {
      setConnectionState("connected");
      void runFetch();
    };
    const handleOffline = () => setConnectionState("stale");

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      if (channel && supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [month, positionCode, scope]);

  return {
    connectionState,
    data,
    hasAttemptedFetch,
    isLoading,
    lastRefreshedAt,
    refetch,
  };
}
