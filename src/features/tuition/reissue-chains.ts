/** The two columns that link a reissued tuition item to the one it replaces. */
export interface ReissueChainItem {
  id: string;
  reissued_from_item_id: string | null;
}

/**
 * Per student, the original item (it holds the session lines) and the current
 * one (its amount and payment request). reissue_tuition_collection_item inserts
 * a replacement pointing at the original through reissued_from_item_id, without
 * lines and without touching the original: the period is locked and its items
 * are immutable, so their status never becomes "reissued".
 *
 * Pure so the class tuition tab and the tuition period read model share it.
 */
export function resolveReissueChains<T extends ReissueChainItem>(items: readonly T[]): Array<{ current: T; original: T }> {
  const byId = new Map(items.map((item) => [item.id, item]));
  const replaced = new Set(items.map((item) => item.reissued_from_item_id).filter((id): id is string => id !== null));

  return items
    .filter((item) => !replaced.has(item.id))
    .map((current) => {
      let original = current;
      const seen = new Set([current.id]);
      while (original.reissued_from_item_id && byId.has(original.reissued_from_item_id) && !seen.has(original.reissued_from_item_id)) {
        original = byId.get(original.reissued_from_item_id) as T;
        seen.add(original.id);
      }
      return { current, original };
    });
}
