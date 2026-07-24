import { z } from "zod";

import type {
  AcademicYearClassCounts,
  AcademicYearManagementDataError,
  AcademicYearManagementResult,
  AcademicYearReadModel,
} from "@/features/classes/read-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const academicYearRowSchema = z.object({
  code: z.string(),
  ends_on: z.string(),
  id: z.string().uuid(),
  is_current: z.boolean(),
  name: z.string(),
  starts_on: z.string(),
  status: z.string(),
});

const classCountRowSchema = z.object({
  academic_year_id: z.string().uuid(),
  status: z.enum([
    "draft",
    "active",
    "closed",
    "archived",
  ]),
});

function createDataError(
  code: AcademicYearManagementDataError["code"],
  message: string,
): AcademicYearManagementDataError {
  return {
    code,
    message,
  };
}

function createEmptyClassCounts(): AcademicYearClassCounts {
  return {
    active: 0,
    archived: 0,
    closed: 0,
    draft: 0,
    total: 0,
  };
}

function mapAcademicYear(
  row: z.infer<typeof academicYearRowSchema>,
): AcademicYearReadModel {
  return {
    code: row.code,
    endsOn: row.ends_on,
    id: row.id,
    isCurrent: row.is_current,
    name: row.name,
    startsOn: row.starts_on,
    status: row.status,
  };
}

export async function getAcademicYearManagementData(): Promise<AcademicYearManagementResult> {
  try {
    const supabase =
      await createSupabaseServerClient();

    const [
      academicYearQuery,
      classQuery,
    ] = await Promise.all([
      supabase
        .from("academic_years")
        .select("*")
        .order("starts_on", {
          ascending: false,
        }),

      supabase
        .from("classes")
        .select("academic_year_id, status"),
    ]);

    if (academicYearQuery.error) {
      return {
        error: createDataError(
          "academic_years_query_failed",
          "Không tải được danh sách năm học.",
        ),
        ok: false,
      };
    }

    if (classQuery.error) {
      return {
        error: createDataError(
          "classes_query_failed",
          "Không tải được số liệu lớp học theo năm.",
        ),
        ok: false,
      };
    }

    const parsedAcademicYears =
      academicYearRowSchema
        .array()
        .safeParse(academicYearQuery.data);

    const parsedClasses =
      classCountRowSchema
        .array()
        .safeParse(classQuery.data);

    if (
      !parsedAcademicYears.success ||
      !parsedClasses.success
    ) {
      return {
        error: createDataError(
          "invalid_academic_year_data",
          "Dữ liệu năm học chưa đúng cấu trúc hệ thống.",
        ),
        ok: false,
      };
    }

    const classCountsByAcademicYear =
      new Map<
        string,
        AcademicYearClassCounts
      >();

    for (const classRow of parsedClasses.data) {
      const currentCounts =
        classCountsByAcademicYear.get(
          classRow.academic_year_id,
        ) ?? createEmptyClassCounts();

      currentCounts.total += 1;
      currentCounts[classRow.status] += 1;

      classCountsByAcademicYear.set(
        classRow.academic_year_id,
        currentCounts,
      );
    }

    const academicYears =
      parsedAcademicYears.data
        .map((row) => {
          const academicYear =
            mapAcademicYear(row);

          return {
            ...academicYear,
            classCounts:
              classCountsByAcademicYear.get(
                academicYear.id,
              ) ?? createEmptyClassCounts(),
          };
        })
        .sort((first, second) => {
          if (
            first.isCurrent !==
            second.isCurrent
          ) {
            return first.isCurrent ? -1 : 1;
          }

          return second.startsOn.localeCompare(
            first.startsOn,
          );
        });

    return {
      academicYears,
      ok: true,
    };
  } catch {
    return {
      error: createDataError(
        "academic_years_query_failed",
        "Không thể kết nối tới dữ liệu năm học.",
      ),
      ok: false,
    };
  }
}
