// Value: protects=production live estimate wiring after the transport extraction: the default transport subscribes to payroll_live_revisions for the month,
//   a revision triggers one debounced re-fetch, CHANNEL_ERROR/SUBSCRIBED drive connectionState, and unmount removes the channel;
// fails_when=the default transport stops subscribing or filters the wrong month, onChange/onStatus are not wired to the hook, the debounce is lost, or cleanup no longer calls removeChannel (leaked channels);
// why_new=live-estimate-cards mocks the Supabase client with inert callbacks, so no test drives a realtime event or checks channel cleanup;
// seam=none (default transport; Supabase browser client and global fetch mocked);
// no_claim=does not prove Supabase delivers postgres_changes for payroll_live_revisions in production (mocked client; unit only)
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePayrollLiveEstimate } from "@/features/payroll/estimate/use-payroll-live-estimate";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: vi.fn() }));

interface FakeChannel {
  filter?: Record<string, unknown>;
  name: string;
  onChange?: () => void;
  onStatus?: (status: string) => void;
}

const channels: FakeChannel[] = [];
const removeChannel = vi.fn(() => Promise.resolve());
const fetchMock = vi.fn();

beforeEach(() => {
  channels.length = 0;
  vi.mocked(getSupabaseBrowserClient).mockReturnValue({
    channel: (name: string) => {
      const record: FakeChannel = { name };
      channels.push(record);
      const api = {
        on: (_event: string, filter: Record<string, unknown>, callback: () => void) => {
          record.filter = filter;
          record.onChange = callback;
          return api;
        },
        subscribe: (callback: (status: string) => void) => {
          record.onStatus = callback;
          return record;
        },
      };
      return api;
    },
    removeChannel,
  } as never);
  fetchMock.mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify({ month: "2026-10-01" }), { headers: { "Content-Type": "application/json" }, status: 200 })),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("usePayrollLiveEstimate with the default live transport", () => {
  it("subscribes to the month's revisions, re-fetches once per burst of changes and tracks channel status", async () => {
    const { result, unmount } = renderHook(() =>
      usePayrollLiveEstimate({ month: "2026-10-01", scope: "owner" }),
    );

    await waitFor(() => expect(result.current.hasAttemptedFetch).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/payroll/owner-estimate?month=2026-10-01");

    expect(channels).toHaveLength(1);
    const [channel] = channels;
    expect(channel.name).toBe("payroll_live_owner_2026-10-01_all_me");
    expect(channel.filter).toMatchObject({ filter: "month=eq.2026-10-01", schema: "public", table: "payroll_live_revisions" });

    act(() => channel.onStatus?.("CHANNEL_ERROR"));
    expect(result.current.connectionState).toBe("reconnecting");
    act(() => channel.onStatus?.("SUBSCRIBED"));
    expect(result.current.connectionState).toBe("connected");

    vi.useFakeTimers();
    act(() => {
      channel.onChange?.();
      channel.onChange?.();
      channel.onChange?.();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();

    unmount();
    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });

  it("marks the estimate stale when the endpoint answers with an error status", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockImplementation(() => Promise.resolve(new Response("forbidden", { status: 403 })));

    const { result } = renderHook(() =>
      usePayrollLiveEstimate({ month: "2026-10-01", scope: "staff", staffId: "00000000-0000-4000-8000-000000000002" }),
    );

    await waitFor(() => expect(result.current.hasAttemptedFetch).toBe(true));
    expect(result.current.connectionState).toBe("stale");
    expect(result.current.data).toBeNull();
    expect(channels[0].name).toBe("payroll_live_staff_2026-10-01_all_00000000-0000-4000-8000-000000000002");
    consoleError.mockRestore();
  });

  // Value: protects=the remaining connection-state transitions: a TIMED_OUT channel reads "reconnecting", going offline reads "stale", and unmount removes the 'offline' listener;
  // fails_when=TIMED_OUT is ignored (the badge says connected while realtime is down), the offline handler stops marking the estimate stale, or the listener leaks past unmount;
  // why_new=review fix T2: only CHANNEL_ERROR/SUBSCRIBED and HTTP errors were driven;
  // seam=default transport with the Supabase browser client and fetch mocked; window events dispatched directly; no_claim=does not prove browsers fire offline/online reliably
  it("reconnects on TIMED_OUT, goes stale offline and removes the offline listener on unmount", async () => {
    const addListener = vi.spyOn(window, "addEventListener");
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { result, unmount } = renderHook(() =>
      usePayrollLiveEstimate({ month: "2026-10-01", scope: "owner" }),
    );

    await waitFor(() => expect(result.current.hasAttemptedFetch).toBe(true));
    act(() => channels[0].onStatus?.("TIMED_OUT"));
    expect(result.current.connectionState).toBe("reconnecting");

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.connectionState).toBe("stale");

    unmount();
    const offlineRemovals = removeListener.mock.calls.filter(([type]) => type === "offline");
    expect(offlineRemovals).toHaveLength(1);
    // The handler removed is the very one that was added (same reference), so a
    // later offline event no longer reaches the unmounted hook.
    const offlineAdds = addListener.mock.calls.filter(([type]) => type === "offline");
    expect(offlineAdds).toHaveLength(1);
    expect(offlineRemovals[0][1]).toBe(offlineAdds[0][1]);
    addListener.mockRestore();
    removeListener.mockRestore();
  });

  // Value: protects=the live estimate still loads once when the Supabase browser client cannot be created (missing env), and unmount is clean with no channel to remove;
  // fails_when=a throwing getSupabaseBrowserClient breaks the hook (no fetch, error thrown on mount) or unmount calls removeChannel on a channel that never existed;
  // why_new=review pass 2 (17c): the subscribe catch branch was never driven;
  // seam=default transport with getSupabaseBrowserClient mocked to throw and fetch mocked; no_claim=does not prove realtime recovers once the env is available
  it("still fetches once and unmounts cleanly when the Supabase client is unavailable", async () => {
    vi.mocked(getSupabaseBrowserClient).mockImplementation(() => {
      throw new Error("Supabase env missing");
    });

    const { result, unmount } = renderHook(() =>
      usePayrollLiveEstimate({ month: "2026-10-01", scope: "owner" }),
    );

    await waitFor(() => expect(result.current.hasAttemptedFetch).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ month: "2026-10-01" });
    expect(result.current.connectionState).toBe("connected");
    expect(channels).toHaveLength(0);

    expect(() => unmount()).not.toThrow();
    expect(removeChannel).not.toHaveBeenCalled();
  });
});
