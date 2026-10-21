import { sortByStudentName } from "@/lib/student-order";
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface PaymentRequestStudentOption {
  guardianName: string;
  guardianPhone: string;
  id: string;
  name: string;
  publicCode: string;
}

export type PaymentRequestCreationOptionsResult =
  | { data: PaymentRequestStudentOption[]; ok: true }
  | { ok: false };

export async function getPaymentRequestCreationOptions(): Promise<
  PaymentRequestCreationOptionsResult
> {
  try {
    const supabase = await createSupabaseServerClient();
    // Every payable student: a capped read silently drops whoever sorts last.
    const { data, error } = await fetchAllPages((from, to) =>
      supabase
        .from("students")
        .select(
          `
          id,
          public_code,
          full_name,
          student_guardians!inner(
            is_primary,
            ended_at,
            guardian:guardians(full_name, phone)
          )
        `,
        )
        // Provisional students from CRM (pending confirmation) may receive a
        // new-enrollment request before conversion.
        .in("lifecycle_status", ["active", "pending_enrollment_confirmation"])
        .eq("student_guardians.is_primary", true)
        .is("student_guardians.ended_at", null)
        .order("full_name")
        .order("id")
        .range(from, to),
    );

    if (error) {
      return { ok: false };
    }

    return {
      data: sortByStudentName(data ?? [], (student) => student.full_name).flatMap((student) => {
        const links = student.student_guardians as unknown as Array<{
          guardian: { full_name: string; phone: string } | null;
        }>;
        const guardian = links[0]?.guardian;

        if (!guardian) {
          return [];
        }

        return [
          {
            guardianName: guardian.full_name,
            guardianPhone: guardian.phone,
            id: student.id,
            name: student.full_name,
            publicCode: student.public_code,
          },
        ];
      }),
      ok: true,
    };
  } catch {
    return { ok: false };
  }
}

