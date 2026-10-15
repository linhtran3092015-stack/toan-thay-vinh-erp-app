import { notFound } from "next/navigation";

import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getCoachingFormDetail } from "@/features/coaching/coaching-form-data";
import { CoachingFormBuilder } from "@/features/coaching/components/coaching-form-builder";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

export default async function CoachingFormDetailPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  const permissions = await getDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("coaching_forms.view")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("coaching_forms.view")}
        title="Không có quyền xem biểu mẫu"
      />
    );
  }

  const form = await getCoachingFormDetail(formId);
  if (!form) notFound();

  return (
    <CoachingFormBuilder
      canManage={permissions.permissions.includes("coaching_forms.manage")}
      canPublish={permissions.permissions.includes("coaching_forms.publish")}
      formId={form.formId}
      formVersionId={form.versionId}
      initialInstructions={form.instructions}
      initialName={form.name}
      initialQuestions={form.questions}
      initialTitle={form.title}
      isDraft={form.versionStatus === "draft"}
      versionNumber={form.versionNumber}
    />
  );
}
