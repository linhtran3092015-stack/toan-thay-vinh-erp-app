import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  ClassScheduleImportBatchDetail,
  ClassScheduleImportBatchRecord,
  ClassScheduleImportClassRowRecord,
  ClassScheduleImportScheduleRowRecord,
} from "./types";

const uuidSchema = z.string().uuid();

export async function getClassScheduleImportBatchDetail(
  batchId: string
): Promise<ClassScheduleImportBatchDetail | null> {
  const parsedId = uuidSchema.safeParse(batchId);
  if (!parsedId.success) {
    return null;
  }

  try {
    const supabase = await createSupabaseServerClient();

    // Fetch batch header
    const { data: batch, error: batchError } = await supabase
      .from("class_schedule_import_batches")
      .select("*")
      .eq("id", parsedId.data)
      .maybeSingle();

    if (batchError || !batch) {
      return null;
    }

    // Fetch class import rows
    const { data: classRows, error: classError } = await supabase
      .from("class_schedule_import_class_rows")
      .select("*")
      .eq("batch_id", parsedId.data)
      .order("source_row_number", { ascending: true });

    if (classError) {
      return null;
    }

    // Fetch schedule import rows
    const { data: scheduleRows, error: scheduleError } = await supabase
      .from("class_schedule_import_schedule_rows")
      .select("*")
      .eq("batch_id", parsedId.data)
      .order("source_row_number", { ascending: true });

    if (scheduleError) {
      return null;
    }

    return {
      batch: batch as unknown as ClassScheduleImportBatchRecord,
      classRows: (classRows || []) as unknown as ClassScheduleImportClassRowRecord[],
      scheduleRows: (scheduleRows || []) as unknown as ClassScheduleImportScheduleRowRecord[],
    };
  } catch {
    return null;
  }
}
