/**
 * Accent- and case-insensitive search text for client-side list filters.
 * `đ` has no Unicode decomposition, so it is folded by hand.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .replace(/đ/g, "d")
    .trim();
}
