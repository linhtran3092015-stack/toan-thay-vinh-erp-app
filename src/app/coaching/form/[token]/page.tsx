import type { Metadata } from "next";

import { PublicCoachingForm } from "@/features/coaching/components/public-coaching-form";
import {
  getStudentGivenName,
  PUBLIC_FORM_UNAVAILABLE_STATE,
  PublicCoachingFormState,
} from "@/features/coaching/components/public-coaching-form-shell";
import type { PublicCoachingQuestion } from "@/features/coaching/forms/coaching-form-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Opened without a session and it names the child: keep every token URL out of search indexes.
export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

export default async function PublicCoachingFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_public_coaching_form", { p_token: token });
  if (error) {
    // A failed read says nothing about the link: offer a reload, not the final "invalid" screen.
    return (
      <PublicCoachingFormState
        reloadHref={`/coaching/form/${encodeURIComponent(token)}`}
        state={PUBLIC_FORM_UNAVAILABLE_STATE}
      />
    );
  }
  const row = data?.[0];
  const state = row?.state ?? "invalid";

  if (state !== "active" || !row) {
    return <PublicCoachingFormState state={state} />;
  }

  const questions: PublicCoachingQuestion[] = data
    .filter((item) => item.question_id)
    .map((item) => ({
      configuration: (item.configuration ?? {}) as Record<string, unknown>,
      description: item.question_description,
      id: item.question_id!,
      required: item.is_required ?? false,
      title: item.question_title!,
      type: item.question_type as PublicCoachingQuestion["type"],
    }));

  return (
    <PublicCoachingForm
      instructions={row.instructions}
      questions={questions}
      studentName={getStudentGivenName(row.student_name)}
      title={row.form_title!}
      token={token}
    />
  );
}
