import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GuardianDetail } from "@/features/students/detail/types";

interface StudentGuardianCardProps {
  guardian: GuardianDetail;
}

export function StudentGuardianCard({ guardian }: StudentGuardianCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin phụ huynh</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <InfoLine label="Họ tên" value={guardian.fullName} />
        <InfoLine label="Quan hệ" value={guardian.relationship} />
        <InfoLine label="SĐT" value={guardian.phone} />
        <InfoLine label="Zalo" value={guardian.zalo} />
        <InfoLine label="Email" value={guardian.email} />
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
