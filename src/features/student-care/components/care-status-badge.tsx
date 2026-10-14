import { Badge } from "@/components/ui/badge";

import { careStatusLabels } from "../models";
import { careStatusTones, type CareTaskStatus } from "../student-care-presentation";

/** Task status in words with its tone (open neutral, in progress info, following up warning, done success, exception neutral). */
export function CareStatusBadge({ status }: { status: CareTaskStatus }) {
  return (
    <Badge tone={careStatusTones[status]}>
      {careStatusLabels[status]}
    </Badge>
  );
}
