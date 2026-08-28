import "server-only";

import { getCurrentAuthUser } from "@/features/auth/current-user";
import { DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG, parsePayslipTemplateConfiguration } from "@/features/payroll/payslip-template/schema";
import type {
  PayslipTemplateConfiguration,
  PayslipTemplateDetail,
  PayslipTemplateStatus,
  PayslipTemplateSummary,
  PayslipTemplateVersionSummary,
} from "@/features/payroll/payslip-template/types";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

export type TemplateActionResult<T = void> =
  | {
      data: T;
      ok: true;
    }
  | {
      error:
        | "NOT_AUTHENTICATED"
        | "PERMISSION_DENIED"
        | "TEMPLATE_NOT_FOUND"
        | "VERSION_NOT_FOUND"
        | "CANNOT_MODIFY_PUBLISHED_VERSION"
        | "CANNOT_ARCHIVE_DEFAULT_TEMPLATE"
        | "SLUG_ALREADY_EXISTS"
        | "INVALID_CONFIGURATION"
        | "OPERATION_FAILED";
      message: string;
      ok: false;
    };

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// 1. Get template list
export async function getPayslipTemplatesListResult(): Promise<
  TemplateActionResult<readonly PayslipTemplateSummary[]>
> {
  const permissionResult = await getCachedDatabasePermissions();
  if (!permissionResult.ok || !permissionResult.permissions.includes("app.access")) {
    return {
      error: "PERMISSION_DENIED",
      message: "Bạn không có quyền truy cập danh sách mẫu phiếu lương.",
      ok: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: templates, error } = await supabase
    .from("payroll_payslip_templates")
    .select(`
      id,
      name,
      slug,
      description,
      is_default,
      is_archived,
      created_at,
      updated_at,
      created_by,
      profiles:created_by (
        display_name,
        email
      ),
      payroll_payslip_template_versions (
        id,
        version_number,
        status,
        published_at,
        created_at
      )
    `)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error || !templates) {
    return {
      error: "OPERATION_FAILED",
      message: "Không thể tải danh sách mẫu phiếu lương.",
      ok: false,
    };
  }

  const summaries: PayslipTemplateSummary[] = templates.map((t) => {
    type ProfileType = { display_name: string | null; email: string | null } | null;
    const profile = (Array.isArray(t.profiles) ? t.profiles[0] : t.profiles) as ProfileType;

    const versions = t.payroll_payslip_template_versions || [];
    const publishedVersions = versions
      .filter((v: { status: string }) => v.status === "published")
      .sort(
        (a: { version_number: number }, b: { version_number: number }) =>
          b.version_number - a.version_number,
      );
    const draftVersions = versions
      .filter((v: { status: string }) => v.status === "draft")
      .sort(
        (a: { version_number: number }, b: { version_number: number }) =>
          b.version_number - a.version_number,
      );

    return {
      createdAt: t.created_at,
      createdByEmail: profile?.email ?? null,
      createdByName: profile?.display_name ?? null,
      currentDraftVersionNumber: draftVersions[0]?.version_number ?? null,
      description: t.description,
      id: t.id,
      isArchived: t.is_archived,
      isDefault: t.is_default,
      latestPublishedVersionNumber: publishedVersions[0]?.version_number ?? null,
      name: t.name,
      slug: t.slug,
      totalVersions: versions.length,
      updatedAt: t.updated_at,
    };
  });

  return { data: summaries, ok: true };
}

