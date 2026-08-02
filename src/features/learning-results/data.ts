import "server-only";

import { z } from "zod";

import type {
  LearningResultDirectoryItem,
  LearningResultsDirectoryResult,
} from "@/features/learning-results/read-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const learningResultRowsSchema = z.array(
  z.object({
    class_code: z.string().min(1),
    class_grade: z.number().int().min(1).max(12),
    class_id: z.string().uuid(),
    class_level: z.string().min(1),
    class_name: z.string().min(1),
    class_session_id: z.string().uuid(),
    current_grade: z.number().int().min(1).max(12),
    graded_at: z.string().nullable(),
    locked_at: z.string().nullable(),
    notebook_score: z.number().min(0).max(10).nullable(),
    notebook_status: z.enum([
      "submitted",
      "not_submitted",
      "not_required",
    ]),
    result_comment: z.string().nullable(),
    result_id: z.string().uuid(),
    session_date: z.iso.date(),
    session_status: z.string().min(1),
    student_code: z.string().min(1),
    student_id: z.string().uuid(),
    student_name: z.string().min(1),
    test_score: z.number().min(0).max(10).nullable(),
  }),
);

function mapLearningResult(
  row: z.infer<typeof learningResultRowsSchema>[number],
): LearningResultDirectoryItem {
  return {
    classCode: row.class_code,
    classGrade: row.class_grade,
    classId: row.class_id,
    classLevel: row.class_level,
    className: row.class_name,
    classSessionId: row.class_session_id,
    currentGrade: row.current_grade,
    gradedAt: row.graded_at,
    lockedAt: row.locked_at,
    notebookScore: row.notebook_score,
    notebookStatus: row.notebook_status,
    resultComment: row.result_comment,
    resultId: row.result_id,
    sessionDate: row.session_date,
    sessionStatus: row.session_status,
    studentCode: row.student_code,
    studentId: row.student_id,
    studentName: row.student_name,
    testScore: row.test_score,
  };
}

export async function getLearningResultsDirectory(): Promise<LearningResultsDirectoryResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "get_learning_results_directory",
      { p_limit: 500 },
    );

    if (error) {
      return {
        error: {
          code: "query_failed",
          message: "Không thể tải dữ liệu kết quả học tập từ database.",
        },
        ok: false,
      };
    }

    const parsedRows = learningResultRowsSchema.safeParse(data ?? []);

    if (!parsedRows.success) {
      return {
        error: {
          code: "invalid_response",
          message: "Database trả về dữ liệu kết quả học tập không hợp lệ.",
        },
        ok: false,
      };
    }

    return {
      data: parsedRows.data.map(mapLearningResult),
      ok: true,
    };
  } catch {
    return {
      error: {
        code: "query_failed",
        message: "Không thể kết nối dữ liệu kết quả học tập. Vui lòng thử lại.",
      },
      ok: false,
    };
  }
}
