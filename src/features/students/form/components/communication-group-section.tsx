import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCommunicationStatusLabel } from "../helpers";
import type { StudentFormValues } from "../student-form-schema";
import {
  describedBy,
  fieldControlClass,
  FieldShell,
  getFieldError,
  textAreaControlClass,
} from "./form-controls";

const communicationStatuses = [
  "not_created",
  "pending",
  "created",
  "not_required",
] as const;

export function CommunicationGroupSection() {
  const {
    formState: { errors },
    register,
    watch,
  } = useFormContext<StudentFormValues>();
  const communicationGroupStatus = watch("communicationGroupStatus");
  const isGroupCreated = communicationGroupStatus === "created";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sổ liên lạc</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FieldShell id="communicationGroupStatus" label="Trạng thái">
            <select
              className={fieldControlClass()}
              id="communicationGroupStatus"
              {...register("communicationGroupStatus")}
            >
              {communicationStatuses.map((status) => (
                <option key={status} value={status}>
                  {getCommunicationStatusLabel(status)}
                </option>
              ))}
            </select>
          </FieldShell>

          <FieldShell id="communicationGroupName" label="Tên nhóm">
            <input
              className={fieldControlClass()}
              id="communicationGroupName"
              {...register("communicationGroupName")}
            />
          </FieldShell>

          <FieldShell id="communicationGroupLink" label="Link nhóm">
            <input
              className={fieldControlClass()}
              id="communicationGroupLink"
              type="url"
              {...register("communicationGroupLink")}
            />
          </FieldShell>

          <FieldShell
            error={getFieldError(errors, "communicationGroupCreatedAt")}
            id="communicationGroupCreatedAt"
            label="Ngày tạo nhóm"
          >
            <input
              aria-describedby={describedBy(
                "communicationGroupCreatedAt",
                getFieldError(errors, "communicationGroupCreatedAt"),
              )}
              className={fieldControlClass(
                getFieldError(errors, "communicationGroupCreatedAt"),
              )}
              disabled={!isGroupCreated}
              id="communicationGroupCreatedAt"
              type="date"
              {...register("communicationGroupCreatedAt")}
            />
          </FieldShell>

          <FieldShell id="communicationGroupCreatedBy" label="Người tạo">
            <input
              className={fieldControlClass()}
              disabled={!isGroupCreated}
              id="communicationGroupCreatedBy"
              {...register("communicationGroupCreatedBy")}
            />
          </FieldShell>
        </div>

        <FieldShell id="communicationGroupNote" label="Ghi chú sổ liên lạc">
          <textarea
            className={textAreaControlClass()}
            id="communicationGroupNote"
            {...register("communicationGroupNote")}
          />
        </FieldShell>
      </CardContent>
    </Card>
  );
}
