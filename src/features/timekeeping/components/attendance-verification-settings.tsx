"use client";

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { MapPin, Plus, ShieldCheck, Trash2, Wifi } from "lucide-react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateAttendanceVerificationConfigAction } from "@/features/timekeeping/attendance-verification-actions";
import type { AttendanceVerificationActionState } from "@/features/timekeeping/attendance-verification-action-types";
import type { AttendanceVerificationConfig } from "@/features/timekeeping/types";

const inputClassName =
  "min-h-11 w-full rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

interface EditableNetwork {
  bssid: string;
  key: string;
  ssid: string;
}

function createNetworkKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `wifi-${Date.now()}-${Math.random()}`;
}

export function AttendanceVerificationSettings({
  initialConfig,
}: {
  initialConfig: AttendanceVerificationConfig;
}) {
  const headingId = useId();
  const [isPending, startTransition] = useTransition();
  const [isLocating, setIsLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [result, setResult] = useState<AttendanceVerificationActionState | null>(null);
  const [centerName, setCenterName] = useState(initialConfig.centerName);
  const [latitude, setLatitude] = useState(initialConfig.centerLatitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(initialConfig.centerLongitude?.toString() ?? "");
  const [radius, setRadius] = useState(initialConfig.attendanceRadiusM.toString());
  const [maxAccuracy, setMaxAccuracy] = useState(initialConfig.gpsMaxAccuracyM.toString());
  const [wifiRequired, setWifiRequired] = useState(initialConfig.wifiRequiredForOffline);
  const [networks, setNetworks] = useState<EditableNetwork[]>(
    initialConfig.wifiNetworks.map((network) => ({
      bssid: network.bssid,
      key: network.id ?? createNetworkKey(),
      ssid: network.ssid,
    })),
  );

  const captureCenterLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage("Trình duyệt hiện tại không hỗ trợ định vị GPS.");
      return;
    }

    setIsLocating(true);
    setLocationMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setLocationMessage(
          `Đã lấy vị trí thiết bị, sai số khoảng ${Math.round(position.coords.accuracy)} m.`,
        );
        setIsLocating(false);
      },
      () => {
        setLocationMessage("Không lấy được vị trí. Hãy cho phép trình duyệt truy cập vị trí hoặc nhập tọa độ.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  };

  const addNetwork = () => {
    setNetworks((current) => [
      ...current,
      { bssid: "", key: createNetworkKey(), ssid: "" },
    ]);
  };

  const updateNetwork = (key: string, field: "ssid" | "bssid", value: string) => {
    setNetworks((current) => current.map((network) => (
      network.key === key
        ? { ...network, [field]: field === "bssid" ? value.toUpperCase() : value }
        : network
    )));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending || isLocating) return;
    setResult(null);

    startTransition(async () => {
      const actionResult = await updateAttendanceVerificationConfigAction({
        attendanceRadiusM: Number(radius),
        centerLatitude: Number(latitude),
        centerLongitude: Number(longitude),
        centerName,
        gpsMaxAccuracyM: Number(maxAccuracy),
        wifiNetworks: networks.map(({ bssid, ssid }) => ({ bssid, ssid })),
        wifiRequiredForOffline: wifiRequired,
      });
      setResult(actionResult);
    });
  };

  const fieldErrors = result?.status === "error" ? result.fieldErrors ?? {} : {};
  const locked = isPending || isLocating;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-lg border border-border-subtle bg-surface-base"
    >
      <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck aria-hidden="true" className="text-action-link" size={20} />
            <h2 className="text-section-title font-semibold text-text-strong" id={headingId}>
              Xác minh chấm công tại Trung tâm
            </h2>
            <Badge tone={initialConfig.configured ? "success" : "warning"}>
              {initialConfig.configured ? "Đã cấu hình" : "Chưa cấu hình"}
            </Badge>
          </div>
          <p className="mt-1 text-secondary text-text-muted">
            Chủ trung tâm tự cập nhật vị trí và Wi-Fi; thay đổi áp dụng ngay cho check-in và check-out tại Trung tâm.
          </p>
        </div>
      </div>

      <form className="grid gap-5 p-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-4 rounded-lg border border-border-subtle p-4">
            <div className="flex items-center gap-2">
              <MapPin aria-hidden="true" className="text-action-link" size={19} />
              <h3 className="font-semibold text-text-strong">Vị trí GPS</h3>
              <Badge tone="info">Bắt buộc</Badge>
            </div>

            <Field error={fieldErrors.centerName?.[0]} label="Tên địa điểm">
              <input className={inputClassName} disabled={locked} maxLength={160} onChange={(event) => setCenterName(event.target.value)} required value={centerName} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field error={fieldErrors.centerLatitude?.[0]} label="Vĩ độ">
                <input className={inputClassName} disabled={locked} inputMode="decimal" max="90" min="-90" onChange={(event) => setLatitude(event.target.value)} required step="0.000001" type="number" value={latitude} />
              </Field>
              <Field error={fieldErrors.centerLongitude?.[0]} label="Kinh độ">
                <input className={inputClassName} disabled={locked} inputMode="decimal" max="180" min="-180" onChange={(event) => setLongitude(event.target.value)} required step="0.000001" type="number" value={longitude} />
              </Field>
            </div>

            <Button disabled={locked} onClick={captureCenterLocation} type="button" variant="outline">
              <MapPin aria-hidden="true" size={17} />
              {isLocating ? "Đang lấy vị trí…" : "Dùng vị trí hiện tại"}
            </Button>
            {locationMessage ? <p aria-live="polite" className="text-caption text-text-muted">{locationMessage}</p> : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field error={fieldErrors.attendanceRadiusM?.[0]} hint="Từ 20 đến 2.000 m" label="Bán kính chấm công (m)">
                <input className={inputClassName} disabled={locked} max="2000" min="20" onChange={(event) => setRadius(event.target.value)} required type="number" value={radius} />
              </Field>
              <Field error={fieldErrors.gpsMaxAccuracyM?.[0]} hint="Từ 20 đến 200 m" label="Sai số GPS tối đa (m)">
                <input className={inputClassName} disabled={locked} max="200" min="20" onChange={(event) => setMaxAccuracy(event.target.value)} required type="number" value={maxAccuracy} />
              </Field>
            </div>
          </div>

          <div className="grid content-start gap-4 rounded-lg border border-border-subtle p-4">
            <div className="flex items-center gap-2">
              <Wifi aria-hidden="true" className="text-action-link" size={19} />
              <h3 className="font-semibold text-text-strong">Mạng Wi-Fi được phép</h3>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border-subtle bg-surface-subtle p-3">
              <input checked={wifiRequired} className="mt-1 size-4" disabled={locked} onChange={(event) => setWifiRequired(event.target.checked)} type="checkbox" />
              <span>
                <span className="block text-body font-semibold text-text-strong">Bắt buộc khớp Wi-Fi khi chấm công tại Trung tâm</span>
                <span className="mt-1 block text-caption text-text-muted">Nếu bật, nhân sự phải nhập đúng cả tên mạng và BSSID đã đăng ký.</span>
              </span>
            </label>

            <div className="rounded-md border border-warning-border bg-warning-bg p-3 text-caption text-text-strong">
              Trình duyệt web không thể tự đọc SSID/BSSID. Vì vậy Wi-Fi là lớp đối chiếu bổ sung do nhân sự nhập; GPS vẫn là bằng chứng vị trí chính.
            </div>

            <div className="grid gap-3">
              {networks.map((network, index) => (
                <div className="grid gap-2 rounded-md border border-border-subtle p-3" key={network.key}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-label text-text-strong">Mạng {index + 1}</p>
                    <Button aria-label={`Xóa mạng ${index + 1}`} disabled={locked} onClick={() => setNetworks((current) => current.filter((item) => item.key !== network.key))} size="sm" type="button" variant="ghost">
                      <Trash2 aria-hidden="true" size={16} />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1 text-caption text-text-muted">
                      Tên Wi-Fi (SSID)
                      <input className={inputClassName} disabled={locked} maxLength={128} onChange={(event) => updateNetwork(network.key, "ssid", event.target.value)} placeholder="Ví dụ: TTV-Staff" value={network.ssid} />
                    </label>
                    <label className="grid gap-1 text-caption text-text-muted">
                      BSSID
                      <input className={inputClassName} disabled={locked} maxLength={17} onChange={(event) => updateNetwork(network.key, "bssid", event.target.value)} placeholder="AA:BB:CC:DD:EE:FF" value={network.bssid} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            {fieldErrors.wifiNetworks?.[0] ? <p className="text-caption text-danger">{fieldErrors.wifiNetworks[0]}</p> : null}
            <Button disabled={locked || networks.length >= 20} onClick={addNetwork} type="button" variant="outline">
              <Plus aria-hidden="true" size={17} /> Thêm mạng Wi-Fi
            </Button>
          </div>
        </div>

        {result ? (
          <ResultBanner
            description={result.message}
            title={result.status === "success" ? "Đã lưu cấu hình" : "Không thể lưu cấu hình"}
            tone={result.status === "success" ? "success" : "error"}
          />
        ) : null}

        <div className="flex justify-end">
          <Button disabled={locked} isLoading={isPending} size="lg" type="submit">
            {isPending ? "Đang lưu…" : "Lưu điều kiện chấm công"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function Field({
  children,
  error,
  hint,
  label,
}: {
  children: ReactNode;
  error?: string;
  hint?: string;
  label: string;
}) {
  return (
    <label className="grid gap-1.5 text-label text-text-default">
      {label}
      {children}
      {hint && !error ? <span className="text-caption font-normal text-text-muted">{hint}</span> : null}
      {error ? <span className="text-caption font-normal text-danger">{error}</span> : null}
    </label>
  );
}
