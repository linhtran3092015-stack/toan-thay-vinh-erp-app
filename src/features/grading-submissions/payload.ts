import { z } from "zod";

export const GRADING_ANSWER_MAX_CHARS = 20_000;
/** Room for a 20,000-character Vietnamese answer (up to 3 UTF-8 bytes each) plus JSON escaping. */
export const GRADING_WEBHOOK_MAX_BODY_BYTES = 256 * 1024;
const ANSWER_MAX_INPUT_CHARS = 100_000;

const birthYearSchema = z
  .union([z.number(), z.string().trim().regex(/^\d{4}$/)])
  .transform(Number)
  .pipe(z.number().int().min(1990).max(2100));

/** Postgres text cannot hold NUL. */
const stripNul = (value: unknown) => (typeof value === "string" ? value.replace(/\u0000/g, "") : value);

/** Apps Script sends "" for an empty field; treat it like null. */
const blankToNull = (value: unknown) => {
  const cleaned = stripNul(value);
  return typeof cleaned === "string" && cleaned.trim() === "" ? null : cleaned;
};

const optionalText = (max: number) =>
  z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .max(max)
      .nullish()
      .transform((value) => value ?? null),
  );

/**
 * Body the Apps Script form sends after it appends the Sheet row. Questions 6 (English trial)
 * and 7 (parent phone) are deliberately not part of it (owner decision 18/10/2026).
 */
export const gradingSubmissionPayloadSchema = z.object({
  answerText: z.preprocess(stripNul, z.string().max(ANSWER_MAX_INPUT_CHARS)),
  birthYear: birthYearSchema,
  classOption: optionalText(200),
  classOptionOther: optionalText(500),
  classSessionId: z.preprocess(
    blankToNull,
    z
      .string()
      .uuid()
      .nullish()
      .transform((value) => value ?? null),
  ),
  externalId: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/, "externalId must be 8–100 letters, digits, - or _"),
  fullName: z.preprocess(stripNul, z.string().trim().min(1).max(200)),
  studentCode: z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .regex(/^TV-\d{4}-\d{5,30}$/i, "studentCode must look like TV-YYYY-NNNNN")
      .nullish()
      .transform((value) => (value ? value.toUpperCase() : null)),
  ),
  submittedAt: z.string().datetime({ offset: true }),
  version: z.literal(1),
});

export type GradingSubmissionPayload = z.infer<typeof gradingSubmissionPayloadSchema>;

export interface ParsedGradingSubmission {
  answerText: string;
  answerTruncated: boolean;
  payload: GradingSubmissionPayload;
  /** Stored as raw_payload (wiped after 30 days): every field but the answer, plus names of unknown keys. */
  rawPayload: Record<string, unknown>;
}

export function parseGradingSubmissionPayload(
  rawBody: string,
): { data: ParsedGradingSubmission; ok: true } | { error: string; ok: false } {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { error: "Invalid JSON", ok: false };
  }

  const result = gradingSubmissionPayloadSchema.safeParse(json);
  if (!result.success) {
    return {
      error: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
      ok: false,
    };
  }

  const payload = result.data;
  // Count and cut by code point (what Postgres char_length counts), never inside an emoji.
  const answerChars = Array.from(payload.answerText);
  const answerTruncated = answerChars.length > GRADING_ANSWER_MAX_CHARS;
  const answerText = answerTruncated ? answerChars.slice(0, GRADING_ANSWER_MAX_CHARS).join("") : payload.answerText;
  const knownKeys = new Set(Object.keys(gradingSubmissionPayloadSchema.shape));
  const unknownKeys =
    json && typeof json === "object" ? Object.keys(json).filter((key) => !knownKeys.has(key)).sort() : [];
  return {
    data: {
      answerText,
      answerTruncated,
      payload,
      rawPayload: {
        answerLength: answerChars.length,
        birthYear: payload.birthYear,
        classOption: payload.classOption,
        classOptionOther: payload.classOptionOther,
        classSessionId: payload.classSessionId,
        externalId: payload.externalId,
        fullName: payload.fullName,
        studentCode: payload.studentCode,
        submittedAt: payload.submittedAt,
        unknownKeys,
        version: payload.version,
      },
    },
    ok: true,
  };
}
