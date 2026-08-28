"use server";

import { revalidatePath } from "next/cache";

import {
  archiveTemplateResult,
  cloneTemplateResult,
  createPayslipTemplateDraftVersionResult,
  publishTemplateVersionResult,
  saveDraftConfigurationResult,
  setDefaultTemplateResult,
  type TemplateActionResult,
} from "@/features/payroll/payslip-template/data";

export async function createDraftAction(
  templateId: string,
): Promise<TemplateActionResult<{ versionNumber: number }>> {
  const result = await createPayslipTemplateDraftVersionResult(templateId);
  if (result.ok) {
    revalidatePath(`/payroll/settings/payslip-templates/${templateId}/editor`);
    revalidatePath("/payroll/settings/payslip-templates");
  }
  return result;
}

export async function saveDraftAction(
  templateId: string,
  versionNumber: number,
  config: unknown,
): Promise<TemplateActionResult> {
  const result = await saveDraftConfigurationResult(templateId, versionNumber, config);
  if (result.ok) {
    revalidatePath(`/payroll/settings/payslip-templates/${templateId}/editor`);
    revalidatePath("/payroll/settings/payslip-templates");
  }
  return result;
}

export async function publishTemplateAction(
  templateId: string,
  versionNumber: number,
): Promise<TemplateActionResult> {
  const result = await publishTemplateVersionResult(templateId, versionNumber);
  if (result.ok) {
    revalidatePath(`/payroll/settings/payslip-templates/${templateId}/editor`);
    revalidatePath("/payroll/settings/payslip-templates");
    revalidatePath("/payroll");
  }
  return result;
}

export async function setDefaultTemplateAction(
  templateId: string,
): Promise<TemplateActionResult> {
  const result = await setDefaultTemplateResult(templateId);
  if (result.ok) {
    revalidatePath("/payroll/settings/payslip-templates");
    revalidatePath("/payroll");
  }
  return result;
}

export async function cloneTemplateAction(
  templateId: string,
  newName: string,
): Promise<TemplateActionResult<{ id: string }>> {
  const result = await cloneTemplateResult(templateId, newName);
  if (result.ok) {
    revalidatePath("/payroll/settings/payslip-templates");
  }
  return result;
}

export async function archiveTemplateAction(
  templateId: string,
): Promise<TemplateActionResult> {
  const result = await archiveTemplateResult(templateId);
  if (result.ok) {
    revalidatePath("/payroll/settings/payslip-templates");
  }
  return result;
}
