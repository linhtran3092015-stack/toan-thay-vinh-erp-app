"use client";

import { useEffect, useState } from "react";

import type {
  OwnerPayrollEstimate,
  PayrollConnectionState,
  StaffPayrollEstimate,
} from "@/features/payroll/estimate/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Where the live estimate comes from. Production uses the real `/api/payroll/*`
 * endpoints plus the Supabase realtime channel; the /dev/payroll preview passes
 * an inert transport (fixtures, no subscription) because it runs on localhost
 * where .env.local may point at the production database.
 */
export interface PayrollEstimateTransport {
  /** Loads one estimate payload; rejects when it cannot be loaded. */
  load: (endpoint: string) => Promise<unknown>;
  /** Subscribes to estimate revisions for the month; returns the unsubscribe. */
  subscribe: (options: {
    channelName: string;
    month: string;
    onChange: () => void;
    onStatus: (status: string) => void;
  }) => () => void;
}

export const livePayrollEstimateTransport: PayrollEstimateTransport = {
  load: async (endpoint) => {
    const res = await fetch(endpoint, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch estimate: ${res.status}`);
    }

    return res.json();
  },
  subscribe: ({ channelName, month, onChange, onStatus }) => {
    try {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase
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
            onChange();
          },
        )
        .subscribe((status: string) => {
          onStatus(status);
        });

      return () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      // Supabase env not available (e.g. testing / offline)
      return () => {};
    }
  },
};

interface UsePayrollLiveEstimateOptions<T> {
  initialData?: T | null;
  month: string;
  positionCode?: string | null;
  scope: "owner" | "staff";
  /**
   * Nhân sự cần xem (chỉ với scope "staff"). Bỏ trống = người đang đăng nhập;
   * có giá trị = chủ trung tâm xem lương theo ngày của nhân sự đó.
   */
  staffId?: string | null;
  /** Defaults to the real endpoints + realtime channel. Must be a stable reference. */
  transport?: PayrollEstimateTransport;
}

export function buildEstimateEndpoint({
  month,
  positionCode,
  scope,
  staffId,
}: Pick<UsePayrollLiveEstimateOptions<unknown>, "month" | "positionCode" | "scope" | "staffId">): string {
  const monthParam = `month=${encodeURIComponent(month)}`;

  if (scope === "owner") {
    return `/api/payroll/owner-estimate?${monthParam}${positionCode ? `&position=${encodeURIComponent(positionCode)}` : ""}`;
  }

  if (staffId) {
    return `/api/payroll/staff-estimate?${monthParam}&staffId=${encodeURIComponent(staffId)}`;
  }

  return `/api/payroll/estimate?${monthParam}`;
}

export function usePayrollLiveEstimate<
  T extends StaffPayrollEstimate | OwnerPayrollEstimate,
>({
  initialData = null,
  month,
  positionCode,
  scope,
  staffId = null,
  transport = livePayrollEstimateTransport,
}: UsePayrollLiveEstimateOptions<T>) {
  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialData);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<PayrollConnectionState>("connected");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(() => new Date());

  const refetch = async () => {
    setIsLoading(true);

    try {
      const endpoint = buildEstimateEndpoint({ month, positionCode, scope, staffId });
      const json = (await transport.load(endpoint)) as T;
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
        const endpoint = buildEstimateEndpoint({ month, positionCode, scope, staffId });
        const json = (await transport.load(endpoint)) as T;
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

    const unsubscribe = transport.subscribe({
      channelName: `payroll_live_${scope}_${month}_${positionCode ?? "all"}_${staffId ?? "me"}`,
      month,
      onChange: scheduleReload,
      onStatus: (status) => {
        if (status === "SUBSCRIBED") {
          setConnectionState("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnectionState("reconnecting");
        }
      },
    });

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
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, [month, positionCode, scope, staffId, transport]);

  return {
    connectionState,
    data,
    hasAttemptedFetch,
    isLoading,
    lastRefreshedAt,
    refetch,
  };
}
