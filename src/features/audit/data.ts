import "server-only";

import {
  AUDIT_FILTER_OPTION_ROW_LIMIT,
  AUDIT_LOG_ROW_LIMIT,
  getActorDisplayName,
  getAuditActorOptionLabel,
  getNextCalendarDate,
  normalizeAuditFilters,
  sortUnique,
} from "@/features/audit/audit-log-models";
import type {
  AuditActor,
  AuditActorOption,
  AuditFilters,
  AuditLogEntry,
  AuditLogResult,
} from "@/features/audit/read-models";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const AUDIT_COLUMNS =
  "id,occurred_at,actor_user_id,module,action,entity_type,entity_id,old_data,new_data,reason,request_id,metadata";

const AUDIT_CATALOG_COLUMNS =
  "module,action,entity_type,actor_user_id";

export async function getAuditLogsResult(
  input: Partial<AuditFilters>,
): Promise<AuditLogResult> {
  const filters: AuditFilters = normalizeAuditFilters(input);

  try {
    const supabase = await createSupabaseServerClient();

    let auditQuery = supabase
      .from("audit_logs")
      .select(AUDIT_COLUMNS, {
        count: "exact",
      })
      .order("occurred_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .limit(AUDIT_LOG_ROW_LIMIT);

    if (filters.module) {
      auditQuery = auditQuery.eq("module", filters.module);
    }

    if (filters.action) {
      auditQuery = auditQuery.eq("action", filters.action);
    }

    if (filters.entityType) {
      auditQuery = auditQuery.eq("entity_type", filters.entityType);
    }

    if (filters.entityId) {
      auditQuery = auditQuery.eq("entity_id", filters.entityId);
    }

    if (filters.actorId) {
      auditQuery = auditQuery.eq("actor_user_id", filters.actorId);
    }

    if (filters.fromDate) {
      auditQuery = auditQuery.gte(
        "occurred_at",
        `${filters.fromDate}T00:00:00+07:00`,
      );
    }

    if (filters.toDate) {
      auditQuery = auditQuery.lt(
        "occurred_at",
        `${getNextCalendarDate(filters.toDate)}T00:00:00+07:00`,
      );
    }

    const [auditResult, catalogResult] = await Promise.all([
      auditQuery,
      supabase
        .from("audit_logs")
        .select(AUDIT_CATALOG_COLUMNS)
        .order("occurred_at", {
          ascending: false,
        })
        .limit(AUDIT_FILTER_OPTION_ROW_LIMIT),
    ]);

    if (
      auditResult.error ||
      catalogResult.error ||
      !auditResult.data ||
      !catalogResult.data
    ) {
      return { ok: false };
    }

    const actorIds = [
      ...new Set(
        [...auditResult.data, ...catalogResult.data]
          .map((row) => row.actor_user_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const actorsById = new Map<string, AuditActor>();

    if (actorIds.length > 0) {
      const profileResult = await supabase
        .from("profiles")
        .select("id,email,display_name")
        .in("id", actorIds);

      if (!profileResult.error && profileResult.data) {
        for (const profile of profileResult.data) {
          actorsById.set(profile.id, {
            displayName: getActorDisplayName(
              profile.display_name,
              profile.email,
            ),
            email: profile.email,
            id: profile.id,
          });
        }
      }
    }

    const actorOptions: AuditActorOption[] = actorIds
      .map((actorId) => {
        const actor = actorsById.get(actorId);

        return {
          id: actorId,
          label: getAuditActorOptionLabel(actorId, actor),
        };
      })
      .sort((left, right) =>
        left.label.localeCompare(right.label, "vi"),
      );

    const entries: AuditLogEntry[] = auditResult.data.map((row) => ({
      action: row.action,
      actor: row.actor_user_id
        ? actorsById.get(row.actor_user_id) ?? null
        : null,
      actorUserId: row.actor_user_id,
      entityId: row.entity_id,
      entityType: row.entity_type,
      id: row.id,
      metadata: row.metadata,
      module: row.module,
      newData: row.new_data,
      occurredAt: row.occurred_at,
      oldData: row.old_data,
      reason: row.reason,
      requestId: row.request_id,
    }));

    return {
      data: {
        entries,
        filters,
        options: {
          actions: sortUnique(
            catalogResult.data.map((row) => row.action),
          ),
          actors: actorOptions,
          entityTypes: sortUnique(
            catalogResult.data.map((row) => row.entity_type),
          ),
          modules: sortUnique(
            catalogResult.data.map((row) => row.module),
          ),
        },
        totalCount: auditResult.count ?? entries.length,
      },
      ok: true,
    };
  } catch {
    return { ok: false };
  }
}
