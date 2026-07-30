export interface NotificationEntry {
  createdAt: string;
  entityId: string | null;
  entityType: string | null;
  eventCode: string;
  href: string | null;
  id: string;
  message: string;
  readAt: string | null;
  title: string;
}

export type NotificationReadResult<T> =
  | {
      data: T;
      ok: true;
    }
  | {
      ok: false;
    };

export type NotificationActionResult =
  | {
      message: string;
      status: "success";
    }
  | {
      message: string;
      status: "error";
    };
