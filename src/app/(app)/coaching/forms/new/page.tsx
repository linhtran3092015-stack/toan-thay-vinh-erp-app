import { CoachingFormBuilder } from "@/features/coaching/components/coaching-form-builder";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { permissionDeniedDescription } from "@/lib/permissions/labels";
export default async function NewCoachingFormPage() { const permissions = await getDatabasePermissions(); if (!permissions.ok || !permissions.permissions.includes("coaching_forms.manage")) return <PermissionDeniedState title="Không có quyền tạo biểu mẫu" description={permissionDeniedDescription("coaching_forms.manage")} />; return <main><h1 className="mb-5 text-page-title font-bold text-ink">Tạo biểu mẫu Coaching</h1><CoachingFormBuilder canManage canPublish={permissions.permissions.includes("coaching_forms.publish")} formId={null} formVersionId={null} initialInstructions="" initialName="" initialQuestions={[]} initialTitle="" isDraft /></main>; }
