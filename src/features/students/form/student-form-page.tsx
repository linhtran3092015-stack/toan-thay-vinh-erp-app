import type { PermissionCode } from "@/types/domain";
import { buildFormPermissions } from "./helpers";
import type { StudentFormValues } from "./student-form-schema";
import type { StudentFormMode } from "./student-form-types";
import { StudentForm } from "./components/student-form";

interface StudentFormPageProps {
  cancelHref: string;
  defaultValues: StudentFormValues;
  mode: StudentFormMode;
  permissions: PermissionCode[];
}

export function StudentFormPage({
  cancelHref,
  defaultValues,
  mode,
  permissions,
}: StudentFormPageProps) {
  return (
    <StudentForm
      cancelHref={cancelHref}
      defaultValues={defaultValues}
      mode={mode}
      permissions={buildFormPermissions(permissions)}
    />
  );
}
