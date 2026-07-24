import Link from "next/link";

import {
  AcademicYearStatusActions,
  CreateAcademicYearForm,
} from "@/features/classes/management/academic-year-management-actions";
import type {
  AcademicYearManagementItem,
} from "@/features/classes/read-models";

interface AcademicYearManagementPageProps {
  academicYears: AcademicYearManagementItem[];
  canManageAcademicYears: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Đang hoạt động",
  archived: "Đã lưu trữ",
  closed: "Đã đóng",
  draft: "Bản nháp",
};

const STATUS_CLASS_NAMES: Record<string, string> = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-700",
  archived:
    "border-slate-200 bg-slate-100 text-slate-600",
  closed:
    "border-amber-200 bg-amber-50 text-amber-700",
  draft:
    "border-blue-200 bg-blue-50 text-blue-700",
};

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function getStatusClassName(status: string): string {
  return (
    STATUS_CLASS_NAMES[status] ??
    "border-slate-200 bg-slate-50 text-slate-700"
  );
}

export function AcademicYearManagementPage({
  academicYears,
  canManageAcademicYears,
}: AcademicYearManagementPageProps) {
  const currentAcademicYear =
    academicYears.find(
      (academicYear) => academicYear.isCurrent,
    ) ?? null;

  const totalClasses = academicYears.reduce(
    (total, academicYear) =>
      total + academicYear.classCounts.total,
    0,
  );

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link
            className="text-sm font-medium text-slate-600 hover:text-slate-950"
            href="/classes"
          >
            ← Quay lại danh sách lớp
          </Link>

          <div>
            <h1 className="text-2xl font-semibold text-slate-950">
              Quản lý năm học
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              Theo dõi thời gian, trạng thái và số lượng
              lớp trong từng năm học.
            </p>
          </div>
        </div>

        <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
          {canManageAcademicYears
            ? "Có quyền quản lý"
            : "Chỉ có quyền xem"}
        </span>
      </header>

      {canManageAcademicYears ? (
        <CreateAcademicYearForm />
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            Tài khoản hiện tại chỉ có quyền xem năm học.
            Các thao tác tạo và thay đổi trạng thái đã
            được ẩn.
          </p>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Tổng số năm học
          </p>

          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {academicYears.length}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Năm học hiện tại
          </p>

          <p className="mt-2 text-lg font-semibold text-slate-950">
            {currentAcademicYear?.code ??
              "Chưa thiết lập"}
          </p>

          {currentAcademicYear ? (
            <p className="mt-1 text-sm text-slate-600">
              {currentAcademicYear.name}
            </p>
          ) : null}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Tổng số lớp
          </p>

          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {totalClasses}
          </p>
        </article>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Danh sách năm học
          </h2>

          <p className="text-sm text-slate-600">
            Năm học hiện tại luôn được ưu tiên hiển thị
            đầu tiên.
          </p>
        </div>

        {academicYears.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-medium text-slate-900">
              Chưa có năm học
            </p>

            <p className="mt-1 text-sm text-slate-600">
              Hệ thống chưa ghi nhận dữ liệu năm học.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {academicYears.map((academicYear) => (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                key={academicYear.id}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-950">
                        {academicYear.code}
                      </h3>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClassName(
                          academicYear.status,
                        )}`}
                      >
                        {getStatusLabel(
                          academicYear.status,
                        )}
                      </span>

                      {academicYear.isCurrent ? (
                        <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                          Năm học hiện tại
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-sm text-slate-600">
                      {academicYear.name}
                    </p>

                    <p className="mt-3 text-sm text-slate-500">
                      {formatDate(
                        academicYear.startsOn,
                      )}
                      {" – "}
                      {formatDate(
                        academicYear.endsOn,
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-500">
                        Tổng lớp
                      </p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {
                          academicYear.classCounts
                            .total
                        }
                      </p>
                    </div>

                    <div className="rounded-xl bg-blue-50 px-3 py-2">
                      <p className="text-xs text-blue-700">
                        Nháp
                      </p>
                      <p className="mt-1 font-semibold text-blue-950">
                        {
                          academicYear.classCounts
                            .draft
                        }
                      </p>
                    </div>

                    <div className="rounded-xl bg-emerald-50 px-3 py-2">
                      <p className="text-xs text-emerald-700">
                        Hoạt động
                      </p>
                      <p className="mt-1 font-semibold text-emerald-950">
                        {
                          academicYear.classCounts
                            .active
                        }
                      </p>
                    </div>

                    <div className="rounded-xl bg-amber-50 px-3 py-2">
                      <p className="text-xs text-amber-700">
                        Đã đóng
                      </p>
                      <p className="mt-1 font-semibold text-amber-950">
                        {
                          academicYear.classCounts
                            .closed
                        }
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-100 px-3 py-2">
                      <p className="text-xs text-slate-600">
                        Lưu trữ
                      </p>
                      <p className="mt-1 font-semibold text-slate-950">
                        {
                          academicYear.classCounts
                            .archived
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {canManageAcademicYears ? (
                  <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Thao tác năm học
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Mọi thay đổi trạng thái đều yêu
                        cầu nhập lý do.
                      </p>
                    </div>

                    <AcademicYearStatusActions
                      academicYear={academicYear}
                    />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