// 2. Get template detail
export async function getPayslipTemplateDetailResult(
  templateId: string,
  versionNumber?: number,
): Promise<TemplateActionResult<PayslipTemplateDetail>> {
  const permissionResult = await getCachedDatabasePermissions();
  if (!permissionResult.ok || !permissionResult.permissions.includes("app.access")) {
    return {
      error: "PERMISSION_DENIED",
      message: "Bạn không có quyền xem thông tin mẫu phiếu lương.",
      ok: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: template, error: templateError } = await supabase
    .from("payroll_payslip_templates")
    .select(`
      id,
      name,
      slug,
      description,
      is_default,
      is_archived,
      created_at,
      updated_at
    `)
    .eq("id", templateId)
    .maybeSingle();

  if (templateError || !template) {
    return {
      error: "TEMPLATE_NOT_FOUND",
      message: "Không tìm thấy mẫu phiếu lương.",
      ok: false,
    };
  }

  const { data: versions, error: versionsError } = await supabase
    .from("payroll_payslip_template_versions")
    .select(`
      id,
      template_id,
      version_number,
      schema_version,
      configuration,
      status,
      published_at,
      created_at,
      created_by,
      profiles:created_by (
        display_name,
        email
      )
    `)
    .eq("template_id", templateId)
    .order("version_number", { ascending: false });

  if (versionsError || !versions || versions.length === 0) {
    return {
      error: "VERSION_NOT_FOUND",
      message: "Mẫu phiếu lương chưa có phiên bản nào.",
      ok: false,
    };
  }

  type VersionRowType = {
    configuration: unknown;
    created_at: string;
    id: string;
    profiles: { display_name: string | null; email: string | null } | null | Array<{ display_name: string | null; email: string | null }>;
    published_at: string | null;
    schema_version: number;
    status: string;
    template_id: string;
    version_number: number;
  };

  const typedVersions = versions as unknown as VersionRowType[];

  // Choose the version to load
  let selectedVersion = typedVersions[0];
  if (versionNumber !== undefined) {
    const found = typedVersions.find((v) => v.version_number === versionNumber);
    if (found) selectedVersion = found;
  } else {
    // If no version specified, prefer latest draft; if none, latest published
    const draft = typedVersions.find((v) => v.status === "draft");
    if (draft) selectedVersion = draft;
  }

  const versionSummaries: PayslipTemplateVersionSummary[] = typedVersions.map((v) => {
    const profile = (Array.isArray(v.profiles) ? v.profiles[0] : v.profiles) as { display_name: string | null; email: string | null } | null;
    return {
      createdAt: v.created_at,
      createdByEmail: profile?.email ?? null,
      createdByName: profile?.display_name ?? null,
      id: v.id,
      publishedAt: v.published_at,
      schemaVersion: v.schema_version,
      status: v.status as PayslipTemplateStatus,
      templateId: v.template_id,
      versionNumber: v.version_number,
    };
  });

  const parsedConfig = parsePayslipTemplateConfiguration(selectedVersion.configuration);

  return {
    data: {
      activeVersion: {
        configuration: parsedConfig,
        createdAt: selectedVersion.created_at,
        id: selectedVersion.id,
        publishedAt: selectedVersion.published_at,
        schemaVersion: selectedVersion.schema_version,
        status: selectedVersion.status as PayslipTemplateStatus,
        versionNumber: selectedVersion.version_number,
      },
      description: template.description,
      id: template.id,
      isArchived: template.is_archived,
      isDefault: template.is_default,
      name: template.name,
      slug: template.slug,
      versions: versionSummaries,
    },
    ok: true,
  };
}

// 3. Get active default template config
export async function getActiveDefaultTemplateConfigurationResult(): Promise<PayslipTemplateConfiguration> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: defaultTemplate } = await supabase
      .from("payroll_payslip_templates")
      .select("id")
      .eq("is_default", true)
      .eq("is_archived", false)
      .maybeSingle();

    if (defaultTemplate?.id) {
      const { data: latestPublishedVersion } = await supabase
        .from("payroll_payslip_template_versions")
        .select("configuration")
        .eq("template_id", defaultTemplate.id)
        .eq("status", "published")
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestPublishedVersion?.configuration) {
        return parsePayslipTemplateConfiguration(latestPublishedVersion.configuration);
      }
    }
  } catch {
    // Fallback safely
  }
  return DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG;
}

// 4. Get statement template configuration (with historical snapshot support)
export async function getStatementTemplateConfigurationResult(
  statementId: string,
): Promise<PayslipTemplateConfiguration> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: statement } = await supabase
      .from("payroll_statements")
      .select("snapshot_template_version_id")
      .eq("id", statementId)
      .maybeSingle();

    if (statement?.snapshot_template_version_id) {
      const { data: snapshotVersion } = await supabase
        .from("payroll_payslip_template_versions")
        .select("configuration")
        .eq("id", statement.snapshot_template_version_id)
        .maybeSingle();

      if (snapshotVersion?.configuration) {
        return parsePayslipTemplateConfiguration(snapshotVersion.configuration);
      }
    }
  } catch {
    // Fallback safely
  }

  return getActiveDefaultTemplateConfigurationResult();
}

