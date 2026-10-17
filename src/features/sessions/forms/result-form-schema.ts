import { z } from "zod";

function normalizeOptionalText(
  value: unknown,
): unknown {
  if (
    value === null ||
    value === undefined
  ) {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();

  return normalized.length > 0
    ? normalized
    : undefined;
}

function normalizeOptionalScore(
  value: unknown,
): unknown {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return undefined;
  }

  if (typeof value === "string") {
    const normalized = value
      .trim()
      .replace(",", ".");

    if (!normalized) {
      return undefined;
    }

    return Number(normalized);
  }

  return value;
}

function hasAtMostTwoDecimals(
  value: number,
): boolean {
  const scaled = value * 100;

  return (
    Math.abs(
      scaled - Math.round(scaled),
    ) < 1e-8
  );
}

const optionalScoreSchema = z.preprocess(
  normalizeOptionalScore,
  z
    .number({
      error:
        "Điểm phải là một số hợp lệ.",
    })
    .finite(
      "Điểm phải là một số hợp lệ.",
    )
    .min(
      0,
      "Điểm không được nhỏ hơn 0.",
    )
    .max(
      10,
      "Điểm không được lớn hơn 10.",
    )
    .refine(
      hasAtMostTwoDecimals,
      "Điểm chỉ được có tối đa 2 chữ số thập phân.",
    )
    .optional(),
);

const optionalCommentSchema = z.preprocess(
  normalizeOptionalText,
  z
    .string()
    .max(
      1000,
      "Nhận xét không được vượt quá 1.000 ký tự.",
    )
    .optional(),
);

const notebookStatusSchema = z.enum([
  "pending",
  "submitted",
  "not_submitted",
  "not_required",
]);

const resultFieldsSchema = z
  .object({
    comment: optionalCommentSchema,

    notebookScore:
      optionalScoreSchema,

    notebookStatus:
      notebookStatusSchema,

    testScore:
      optionalScoreSchema,
  })
  .superRefine((value, context) => {
    if (
      value.notebookStatus ===
        "submitted" &&
      value.notebookScore ===
        undefined
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Vở đã nộp phải có điểm vở.",
        path: ["notebookScore"],
      });
    }

    if (
      value.notebookStatus !==
        "submitted" &&
      value.notebookScore !==
        undefined
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Chỉ được nhập điểm vở khi trạng thái là đã nộp.",
        path: ["notebookScore"],
      });
    }
  });

export const recordSessionResultSchema =
  resultFieldsSchema.safeExtend({
    classSessionId: z
      .string()
      .uuid(
        "Mã buổi học không hợp lệ.",
      ),

    studentId: z
      .string()
      .uuid(
        "Mã học viên không hợp lệ.",
      ),
  });

export const updateSessionResultSchema =
  resultFieldsSchema.safeExtend({
    reason: z
      .string()
      .trim()
      .min(
        3,
        "Lý do cập nhật phải có ít nhất 3 ký tự.",
      )
      .max(
        500,
        "Lý do cập nhật không được vượt quá 500 ký tự.",
      ),

    resultId: z
      .string()
      .uuid(
        "Mã kết quả không hợp lệ.",
      ),
  });

export const lockSessionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(
      3,
      "Lý do khóa phải có ít nhất 3 ký tự.",
    )
    .max(
      500,
      "Lý do khóa không được vượt quá 500 ký tự.",
    ),

  sessionId: z
    .string()
    .uuid(
      "Mã buổi học không hợp lệ.",
    ),
});
