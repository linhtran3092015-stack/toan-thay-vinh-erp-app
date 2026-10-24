"use client";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { ZaloConnectionStatusCard } from "@/features/parent-messages/components/zalo-connection-status";
import { ZaloGroupBulkLinker } from "@/features/parent-messages/components/zalo-group-bulk-linker";
import type { ZaloConnectionStatus, ZaloLinkStudent } from "@/features/parent-messages/zalo-group-link-data";
import { matchStudentsToGroups, type MatchGroup, type MatchStudent } from "@/features/parent-messages/zalo-group-matching";
import { DATABASE_PERMISSION_CODES } from "@/lib/permissions/types";

export type ZaloGroupsPreviewState = "ready" | "not-configured" | "crm-error" | "nick-offline";

const hoa = { fullName: "Trần Thị Hoa", phones: ["0912345678"] };
const fixtures: (MatchStudent & { birthYear: number; classCodes: string[] })[] = [
  { birthYear: 2015, classCodes: ["T5-CLC1"], fullName: "Nguyễn Văn An", guardians: [{ fullName: "Nguyễn Văn Bình", phones: ["0987111222"] }], id: "00000000-0000-4000-8000-000000000001", publicCode: "TV-2026-00101" },
  { birthYear: 2014, classCodes: ["T6-A"], fullName: "Phạm Gia Bảo", guardians: [hoa], id: "00000000-0000-4000-8000-000000000002", publicCode: "TV-2026-00102" },
  { birthYear: 2016, classCodes: ["T4-B"], fullName: "Phạm Gia Hân", guardians: [hoa], id: "00000000-0000-4000-8000-000000000003", publicCode: "TV-2026-00103" },
  { birthYear: 2013, classCodes: ["T7-CLC2"], fullName: "Lê Hoàng Minh", guardians: [{ fullName: "Lê Thu Trang", phones: ["0903555666"] }], id: "00000000-0000-4000-8000-000000000004", publicCode: "TV-2026-00104" },
  { birthYear: 2015, classCodes: ["T5-A"], fullName: "Đỗ Ngọc Châu", guardians: [{ fullName: "Đỗ Văn Tú", phones: ["0911222333"] }], id: "00000000-0000-4000-8000-000000000005", publicCode: "TV-2026-00105" },
  { birthYear: 2015, classCodes: ["T5-B"], fullName: "Nguyễn Minh Anh", guardians: [{ fullName: "Vũ Thị Lan", phones: ["0977000111"] }], id: "00000000-0000-4000-8000-000000000006", publicCode: "TV-2026-00106" },
  { birthYear: 2014, classCodes: ["T6-B"], fullName: "Nguyễn Minh Anh", guardians: [{ fullName: "Hồ Văn Long", phones: ["0966000222"] }], id: "00000000-0000-4000-8000-000000000007", publicCode: "TV-2026-00107" },
];

const groups: MatchGroup[] = [
  { externalThreadId: "8812001", groupMembersCount: 4, groupName: "SLL Nguyễn Văn An - T5 CLC1", zaloAccountId: "acc-center" },
  { externalThreadId: "8812002", groupMembersCount: 3, groupName: "PH Hoa 0912 345 678", zaloAccountId: "acc-center" },
  { externalThreadId: "8812003", groupMembersCount: 3, groupName: "PH Hoa 0912345678 (2)", zaloAccountId: "acc-center" },
  { externalThreadId: "8812004", groupMembersCount: 5, groupName: "Sổ liên lạc TV-2026-00104", zaloAccountId: "acc-center" },
  { externalThreadId: "8812005", groupMembersCount: 4, groupName: "SLL Nguyễn Minh Anh", zaloAccountId: "acc-center" },
  { externalThreadId: "8812006", groupMembersCount: 4, groupName: "SLL Nguyễn Minh Anh lớp 6", zaloAccountId: "acc-center" },
  { externalThreadId: "8812007", groupMembersCount: 12, groupName: "Thông báo chung khối 5", zaloAccountId: "acc-center" },
];

const students: ZaloLinkStudent[] = fixtures.map(({ birthYear, classCodes, fullName, guardians, id, publicCode }) => ({
  birthYear,
  classCodes,
  fullName,
  guardianSummary: guardians.map((guardian) => `${guardian.fullName} · ${guardian.phones[0]}`).join("; "),
  id,
  publicCode,
}));

function statusFor(state: ZaloGroupsPreviewState): ZaloConnectionStatus {
  const base: ZaloConnectionStatus = {
    centerAccount: { displayName: "Toán Thầy Vinh", id: "acc-center", phone: "0900000001", status: "connected", zaloUid: "1234" },
    centerAccountId: "acc-center",
    centerAccountName: "Toán Thầy Vinh",
    configured: true,
    crmError: null,
    groupsError: null,
    groupsListed: groups.length,
    groupsTotal: groups.length,
    groupsTruncated: false,
    linkedStudents: 573,
    studyingStudents: 580,
  };
  if (state === "not-configured") return { ...base, centerAccount: null, centerAccountId: "", centerAccountName: "", configured: false, groupsListed: null, groupsTotal: null, linkedStudents: 0 };
  if (state === "crm-error") return { ...base, centerAccount: null, crmError: "Invalid API key.", groupsListed: null, groupsTotal: null, linkedStudents: 0 };
  if (state === "nick-offline") return { ...base, centerAccount: { ...base.centerAccount!, status: "disconnected" }, groupsListed: null, groupsTotal: null, linkedStudents: 0 };
  return base;
}

/** Inert stub: the second row of each save fails, like a group linked elsewhere meanwhile. */
async function previewLinkAction(input: { links: { studentId: string }[] }) {
  return {
    ok: true as const,
    results: input.links.map((link, index) =>
      index === 1
        ? { message: "Nhóm Zalo này đã được liên kết với một học sinh khác.", ok: false, studentId: link.studentId }
        : { message: "Đã liên kết.", ok: true, studentId: link.studentId },
    ),
  };
}

export function ZaloGroupsPreview({ state }: { state: ZaloGroupsPreviewState }) {
  const status = statusFor(state);
  return (
    <AppShell
      authUser={{ displayName: "Nguyễn Văn Vinh", email: "preview@example.com", id: "dev-user", initials: "NV" }}
      centerDisplayName="Toán Thầy Vinh"
      permissions={DATABASE_PERMISSION_CODES}
      previewPathname="/parent-messages/groups"
      unreadNotificationCount={0}
    >
      <div className="grid min-w-0 gap-5">
        <PageHeader title="Liên kết nhóm Zalo sổ liên lạc">
          <p className="mt-1 text-secondary text-text-muted">Bản xem trước với dữ liệu giả.</p>
        </PageHeader>
        <ZaloConnectionStatusCard status={status} />
        {status.groupsTotal !== null ? (
          <ZaloGroupBulkLinker linkAction={previewLinkAction} matches={matchStudentsToGroups(fixtures, groups)} showGuardians students={students} />
        ) : (
          <Card>
            <CardContent>
              <EmptyState description={`Bảng gợi ý nhóm cho ${students.length} học sinh chưa liên kết hiện ra khi các bước kết nối ở trên đã xong.`} title="Chưa có gợi ý nhóm" />
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
