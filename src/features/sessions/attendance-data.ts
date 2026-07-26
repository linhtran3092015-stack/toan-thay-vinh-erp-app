import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AdditionalStudyCandidate {
  currentGrade: number | null;
  fullName: string;
  id: string;
  publicCode: string;
  registeredMode: string | null;
}

export type AdditionalStudyCandidatesResult =
  | {
      ok: true;
      students: AdditionalStudyCandidate[];
    }
  | {
      error: {
        code:
          | "invalid_response"
          | "query_failed";
        message: string;
      };
      ok: false;
    };

interface CandidateQueryRow {
  current_grade: number | null;
  full_name: string;
  id: string;
  public_code: string;
  registered_mode: string | null;
}

const CANDIDATE_LIMIT = 500;

export async function getAdditionalStudyCandidates():
  Promise<AdditionalStudyCandidatesResult> {
  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("students")
      .select(`
        id,
        public_code,
        full_name,
        current_grade,
        registered_mode
      `)
      .eq("lifecycle_status", "active")
      .order("full_name", {
        ascending: true,
      })
      .limit(CANDIDATE_LIMIT);

    if (error) {
      return {
        error: {
          code: "query_failed",
          message:
            "Không thể tải danh sách học viên có thể tham gia học thêm.",
        },
        ok: false,
      };
    }

    const rows =
      (data ?? []) as CandidateQueryRow[];

    const invalidRow = rows.some(
      (row) =>
        !row.id ||
        !row.public_code ||
        !row.full_name,
    );

    if (invalidRow) {
      return {
        error: {
          code: "invalid_response",
          message:
            "Database trả về danh sách học viên không hợp lệ.",
        },
        ok: false,
      };
    }

    return {
      ok: true,
      students: rows.map((row) => ({
        currentGrade: row.current_grade,
        fullName: row.full_name,
        id: row.id,
        publicCode: row.public_code,
        registeredMode:
          row.registered_mode,
      })),
    };
  } catch {
    return {
      error: {
        code: "query_failed",
        message:
          "Không thể kết nối tới dữ liệu học viên học thêm.",
      },
      ok: false,
    };
  }
}
