"use client";

import { useEffect, useRef, useState } from "react";

import type { AttendanceHeartbeatResult } from "@/features/timekeeping/time-entry-action-types";
import { submitAttendanceHeartbeatAction } from "@/features/timekeeping/time-entry-actions";

export type LocationVerificationStatus =
  | "locating"
  | "confirmed_inside"
  | "signal_lost"
  | "outside_center";

export const LOCATION_STATUS_LABELS: Record<LocationVerificationStatus, string> = {
  confirmed_inside: "Đã xác nhận tại Trung tâm",
  locating: "Đang xác định vị trí",
  outside_center: "Ngoài khu vực Trung tâm",
  signal_lost: "Mất tín hiệu vị trí",
};

interface UseAttendanceHeartbeatOptions {
  activeSessionId: string | null;
  enabled: boolean;
  onSessionClosed?: (result: AttendanceHeartbeatResult & { sessionActive: false }) => void;
}

export function useAttendanceHeartbeat({
  activeSessionId,
  enabled,
  onSessionClosed,
}: UseAttendanceHeartbeatOptions) {
  const [status, setStatus] = useState<LocationVerificationStatus>("locating");
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const lastSubmittedTimeRef = useRef<number>(0);
  const isSubmittingRef = useRef<boolean>(false);
  const onSessionClosedRef = useRef(onSessionClosed);

  useEffect(() => {
    onSessionClosedRef.current = onSessionClosed;
  }, [onSessionClosed]);

  useEffect(() => {
    if (!enabled || !activeSessionId || typeof window === "undefined") {
      return;
    }

    if (!navigator.geolocation) {
      const timer = setTimeout(() => {
        setStatus("signal_lost");
        setServerMessage("Trình duyệt không hỗ trợ định vị GPS.");
      }, 0);
      return () => clearTimeout(timer);
    }

    let watchId: number | null = null;
    let keepAliveIntervalId: ReturnType<typeof setInterval> | null = null;

    const processLocationSample = async (position: GeolocationPosition) => {
      const now = Date.now();
      // Throttle rapid updates to at least 3 seconds apart
      if (isSubmittingRef.current || now - lastSubmittedTimeRef.current < 3000) {
        return;
      }

      isSubmittingRef.current = true;
      lastSubmittedTimeRef.current = now;

      try {
        const result = await submitAttendanceHeartbeatAction({
          gpsAccuracyMeters: Math.max(0, Math.round(position.coords.accuracy)),
          gpsLatitude: position.coords.latitude,
          gpsLongitude: position.coords.longitude,
        });

        if (!result.sessionActive) {
          setStatus("outside_center");
          if ("messageVi" in result && result.messageVi) {
            setServerMessage(result.messageVi);
          }
          if (onSessionClosedRef.current) {
            onSessionClosedRef.current(result as AttendanceHeartbeatResult & { sessionActive: false });
          }
          return;
        }

        if (result.verifiedInside) {
          setStatus("confirmed_inside");
          setDistanceM(result.distanceM ?? null);
          setServerMessage(null);
        } else if (result.signalDegraded) {
          setStatus("signal_lost");
          setServerMessage(result.messageVi ?? "Chưa xác minh được vị trí hoặc kết nối. Vui lòng thử lại.");
        } else if (result.ambiguousSample) {
          setStatus("locating");
          setServerMessage(result.messageVi ?? "Vị trí đang ở vùng ranh giới Trung tâm.");
        }
      } catch {
        setStatus("signal_lost");
      } finally {
        isSubmittingRef.current = false;
      }
    };

    const handleFreshSampleError = () => {
      // If fresh location sample fails, do NOT update location timestamp
      // UI indicates signal loss and watchdog will terminate if signal remains lost
      setStatus("signal_lost");
    };

    // 1. Primary fast movement detector using watchPosition
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        void processLocationSample(position);
      },
      handleFreshSampleError,
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    );

    // 2. Backup keep-alive timer executing every 25s with FRESH sample (maximumAge: 0)
    keepAliveIntervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          void processLocationSample(position);
        },
        handleFreshSampleError,
        {
          enableHighAccuracy: true,
          maximumAge: 0, // MUST acquire fresh position sample, never reuse cached
          timeout: 10000,
        },
      );
    }, 25000);

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (keepAliveIntervalId !== null) {
        clearInterval(keepAliveIntervalId);
      }
    };
  }, [activeSessionId, enabled]);

  return {
    distanceM,
    serverMessage,
    status,
    statusLabel: LOCATION_STATUS_LABELS[status],
  };
}
