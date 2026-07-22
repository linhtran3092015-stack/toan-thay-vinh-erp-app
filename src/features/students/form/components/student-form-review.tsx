import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCurrency,
  getClassById,
  getCommunicationStatusLabel,
  getSaleOwnerName,
  getSourceLabel,
  getStatusLabel,
} from "../helpers";
import type { StudentFormValues } from "../student-form-schema";

interface StudentFormReviewProps {
  onClose: () => void;
  onConfirm: () => void;
  values: StudentFormValues;
}

export function StudentFormReview({
  onClose,
  onConfirm,
  values,
}: StudentFormReviewProps) {
  const selectedClass = getClassById(values.mainClassId);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-end bg-ink/40 p-0 md:items-center md:p-6"
      role="dialog"
    >
      <Card className="max-h-[92vh] w-full overflow-y-auto rounded-b-none border-hairline shadow-modal md:mx-auto md:max-w-3xl md:rounded-lg">
        <CardHeader className="items-start">
          <div>
            <CardTitle>Xem lại hồ sơ mock</CardTitle>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Chưa có dữ liệu nào được ghi vào database. Xác nhận bên dưới chỉ
              tạo thông báo mô phỏng.
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-2">
            <ReviewItem label="Học viên" value={values.fullName} />
            <ReviewItem
              label="Mã học viên"
              value={values.publicCode || "Chưa cấp mã"}
            />
            <ReviewItem label="Năm sinh" value={String(values.birthYear)} />
            <ReviewItem
              label="Trạng thái"
              value={getStatusLabel(values.lifecycleStatus)}
            />
            <ReviewItem
              label="Phụ huynh"
              value={`${values.guardianFullName} · ${values.guardianPhone}`}
            />
            <ReviewItem
              label="Lớp chính"
              value={selectedClass ? selectedClass.name : "Chưa chọn lớp"}
            />
            <ReviewItem
              label="Hình thức"
              value={values.registeredMode === "online" ? "Online" : "Offline"}
            />
            <ReviewItem label="Mức" value={values.learningLevel} />
            <ReviewItem
              label="Học phí"
              value={`${formatCurrency(Number(values.currentUnitPrice))}/buổi`}
            />
            <ReviewItem
              label="Ưu đãi"
              value={`${values.discountPercent}% · Tặng ${values.bonusSessions} buổi`}
            />
            <ReviewItem label="Nguồn" value={getSourceLabel(values.leadSourceId)} />
            <ReviewItem
              label="Sale"
              value={getSaleOwnerName(values.saleOwnerId)}
            />
            <ReviewItem
              label="Sổ liên lạc"
              value={getCommunicationStatusLabel(values.communicationGroupStatus)}
            />
            <ReviewItem
              label="Ngày học chính"
              value={values.expectedOfficialStartDate || "Chưa nhập"}
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="min-h-11" onClick={onClose} variant="outline">
              Quay lại chỉnh
            </Button>
            <Button className="min-h-11" onClick={onConfirm} variant="secondary">
              Xác nhận mô phỏng lưu
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-2 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-ink-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
