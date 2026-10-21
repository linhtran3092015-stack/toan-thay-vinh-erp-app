/**
 * Student list order. Vietnamese rolls sort by the given name (the last word
 * of the full name, "tên"), then by the family and middle names.
 */
const collator = new Intl.Collator("vi", { numeric: true });

export function givenNameOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return words[words.length - 1] ?? "";
}

/** "Trần Văn An" < "Nguyễn Thị Bình" < "Lê Bình": given name first, then the full name. */
export function compareStudentNames(left: string, right: string): number {
  return (
    collator.compare(givenNameOf(left), givenNameOf(right)) ||
    collator.compare(left.trim(), right.trim())
  );
}

/** A copy of `rows` in roll order; `getName` reads the student's full name. */
export function sortByStudentName<T>(
  rows: readonly T[],
  getName: (row: T) => string,
): T[] {
  return [...rows].sort((left, right) => compareStudentNames(getName(left), getName(right)));
}

/** The master student list: grade 12 down to grade 1, then roll order within a grade. */
export function compareStudentsByGradeThenName(
  left: { currentGrade: number; fullName: string },
  right: { currentGrade: number; fullName: string },
): number {
  return right.currentGrade - left.currentGrade || compareStudentNames(left.fullName, right.fullName);
}
