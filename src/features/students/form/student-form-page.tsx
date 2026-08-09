import { StudentProfileForm } from "@/features/students/form/components/student-profile-form";
import type {
  StudentProfileFormMode,
} from "@/features/students/form/student-profile-form-helpers";
import type {
  StudentProfileFormValues,
} from "@/features/students/form/student-profile-form-schema";

interface StudentFormPageProps {
  cancelHref: string;
  defaultValues: StudentProfileFormValues;
  lifecycleStatus?: string;
  mode: StudentProfileFormMode;
  returnQuery?: string;
}

export function StudentFormPage({
  cancelHref,
  defaultValues,
  lifecycleStatus,
  mode,
  returnQuery,
}: StudentFormPageProps) {
  return (
    <StudentProfileForm
      cancelHref={cancelHref}
      defaultValues={defaultValues}
      lifecycleStatus={lifecycleStatus}
      mode={mode}
      returnQuery={returnQuery}
    />
  );
}
