import { z } from "zod";

const wifiNetworkSchema = z.object({
  bssid: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/, "BSSID cần có dạng AA:BB:CC:DD:EE:FF."),
  ssid: z.string().trim().min(1, "Bắt buộc nhập tên Wi-Fi.").max(128, "Tên Wi-Fi quá dài."),
});

export const attendanceVerificationConfigSchema = z
  .object({
    attendanceRadiusM: z.number().int().min(20, "Bán kính tối thiểu là 20 m.").max(2000, "Bán kính tối đa là 2.000 m."),
    centerLatitude: z.number().finite().min(-90, "Vĩ độ không hợp lệ.").max(90, "Vĩ độ không hợp lệ."),
    centerLongitude: z.number().finite().min(-180, "Kinh độ không hợp lệ.").max(180, "Kinh độ không hợp lệ."),
    centerName: z.string().trim().min(1, "Bắt buộc nhập tên Trung tâm.").max(160, "Tên Trung tâm quá dài."),
    gpsMaxAccuracyM: z.number().int().min(20, "Sai số GPS tối thiểu là 20 m.").max(200, "Sai số GPS tối đa là 200 m."),
    wifiNetworks: z.array(wifiNetworkSchema).max(20, "Chỉ được cấu hình tối đa 20 mạng Wi-Fi."),
    wifiRequiredForOffline: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.wifiRequiredForOffline && value.wifiNetworks.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Cần thêm ít nhất một mạng khi bật xác minh Wi-Fi.",
        path: ["wifiNetworks"],
      });
    }

    const identities = new Set<string>();
    for (const [index, network] of value.wifiNetworks.entries()) {
      const identity = `${network.ssid.toLocaleLowerCase("vi")}::${network.bssid}`;
      if (identities.has(identity)) {
        context.addIssue({
          code: "custom",
          message: "Mạng Wi-Fi này đang bị trùng.",
          path: ["wifiNetworks", index],
        });
      }
      identities.add(identity);
    }
  });

export type AttendanceVerificationConfigInput = z.input<typeof attendanceVerificationConfigSchema>;
