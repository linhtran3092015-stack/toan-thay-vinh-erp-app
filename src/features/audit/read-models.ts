import type { Json } from "@/types/database.generated";

export interface AuditFilters {
  action: string;
  actorId: string;
  entityId: string;
  entityType: string;
  fromDate: string;
  module: string;
  toDate: string;
}

export interface AuditActor {
  displayName: string;
  email: string | null;
  id: string;
}

export interface AuditLogEntry {
  action: string;
  actor: AuditActor | null;
  actorUserId: string | null;
  entityId: string | null;
  entityType: string | null;
  id: string;
  metadata: Json;
  module: string;
  newData: Json | null;
  occurredAt: string;
  oldData: Json | null;
  reason: string | null;
  requestId: string | null;
}

export interface AuditActorOption {
  id: string;
  label: string;
}

export interface AuditFilterOptions {
  actions: readonly string[];
  actors: readonly AuditActorOption[];
  entityTypes: readonly string[];
  modules: readonly string[];
}

export interface AuditLogReadModel {
  entries: readonly AuditLogEntry[];
  filters: AuditFilters;
  options: AuditFilterOptions;
  totalCount: number;
}

export type AuditLogResult =
  | {
      data: AuditLogReadModel;
      ok: true;
    }
  | {
      ok: false;
    };
