export const coachingQuestionTypes = [
  "short_text",
  "long_text",
  "single_choice",
  "multiple_choice",
  "scale",
  "number",
] as const;

export type CoachingQuestionType = (typeof coachingQuestionTypes)[number];

export interface CoachingQuestionDraft {
  configuration: Record<string, unknown>;
  description: string;
  required: boolean;
  title: string;
  type: CoachingQuestionType;
}

export interface PublicCoachingQuestion {
  configuration: Record<string, unknown>;
  description: string | null;
  id: string;
  required: boolean;
  title: string;
  type: CoachingQuestionType;
}

export const coachingQuestionLabels: Record<CoachingQuestionType, string> = {
  short_text: "Câu trả lời ngắn",
  long_text: "Câu trả lời dài",
  single_choice: "Một lựa chọn",
  multiple_choice: "Nhiều lựa chọn",
  scale: "Thang điểm",
  number: "Số",
};

export function defaultQuestion(type: CoachingQuestionType): CoachingQuestionDraft {
  if (type === "single_choice" || type === "multiple_choice") {
    return { configuration: { options: ["Lựa chọn 1", "Lựa chọn 2"] }, description: "", required: false, title: "Câu hỏi mới", type };
  }
  if (type === "scale") {
    return { configuration: { min: 1, max: 5, minLabel: "Thấp", maxLabel: "Cao" }, description: "", required: false, title: "Câu hỏi mới", type };
  }
  return { configuration: {}, description: "", required: false, title: "Câu hỏi mới", type };
}
