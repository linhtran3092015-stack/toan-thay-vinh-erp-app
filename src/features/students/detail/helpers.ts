export function getStudentDetailHref(
  student: { id: string },
  directoryQuery?: string,
): string {
  const pathname = `/students/${student.id}`;
  return directoryQuery ? `${pathname}?${directoryQuery}` : pathname;
}

export function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  const lastTwo = words.slice(-2);

  return lastTwo
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("vi");
}

export function formatDeltaSessions(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}
