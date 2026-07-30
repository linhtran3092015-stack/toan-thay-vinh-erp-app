export const WEEKDAY_OPTIONS = [
  { label: "Thứ Hai", value: 1 },
  { label: "Thứ Ba", value: 2 },
  { label: "Thứ Tư", value: 3 },
  { label: "Thứ Năm", value: 4 },
  { label: "Thứ Sáu", value: 5 },
  { label: "Thứ Bảy", value: 6 },
  { label: "Chủ nhật", value: 7 },
] as const;

export function getVietnamBusinessDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Không xác định được ngày hiện tại theo giờ Việt Nam.");
  }

  return `${year}-${month}-${day}`;
}

export const formInputClassName =
  "min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:cursor-not-allowed disabled:bg-slate-100";