// 5. Create or get draft version for editing
export async function createPayslipTemplateDraftVersionResult(
  templateId: string,
): Promise<TemplateActionResult<{ versionNumber: number }>> {
  const authUserResult = await getCurrentAuthUser();
  if (!authUserResult.ok || !authUserResult.user) {
    return {
      error: "NOT_AUTHENTICATED",
      message: "Bạn chưa đăng nhập.",
      ok: false,
    };
  }

  const permissionResult = await getCachedDatabasePermissions();
  if (
    !permissionResult.ok ||
    !permissionResult.permissions.includes("payroll.template.manage")
  ) {
    return {
      error: "PERMISSION_DENIED",
      message: "Bạn không có quyền chỉnh sửa mẫu phiếu lương.",
      ok: false,
    };
  }

  const supabase = await createSupabaseServerClient();

  // Check if draft already exists
  const { data: existingDraft } = await supabase
    .from("payroll_payslip_template_versions")
    .select("version_number")
    .eq("template_id", templateId)
    .eq("status", "draft")
    .maybeSingle();

  if (existingDraft) {
    return { data: { versionNumber: existingDraft.version_number }, ok: true };
  }

  // Get max version and latest published config to clone
  const { data: versions } = await supabase
    .from("payroll_payslip_template_versions")
    .select("version_number, configuration, status")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false });

  const maxVersion = versions?.[0]?.version_number ?? 0;
  const nextVersionNumber = maxVersion + 1;

  const latestPublished = versions?.find((v) => v.status === "published");
  const initialConfig = latestPublished?.configuration ?? DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG;

  const { error: insertError } = await supabase
    .from("payroll_payslip_template_versions")
    .insert({
      configuration: initialConfig as unknown as Json,
      created_by: authUserResult.user.id,
      schema_version: 1,
      status: "draft",
      template_id: templateId,
      version_number: nextVersionNumber,
    });

  if (insertError) {
    return {
      error: "OPERATION_FAILED",
      message: "Không thể tạo bản nháp mới cho mẫu phiếu lương.",
      ok: false,
    };
  }

  await supabase.from("audit_logs").insert({
    action: "payslip_template_draft_created",
    actor_user_id: authUserResult.user.id,
    entity_id: templateId,
    entity_type: "payroll_payslip_template",
    metadata: {
      template_id: templateId,
      version_number: nextVersionNumber,
    },
    module: "payroll",
  });

  return { data: { versionNumber: nextVersionNumber }, ok: true };
}

// 6. Save draft configuration
export async function saveDraftConfigurationResult(
  templateId: string,
  versionNumber: number,
  configuration: unknown,
): Promise<TemplateActionResult> {
  const authUserResult = await getCurrentAuthUser();
  if (!authUserResult.ok || !authUserResult.user) {
    return {
      error: "NOT_AUTHENTICATED",
      message: "Bạn chưa đăng nhập.",
      ok: false,
    };
  }

  const permissionResult = await getCachedDatabasePermissions();
  if (
    !permissionResult.ok ||
    !permissionResult.permissions.includes("payroll.template.manage")
  ) {
    return {
      error: "PERMISSION_DENIED",
      message: "Bạn không có quyền lưu mẫu phiếu lương.",
      ok: false,
    };
  }

  const validatedConfig = parsePayslipTemplateConfiguration(configuration);

  const supabase = await createSupabaseServerClient();

  // Verify status is draft
  const { data: versionRecord } = await supabase
    .from("payroll_payslip_template_versions")
    .select("status")
    .eq("template_id", templateId)
    .eq("version_number", versionNumber)
    .maybeSingle();

  if (!versionRecord) {
    return {
      error: "VERSION_NOT_FOUND",
      message: "Không tìm thấy phiên bản mẫu phiếu lương này.",
      ok: false,
    };
  }

  if (versionRecord.status !== "draft") {
    return {
      error: "CANNOT_MODIFY_PUBLISHED_VERSION",
      message: "Không thể chỉnh sửa phiên bản đã xuất bản. Hãy tạo bản nháp mới.",
      ok: false,
    };
  }

  const { error: updateError } = await supabase
    .from("payroll_payslip_template_versions")
    .update({
      configuration: validatedConfig as unknown as Json,
    })
    .eq("template_id", templateId)
    .eq("version_number", versionNumber);

  if (updateError) {
    return {
      error: "OPERATION_FAILED",
      message: "Lưu bản nháp thất bại.",
      ok: false,
    };
  }

  // Touch template updated_at
  await supabase
    .from("payroll_payslip_templates")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", templateId);

  await supabase.from("audit_logs").insert({
    action: "payslip_template_updated",
    actor_user_id: authUserResult.user.id,
    entity_id: templateId,
    entity_type: "payroll_payslip_template",
    metadata: {
      template_id: templateId,
      version_number: versionNumber,
    },
    module: "payroll",
  });

  return { data: undefined, ok: true };
}

