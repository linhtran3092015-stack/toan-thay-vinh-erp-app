import { mockStudents } from "@/features/students/mock-data";
import { studentStatusMeta } from "@/features/students/student-filters";
import { mockGuardianFamilies } from "./mock-form-data";
import { normalizeText, normalizeVietnamPhone } from "./helpers";
import type { StudentFormValues } from "./student-form-schema";
import type {
  GuardianDuplicateResult,
  StudentDuplicateResult,
} from "./student-form-types";

export function checkGuardianDuplicate(
  phoneValue: string,
): GuardianDuplicateResult | null {
  const phone = normalizeVietnamPhone(phoneValue);

  if (!phone.isValid) {
    return null;
  }

  return (
    mockGuardianFamilies.find(
      (family) => family.normalizedPhone === phone.normalized,
    ) ?? null
  );
}

export function checkStudentDuplicate(
  values: StudentFormValues,
): StudentDuplicateResult | null {
  const phone = normalizeVietnamPhone(values.guardianPhone);

  if (!phone.isValid || !values.fullName.trim() || !values.birthYear) {
    return null;
  }

  const normalizedName = normalizeText(values.fullName);
  const candidates = mockStudents
    .filter((student) => student.id !== values.studentId)
    .map((student) => {
      const sameName = normalizeText(student.fullName) === normalizedName;
      const sameBirthYear = student.birthYear === Number(values.birthYear);
      const samePhone =
        normalizeVietnamPhone(student.guardianPhone).normalized ===
        phone.normalized;
      const nearName =
        normalizedName.length >= 4 &&
        (normalizeText(student.fullName).includes(normalizedName) ||
          normalizedName.includes(normalizeText(student.fullName)));
      const score =
        Number(sameName) + Number(sameBirthYear) + Number(samePhone);

      return {
        className: student.mainClassName,
        fullName: student.fullName,
        id: student.id,
        publicCode: student.publicCode,
        reason:
          score === 3
            ? "Trùng họ tên, năm sinh và số điện thoại phụ huynh"
            : nearName && sameBirthYear
              ? "Tên gần giống và cùng năm sinh"
              : samePhone && sameBirthYear
                ? "Cùng số điện thoại phụ huynh và năm sinh"
                : "",
        score,
        statusLabel: studentStatusMeta[student.lifecycleStatus].label,
      };
    })
    .filter((candidate) => candidate.score >= 2 || candidate.reason)
    .map((candidate) => ({
      className: candidate.className,
      fullName: candidate.fullName,
      id: candidate.id,
      publicCode: candidate.publicCode,
      reason: `${candidate.reason} · ${candidate.statusLabel}`,
    }));

  if (candidates.length === 0) {
    return null;
  }

  return { candidates };
}
