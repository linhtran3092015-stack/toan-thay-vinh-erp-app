import { PublicCoachingForm } from "@/features/coaching/components/public-coaching-form";
import type { PublicCoachingQuestion } from "@/features/coaching/forms/coaching-form-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PublicCoachingFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("get_public_coaching_form", { p_token: token }); const row = data?.[0]; const state = row?.state ?? "invalid";
  if (state !== "active" || !row) return <PublicState state={state} />;
  const questions: PublicCoachingQuestion[] = data.filter((item) => item.question_id).map((item) => ({ configuration: (item.configuration ?? {}) as Record<string, unknown>, description: item.question_description, id: item.question_id!, required: item.is_required ?? false, title: item.question_title!, type: item.question_type as PublicCoachingQuestion["type"] }));
  return <PublicCoachingForm token={token} title={row.form_title!} instructions={row.instructions} questions={questions} />;
}
function PublicState({ state }: { state: string }) { const message = state === "submitted" ? "Phiếu này đã được gửi." : state === "expired" ? "Liên kết đã hết hạn." : state === "revoked" ? "Liên kết không còn hiệu lực." : "Liên kết không hợp lệ."; return <main className="mx-auto min-h-screen max-w-xl bg-canvas px-4 py-12"><section className="rounded-xl border border-hairline bg-surface-1 p-6 shadow-card"><h1 className="text-xl font-bold text-ink">{message}</h1></section></main>; }
