/** Presentation only: retain source lines and sum stored amounts, never recalculate pay. */
export function groupPayrollLines<T extends { lineType: string; direction: string; amountVnd: number }>(lines: readonly T[]) {
  const groups = new Map<string, { key: string; lineType: string; direction: string; amountVnd: number; lines: T[] }>();
  for (const line of lines) {
    const key = `${line.direction}:${line.lineType}`;
    const group = groups.get(key) ?? { key, lineType: line.lineType, direction: line.direction, amountVnd: 0, lines: [] };
    group.amountVnd += line.amountVnd;
    group.lines.push(line);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export const attendanceLineTypes = new Set(["base_offline", "base_online", "hourly_wage"]);
