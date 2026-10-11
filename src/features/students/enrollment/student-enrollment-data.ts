import "server-only";

import { getClassDirectory } from "@/features/classes/data";
import type {
  ClassDirectoryItem,
} from "@/features/classes/read-models";
import type {
  StudentEnrollmentActionAvailability,
  StudentEnrollmentClassOption,
  StudentEnrollmentUiModel,
} from "@/features/students/enrollment/student-enrollment-ui-types";
import type {
  StudentDetailReadModel,
} from "@/features/students/read-models";
import type {
  PermissionCode,
} from "@/lib/permissions/types";

import { permissionDeniedMessage } from "@/lib/permissions/labels";
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

export async function getStudentEnrollmentUiModel(
  detail: StudentDetailReadModel,
  permissions: readonly PermissionCode[],
): Promise<StudentEnrollmentUiModel> {
  const canViewClasses =
    permissions.includes("classes.view");

  const needsClassOptions =
    canViewClasses &&
    (
      detail.enrollmentHistory.length === 0 ||
      detail.activeEnrollment !== null ||
      isReadyToResume(detail)
    );

  const classResult = needsClassOptions
    ? await getClassDirectory({
        includeStudentCounts: false,
      })
    : null;

  const classOptionsError =
    classResult && !classResult.ok
      ? classResult.error.message
      : null;

  const classOptions =
    classResult?.ok
      ? classResult.classes
          .filter(isActiveClass)
          .map(toClassOption)
      : [];

  const activeEnrollment =
    detail.activeEnrollment;

  const latestEnrollment =
    detail.enrollmentHistory[0] ?? null;

  const transferClassOptions =
    activeEnrollment?.classInfo
      ? classOptions.filter(
          (classOption) =>
            classOption.id !==
            activeEnrollment.classInfo?.id,
        )
      : classOptions;

  const hasEnrollmentHistory =
    detail.enrollmentHistory.length > 0;

  const enrollVisible =
    !hasEnrollmentHistory;

  const transferVisible =
    activeEnrollment !== null;

  const reserveVisible =
    activeEnrollment !== null;

  const resumeVisible =
    isReadyToResume(detail);

  return {
    actions: {
      end: createPermissionAvailability({
        hasPermission: permissions.includes(
          "students.manage_status",
        ),
        permissionCode: "students.manage_status",
        visible: activeEnrollment !== null,
      }),

      enroll: createClassActionAvailability({
        canViewClasses,
        classOptions,
        classOptionsError,
        hasPermission: permissions.includes(
          "students.manage_status",
        ),
        permissionCode:
          "students.manage_status",
        visible: enrollVisible,
      }),

      reserve: createPermissionAvailability({
        hasPermission: permissions.includes(
          "students.reserve",
        ),
        permissionCode: "students.reserve",
        visible: reserveVisible,
      }),

      resume: createClassActionAvailability({
        canViewClasses,
        classOptions,
        classOptionsError,
        hasPermission: permissions.includes(
          "students.reserve",
        ),
        permissionCode: "students.reserve",
        visible: resumeVisible,
      }),

      transfer: createClassActionAvailability({
        canViewClasses,
        classOptions: transferClassOptions,
        classOptionsError,
        hasPermission: permissions.includes(
          "students.transfer_class",
        ),
        permissionCode:
          "students.transfer_class",
        visible: transferVisible,
      }),
    },

    activeEnrollment,
    businessDate: getVietnamBusinessDate(),
    classOptions,
    classOptionsError,

    defaultRegisteredMode:
      activeEnrollment?.registeredMode ??
      detail.registeredMode ??
      "offline",

    latestEnrollment,
    transferClassOptions,
  };
}

function isReadyToResume(
  detail: StudentDetailReadModel,
): boolean {
  if (detail.activeEnrollment) {
    return false;
  }

  const latestEnrollment =
    detail.enrollmentHistory[0];

  // Reserved students resume; withdrawn students (enrollment "completed")
  // come back through the same flow.
  return (
    (latestEnrollment?.status === "reserved" ||
      latestEnrollment?.status === "completed") &&
    latestEnrollment.effectiveTo !== null
  );
}

function isActiveClass(
  classItem: ClassDirectoryItem,
): boolean {
  return classItem.status === "active";
}

function toClassOption(
  classItem: ClassDirectoryItem,
): StudentEnrollmentClassOption {
  return {
    academicYearName:
      classItem.academicYear?.name ?? null,
    code: classItem.code,
    defaultLearningMode:
      classItem.defaultLearningMode,
    grade: classItem.grade,
    id: classItem.id,
    level: classItem.level,
    name: classItem.name,
  };
}

function createPermissionAvailability({
  hasPermission,
  permissionCode,
  visible,
}: {
  hasPermission: boolean;
  permissionCode: PermissionCode;
  visible: boolean;
}): StudentEnrollmentActionAvailability {
  if (!visible) {
    return {
      enabled: false,
      reason: null,
      visible: false,
    };
  }

  if (!hasPermission) {
    return {
      enabled: false,
      reason:
        `Tài khoản hiện tại không có quyền ${permissionCode}.`,
      visible: true,
    };
  }

  return {
    enabled: true,
    reason: null,
    visible: true,
  };
}

function createClassActionAvailability({
  canViewClasses,
  classOptions,
  classOptionsError,
  hasPermission,
  permissionCode,
  visible,
}: {
  canViewClasses: boolean;
  classOptions: StudentEnrollmentClassOption[];
  classOptionsError: string | null;
  hasPermission: boolean;
  permissionCode: PermissionCode;
  visible: boolean;
}): StudentEnrollmentActionAvailability {
  const permissionAvailability =
    createPermissionAvailability({
      hasPermission,
      permissionCode,
      visible,
    });

  if (
    !permissionAvailability.visible ||
    !permissionAvailability.enabled
  ) {
    return permissionAvailability;
  }

  if (!canViewClasses) {
    return {
      enabled: false,
      reason:
        permissionDeniedMessage("classes.view"),
      visible: true,
    };
  }

  if (classOptionsError) {
    return {
      enabled: false,
      reason:
        "Không tải được danh sách lớp đang hoạt động.",
      visible: true,
    };
  }

  if (classOptions.length === 0) {
    return {
      enabled: false,
      reason:
        "Không có lớp đang hoạt động phù hợp để thực hiện thao tác.",
      visible: true,
    };
  }

  return permissionAvailability;
}

function getVietnamBusinessDate(
  date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      day: "2-digit",
      month: "2-digit",
      timeZone: VIETNAM_TIME_ZONE,
      year: "numeric",
    },
  ).formatToParts(date);

  const values = new Map(
    parts.map((part) => [
      part.type,
      part.value,
    ]),
  );

  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");

  if (!year || !month || !day) {
    throw new Error(
      "Không xác định được ngày nghiệp vụ Việt Nam.",
    );
  }

  return `${year}-${month}-${day}`;
}
