import { z } from "zod";

const optionalNumberSchema = z.number().finite().nullable();

export const timeEntryActionSchema = z
  .object({
    gpsAccuracyMeters: optionalNumberSchema.refine(
      (value) => value === null || (Number.isInteger(value) && value >= 0),
      "Độ chính xác GPS phải là số nguyên không âm.",
    ),
    gpsLatitude: optionalNumberSchema.refine(
      (value) => value === null || (value >= -90 && value <= 90),
      "Vĩ độ GPS không hợp lệ.",
    ),
    gpsLongitude: optionalNumberSchema.refine(
      (value) => value === null || (value >= -180 && value <= 180),
      "Kinh độ GPS không hợp lệ.",
    ),
    mode: z.enum(["online", "offline"]),
    wifiBssid: z
      .string()
      .trim()
      .toUpperCase()
      .max(17, "BSSID Wi-Fi không hợp lệ."),
    wifiSsid: z.string().trim().max(128, "Tên Wi-Fi quá dài."),
  })
  .superRefine((value, context) => {
    const hasLatitude = value.gpsLatitude !== null;
    const hasLongitude = value.gpsLongitude !== null;

    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: "custom",
        message: "GPS cần có cả vĩ độ và kinh độ.",
        path: hasLatitude ? ["gpsLongitude"] : ["gpsLatitude"],
      });
    }

    if (value.gpsAccuracyMeters !== null && !(hasLatitude && hasLongitude)) {
      context.addIssue({
        code: "custom",
        message: "Độ chính xác chỉ dùng cùng vị trí GPS.",
        path: ["gpsAccuracyMeters"],
      });
    }

    if (value.wifiBssid && !value.wifiSsid) {
      context.addIssue({
        code: "custom",
        message: "BSSID chỉ được nhập khi có tên Wi-Fi.",
        path: ["wifiSsid"],
      });
    }

    if (
      value.wifiBssid &&
      !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(value.wifiBssid)
    ) {
      context.addIssue({
        code: "custom",
        message: "BSSID cần có dạng AA:BB:CC:DD:EE:FF.",
        path: ["wifiBssid"],
      });
    }
  });