// 7. Publish template version
export async function publishTemplateVersionResult(
  templateId: string,
  versionNumber: number,
): Promise<TemplateActionResult> {
  const authUserResult = await getCurrentAuthUser();
  if (!authUserResult.ok || !authUserResult.user) {
    return {
      error: "NOT_AUTHENTICATED",
      message: "Bạn chưa đăng nhập.",
      ok: false,
    };
  }

  const permissionResult = await getCachedDatabasePermissions();
  if (
    !permissionResult.ok ||
    !permissionResult.permissions.includes("payroll.template.manage")
  ) {
    return {
      error: "PERMISSION_DENIED",
      message: "Bạn không có quyền xuất bản mẫu phiếu lương.",
      ok: false,
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error: publishError } = await supabase
    .from("payroll_payslip_template_versions")
    .update({
      published_at: new Date().toISOString(),
      status: "published",
    })
    .eq("template_id", templateId)
    .eq("version_number", versionNumber);

  if (publishError) {
    return {
      error: "OPERATION_FAILED",
      message: "Xuất bản mẫu phiếu lương thất bại.",
      ok: false,
    };
  }

  await supabase
    .from("payroll_payslip_templates")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", templateId);

  await supabase.from("audit_logs").insert({
    action: "payslip_template_published",
    actor_user_id: authUserResult.user.id,
    entity_id: templateId,
    entity_type: "payroll_payslip_template",
    metadata: {
      template_id: templateId,
      version_number: versionNumber,
    },
    module: "payroll",
  });

  return { data: undefined, ok: true };
}

// 8. Set default template
export async function setDefaultTemplateResult(
  templateId: string,
): Promise<TemplateActionResult> {
  const authUserResult = await getCurrentAuthUser();
  if (!authUserResult.ok || !authUserResult.user) {
    return {
      error: "NOT_AUTHENTICATED",
      message: "Bạn chưa đăng nhập.",
      ok: false,
    };
  }

  const permissionResult = await getCachedDatabasePermissions();
  if (
    !permissionResult.ok ||
    !permissionResult.permissions.includes("payroll.template.manage")
  ) {
    return {
      error: "PERMISSION_DENIED",
      message: "Bạn không có quyền đặt mẫu phiếu lương mặc định.",
      ok: false,
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("payroll_payslip_templates")
    .update({
      is_default: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);

  if (error) {
    return {
      error: "OPERATION_FAILED",
      message: "Đặt mẫu mặc định thất bại.",
      ok: false,
    };
  }

  await supabase.from("audit_logs").insert({
    action: "payslip_template_set_default",
    actor_user_id: authUserResult.user.id,
    entity_id: templateId,
    entity_type: "payroll_payslip_template",
    metadata: { template_id: templateId },
    module: "payroll",
  });

  return { data: undefined, ok: true };
}

// 9. Clone template
export async function cloneTemplateResult(
  templateId: string,
  newName: string,
): Promise<TemplateActionResult<{ id: string }>> {
  const authUserResult = await getCurrentAuthUser();
  if (!authUserResult.ok || !authUserResult.user) {
    return {
      error: "NOT_AUTHENTICATED",
      message: "Bạn chưa đăng nhập.",
      ok: false,
    };
  }

  const permissionResult = await getCachedDatabasePermissions();
  if (
    !permissionResult.ok ||
    !permissionResult.permissions.includes("payroll.template.manage")
  ) {
    return {
      error: "PERMISSION_DENIED",
      message: "Bạn không có quyền nhân bản mẫu phiếu lương.",
      ok: false,
    };
  }

  const supabase = await createSupabaseServerClient();

  // Get original template and its latest version
  const { data: original } = await supabase
    .from("payroll_payslip_templates")
    .select("description, name, payroll_payslip_template_versions(configuration, status, version_number)")
    .eq("id", templateId)
    .maybeSingle();

  if (!original) {
    return {
      error: "TEMPLATE_NOT_FOUND",
      message: "Không tìm thấy mẫu gốc để nhân bản.",
      ok: false,
    };
  }

  const versions = (original.payroll_payslip_template_versions || []) as unknown as Array<{
    configuration: unknown;
    status: string;
    version_number: number;
  }>;
  const latestPublished = versions
    .filter((v) => v.status === "published")
    .sort((a, b) => b.version_number - a.version_number)[0];
  const cloneConfig = (latestPublished?.configuration as PayslipTemplateConfiguration) ?? DEFAULT_STANDARD_PAYSLIP_TEMPLATE_CONFIG;

  const baseSlug = slugify(newName || `${original.name}-copy`);
  const uniqueSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

  const { data: newTemplate, error: createError } = await supabase
    .from("payroll_payslip_templates")
    .insert({
      created_by: authUserResult.user.id,
      description: original.description ? `Bản sao từ ${original.name}` : null,
      is_default: false,
      name: newName || `${original.name} (Bản sao)`,
      slug: uniqueSlug,
    })
    .select("id")
    .single();

  if (createError || !newTemplate) {
    return {
      error: "OPERATION_FAILED",
      message: "Không thể tạo bản sao mẫu phiếu lương.",
      ok: false,
    };
  }

  // Create version 1 as draft
  await supabase.from("payroll_payslip_template_versions").insert({
    configuration: cloneConfig as unknown as Json,
    created_by: authUserResult.user.id,
    schema_version: 1,
    status: "draft",
    template_id: newTemplate.id,
    version_number: 1,
  });

  await supabase.from("audit_logs").insert({
    action: "payslip_template_cloned",
    actor_user_id: authUserResult.user.id,
    entity_id: newTemplate.id,
    entity_type: "payroll_payslip_template",
    metadata: {
      cloned_from_template_id: templateId,
      new_template_id: newTemplate.id,
    },
    module: "payroll",
  });

  return { data: { id: newTemplate.id }, ok: true };
}

// 10. Archive template
export async function archiveTemplateResult(
  templateId: string,
): Promise<TemplateActionResult> {
  const authUserResult = await getCurrentAuthUser();
  if (!authUserResult.ok || !authUserResult.user) {
    return {
      error: "NOT_AUTHENTICATED",
      message: "Bạn chưa đăng nhập.",
      ok: false,
    };
  }

  const permissionResult = await getCachedDatabasePermissions();
  if (
    !permissionResult.ok ||
    !permissionResult.permissions.includes("payroll.template.manage")
  ) {
    return {
      error: "PERMISSION_DENIED",
      message: "Bạn không có quyền lưu trữ mẫu phiếu lương.",
      ok: false,
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: template } = await supabase
    .from("payroll_payslip_templates")
    .select("is_default")
    .eq("id", templateId)
    .maybeSingle();

  if (template?.is_default) {
    return {
      error: "CANNOT_ARCHIVE_DEFAULT_TEMPLATE",
      message: "Không thể lưu trữ mẫu đang được đặt làm mặc định. Hãy chọn mẫu khác làm mặc định trước.",
      ok: false,
    };
  }

  const { error } = await supabase
    .from("payroll_payslip_templates")
    .update({
      is_archived: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);

  if (error) {
    return {
      error: "OPERATION_FAILED",
      message: "Lưu trữ mẫu phiếu lương thất bại.",
      ok: false,
    };
  }

  await supabase.from("audit_logs").insert({
    action: "payslip_template_archived",
    actor_user_id: authUserResult.user.id,
    entity_id: templateId,
    entity_type: "payroll_payslip_template",
    metadata: { template_id: templateId },
    module: "payroll",
  });

  return { data: undefined, ok: true };
}
