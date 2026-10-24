import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentZaloGroupLinkDialog } from "@/features/parent-messages/components/student-zalo-group-link-dialog";
import { getStudentZaloLink } from "@/features/parent-messages/data";
import { getSystemSettings } from "@/features/settings/system-settings-data";
import { formatDateTime } from "@/lib/datetime";
import { isZaloCrmConfigured } from "@/lib/zalo-crm";

/** Server card: which Zalo "sổ liên lạc" group receives this student's parent messages. */
export async function StudentZaloGroupCard({ canUpdate, studentId, studentName }: { canUpdate: boolean; studentId: string; studentName: string }) {
  const [link, settings] = await Promise.all([getStudentZaloLink(studentId), getSystemSettings()]);
  const centerAccountName = settings["zalo.center_account_name"];
  const configured = isZaloCrmConfigured();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nhóm Zalo sổ liên lạc</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {link?.threadId ? (
          <div>
            <p className="font-semibold text-text-strong">{link.groupNameSnapshot ?? "Nhóm đã liên kết"}</p>
            <p className="mt-0.5 text-caption text-text-muted">
              Mã nhóm {link.threadId} · liên kết {formatDateTime(link.linkedAt)}
            </p>
            <p className="mt-1 text-caption text-text-muted">
              Tin vắng không phép và nhận xét cuối buổi của {studentName} được xếp vào hàng đợi gửi tới nhóm này từ nick{" "}
              {centerAccountName || "trung tâm"}.
            </p>
          </div>
        ) : (
          <p className="text-body text-text-muted">
            Chưa liên kết nhóm. Khi chưa liên kết, hệ thống không tạo tin nhắn phụ huynh cho học sinh này.
          </p>
        )}
        {canUpdate ? (
          <StudentZaloGroupLinkDialog
            configured={configured}
            currentThreadId={link?.threadId ?? null}
            studentId={studentId}
            studentName={studentName}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
