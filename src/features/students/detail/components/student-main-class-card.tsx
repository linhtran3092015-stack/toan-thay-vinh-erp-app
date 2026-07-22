import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudentMainClassDetail } from "@/features/students/detail/types";

interface StudentMainClassCardProps {
  mainClass: StudentMainClassDetail;
}

export function StudentMainClassCard({ mainClass }: StudentMainClassCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lớp chính</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <InfoLine label="Lớp" value={mainClass.className} />
        <InfoLine label="Giáo viên" value={mainClass.teacherName} />
        <InfoLine label="Lịch học" value={mainClass.scheduleText} />
        <InfoLine label="Phòng" value={mainClass.roomName} />
        <InfoLine label="Ngày chính thức" value={mainClass.officialStartDate} />
      </CardContent>
    </Card>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  );
}
