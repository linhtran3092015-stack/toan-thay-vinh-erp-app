import {
  StudentProfileForm,
  type StudentProfileFormProps,
} from "@/features/students/form/components/student-profile-form";

/**
 * /students/new and /students/[studentId]/edit (design 17a). The routes pass
 * the defaults, the lifecycle status (edit) and the directory return links;
 * `actions`, the `initial*` props and `studentHref` exist for the /dev/forms
 * preview only (the routes pass none of them).
 */
export function StudentFormPage(props: StudentProfileFormProps) {
  return <StudentProfileForm {...props} />;
}
