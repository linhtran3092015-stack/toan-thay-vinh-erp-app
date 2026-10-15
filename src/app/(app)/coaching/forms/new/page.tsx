import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { CoachingFormBuilder } from "@/features/coaching/components/coaching-form-builder";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

export default async function NewCoachingFormPage() {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("coaching_forms.manage")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("coaching_forms.manage")}
        title="Không có quyền tạo biểu mẫu"
      />
    );
  }

  return (
    <CoachingFormBuilder
      canManage
      canPublish={permissions.permissions.includes("coaching_forms.publish")}
      formId={null}
      formVersionId={null}
      initialInstructions=""
      initialName=""
      initialQuestions={[]}
      initialTitle=""
      isDraft
    />
  );
}
