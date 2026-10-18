// Compile-time only (`npm run typecheck`): the eval's request builders must
// produce exactly what @anthropic-ai/sdk accepts. Never executed; needs no API key.
import type Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageStreamParams } from "@anthropic-ai/sdk/resources/beta/messages/messages";

import {
  buildGradeParams,
  buildKeyExtractionParams,
  customId,
  GRADE_CONFIGS,
  summarizeBatchResult,
  type AnswerKey,
} from "./lib.mjs";

const key: AnswerKey = {
  test_id: "MAU-1",
  confirmed: true,
  questions: [{ label: "1", prompt_text: "Tính 2 + 3", max_points: 10, final_answer: "5" }],
};

// Grading: one Message Batches request per (configuration, run, submission).
const gradeParams: Anthropic.MessageCreateParamsNonStreaming = buildGradeParams({
  config: GRADE_CONFIGS[0],
  key,
  answerText: "2 + 3 = 5",
});
const batchParams: Anthropic.Messages.BatchCreateParams = {
  requests: GRADE_CONFIGS.map((config) => ({
    custom_id: customId(config.id, 1, "sub_0123456789ab"),
    params: buildGradeParams({ config, key, answerText: "5" }),
  })),
};

// Answer-key extraction: streamed beta request with server-side fallback.
const keyParams: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming = buildKeyExtractionParams({
  pages: [{ mediaType: "image/jpeg", base64: "" }],
});
const streamParams: BetaMessageStreamParams = keyParams;

// Batch results come back as MessageBatchIndividualResponse lines.
declare const line: Anthropic.Messages.MessageBatchIndividualResponse;
const summary = summarizeBatchResult(line);

export const checks = [gradeParams, batchParams, keyParams, streamParams, summary];
