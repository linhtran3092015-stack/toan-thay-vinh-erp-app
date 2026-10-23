import "server-only";

import { DEFAULT_COMMENT_PHRASES, PHRASE_SLOTS, type CommentPhrases, type PhraseSlot } from "@/features/ai-grading/comment";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Active comment phrases by slot; a slot with none falls back to the seed phrases. */
export async function getGradingCommentPhrases(): Promise<CommentPhrases> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("list_grading_comment_phrases");
    if (error || !Array.isArray(data)) return DEFAULT_COMMENT_PHRASES;
    const bySlot = Object.fromEntries(PHRASE_SLOTS.map((slot) => [slot, [] as string[]])) as Record<PhraseSlot, string[]>;
    for (const row of data as Array<{ slot: string; text: string }>) {
      if ((PHRASE_SLOTS as readonly string[]).includes(row.slot) && row.text.trim()) bySlot[row.slot as PhraseSlot].push(row.text.trim());
    }
    return Object.fromEntries(
      PHRASE_SLOTS.map((slot) => [slot, bySlot[slot].length > 0 ? bySlot[slot] : DEFAULT_COMMENT_PHRASES[slot]]),
    ) as CommentPhrases;
  } catch {
    return DEFAULT_COMMENT_PHRASES;
  }
}
