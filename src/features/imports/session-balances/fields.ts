import type {
  SessionBalanceImportFieldDefinition,
  SessionBalanceImportFieldKey,
} from "@/features/imports/session-balances/types";

export const SESSION_BALANCE_IMPORT_FIELD_DEFINITIONS = [
  {
    key: "student_public_code",
    label: "Mã học viên",
    required: true,
    templateHeader: "Mã học viên *",
    width: 22,
  },
  {
    key: "source_student_name",
    label: "Họ và tên học viên",
    required: false,
    templateHeader: "Họ và tên học viên",
    width: 28,
  },
  {
    key: "source_balance",
    label: "Số dư buổi",
    required: true,
    templateHeader: "Số dư buổi *",
    width: 18,
  },
] as const satisfies readonly SessionBalanceImportFieldDefinition[];

export const SESSION_BALANCE_IMPORT_FIELD_KEYS =
  SESSION_BALANCE_IMPORT_FIELD_DEFINITIONS.map(
    (definition) => definition.key,
  ) as SessionBalanceImportFieldKey[];

export const SESSION_BALANCE_IMPORT_REQUIRED_FIELD_KEYS =
  SESSION_BALANCE_IMPORT_FIELD_DEFINITIONS
    .filter((definition) => definition.required)
    .map(
      (definition) => definition.key,
    ) as SessionBalanceImportFieldKey[];
