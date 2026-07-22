import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockLeadSources, mockSaleOwners } from "../mock-form-data";
import type { StudentFormValues } from "../student-form-schema";
import type {
  StudentFormMode,
  StudentFormPermissionSet,
} from "../student-form-types";
import {
  describedBy,
  fieldControlClass,
  FieldShell,
  getFieldError,
  textAreaControlClass,
} from "./form-controls";

interface AcquisitionInfoSectionProps {
  mode: StudentFormMode;
  onMockAction: (label: string) => void;
  permissions: StudentFormPermissionSet;
}

export function AcquisitionInfoSection({
  mode,
  onMockAction,
  permissions,
}: AcquisitionInfoSectionProps) {
  const {
    formState: { errors },
    register,
  } = useFormContext<StudentFormValues>();
  const isSourceLocked = mode === "edit" || !permissions.canManageSource;
  const isSaleLocked = mode === "edit" || !permissions.canManageSale;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nguồn tuyển sinh</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-lg border border-info-border bg-info-bg p-4 text-sm leading-6 text-info">
          Source và sale là thông tin đối soát nội bộ. Ở màn hình mock này,
          chỉnh sửa chỉ mô phỏng và chưa ghi dữ liệu thật.
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FieldShell
            error={getFieldError(errors, "leadSourceId")}
            hint={isSourceLocked ? "🔒 Nguồn đang khóa theo quyền mock." : undefined}
            id="leadSourceId"
            label="Nguồn"
            required
          >
            <select
              aria-describedby={describedBy(
                "leadSourceId",
                getFieldError(errors, "leadSourceId"),
                isSourceLocked ? "Nguồn đang khóa theo quyền mock." : undefined,
              )}
              aria-disabled={isSourceLocked}
              className={fieldControlClass(
                getFieldError(errors, "leadSourceId"),
                isSourceLocked ? "pointer-events-none bg-neutral-bg" : undefined,
              )}
              id="leadSourceId"
              tabIndex={isSourceLocked ? -1 : undefined}
              {...register("leadSourceId")}
            >
              {mockLeadSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </FieldShell>

          <FieldShell id="partnerName" label="Đối tác/nguồn chi tiết">
            <input
              aria-disabled={isSourceLocked}
              className={fieldControlClass(
                undefined,
                isSourceLocked ? "bg-neutral-bg" : undefined,
              )}
              id="partnerName"
              readOnly={isSourceLocked}
              {...register("partnerName")}
            />
          </FieldShell>

          <FieldShell
            error={getFieldError(errors, "saleOwnerId")}
            hint={isSaleLocked ? "🔒 Sale phụ trách đang khóa theo quyền mock." : undefined}
            id="saleOwnerId"
            label="Sale phụ trách"
            required
          >
            <select
              aria-describedby={describedBy(
                "saleOwnerId",
                getFieldError(errors, "saleOwnerId"),
                isSaleLocked
                  ? "Sale phụ trách đang khóa theo quyền mock."
                  : undefined,
              )}
              aria-disabled={isSaleLocked}
              className={fieldControlClass(
                getFieldError(errors, "saleOwnerId"),
                isSaleLocked ? "pointer-events-none bg-neutral-bg" : undefined,
              )}
              id="saleOwnerId"
              tabIndex={isSaleLocked ? -1 : undefined}
              {...register("saleOwnerId")}
            >
              {mockSaleOwners.map((saleOwner) => (
                <option key={saleOwner.id} value={saleOwner.id}>
                  {saleOwner.name}
                </option>
              ))}
            </select>
          </FieldShell>

          <FieldShell id="recordedAt" label="Ngày ghi nhận nguồn">
            <input
              className={fieldControlClass()}
              id="recordedAt"
              type="date"
              {...register("recordedAt")}
            />
          </FieldShell>
        </div>

        {(isSourceLocked || isSaleLocked) ? (
          <Button
            className="min-h-11 justify-self-start"
            onClick={() => onMockAction("Yêu cầu điều chỉnh nguồn/sale")}
            variant="outline"
          >
            🔒 Yêu cầu điều chỉnh nguồn/sale
          </Button>
        ) : null}

        <FieldShell id="sourceNote" label="Ghi chú nguồn">
          <textarea
            className={textAreaControlClass()}
            id="sourceNote"
            {...register("sourceNote")}
          />
        </FieldShell>
      </CardContent>
    </Card>
  );
}
