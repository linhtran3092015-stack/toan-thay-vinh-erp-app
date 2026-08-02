import {
  buildStudentImportTemplateWorkbook,
} from "@/features/imports/students/template";
import {
  STUDENT_IMPORT_TEMPLATE_FILENAME,
} from "@/features/imports/students/workbook";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const permissionResult =
    await getDatabasePermissions();

  if (!permissionResult.ok) {
    return Response.json(
      {
        message:
          "Phiên đăng nhập không hợp lệ.",
      },
      {
        status: 401,
      },
    );
  }

  if (
    !permissionResult.permissions.includes(
      "imports.students",
    )
  ) {
    return Response.json(
      {
        message:
          "Tài khoản hiện tại không có quyền tải file mẫu import.",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const workbook =
      await buildStudentImportTemplateWorkbook();

    return new Response(
      new Uint8Array(workbook),
      {
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
          "Content-Disposition":
            `attachment; filename="${STUDENT_IMPORT_TEMPLATE_FILENAME}"`,
          "Content-Length":
            String(workbook.byteLength),
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "X-Content-Type-Options":
            "nosniff",
        },
        status: 200,
      },
    );
  } catch {
    return Response.json(
      {
        message:
          "Không thể tạo file mẫu import học viên.",
      },
      {
        status: 500,
      },
    );
  }
}
