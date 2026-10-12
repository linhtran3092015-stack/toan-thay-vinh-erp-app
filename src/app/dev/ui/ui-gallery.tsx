"use client";

import { Bell, Check, Ellipsis, Lock, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Badge, CountChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabPanel, Tabs } from "@/components/ui/tabs";

function Panel({
  title,
  meta,
  children,
  className,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)] ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-row px-4 py-3">
        <span className="text-body font-semibold text-text-strong">{title}</span>
        {meta ? <span className="text-caption text-text-muted">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-left text-caption font-semibold text-text-muted ${className ?? ""}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={`border-t border-border-row p-3 align-top ${className ?? ""}`} colSpan={colSpan}>
      {children}
    </td>
  );
}

function RowLabel({ title, note }: { title: string; note?: string }) {
  return (
    <Td className="px-4 font-medium text-text-strong">
      {title}
      {note ? <div className="text-caption font-normal text-text-muted">{note}</div> : null}
    </Td>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <div className="mt-1 text-caption text-text-muted">{children}</div>;
}

function ButtonsPanel() {
  return (
    <Panel
      meta="40px desktop · 44px touch · 32px hàng bảng · radius-md · focus 2px #315FCC + halo"
      title="Nút"
    >
      <table className="w-full table-fixed border-collapse text-secondary">
        <thead>
          <tr className="bg-table-header">
            <Th className="w-[104px] px-4">Loại</Th>
            <Th>Mặc định</Th>
            <Th>Hover (di chuột)</Th>
            <Th>Đang xử lý</Th>
            <Th>Disabled + lý do</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <RowLabel note="1 nút/trang" title="Chính" />
            <Td><Button>Lưu điểm danh</Button></Td>
            <Td><Button className="bg-action-primary-hover">Lưu điểm danh</Button></Td>
            <Td><Button isLoading>Đang lưu…</Button></Td>
            <Td><Button disabled disabledReason="Thiếu 1 kết quả">Khóa buổi học</Button></Td>
          </tr>
          <tr>
            <RowLabel title="Phụ" />
            <Td><Button variant="secondary">Xuất Excel</Button></Td>
            <Td><Button className="border-border-strong-hover bg-interactive-hover" variant="secondary">Xuất Excel</Button></Td>
            <Td><Button isLoading variant="secondary">Đang xuất…</Button></Td>
            <Td><Button disabled disabledReason="Không có dòng nào" variant="secondary">Xuất Excel</Button></Td>
          </tr>
          <tr>
            <RowLabel title="Ghost / chữ" />
            <Td><Button variant="ghost">Bỏ chọn</Button></Td>
            <Td><Button className="bg-interactive-hover text-text-strong" variant="ghost">Bỏ chọn</Button></Td>
            <Td className="text-text-subtle">—</Td>
            <Td><Button disabled variant="ghost">Bỏ chọn</Button></Td>
          </tr>
          <tr>
            <RowLabel note="không bao giờ là nút chính trang" title="Nguy hiểm" />
            <Td><Button variant="danger-outline">Hủy buổi…</Button></Td>
            <Td><Button className="bg-danger-bg" variant="danger-outline">Hủy buổi…</Button></Td>
            <Td>
              <Button variant="danger-solid">Xác nhận hủy</Button>
              <Hint>danger-solid: chỉ trong dialog</Hint>
            </Td>
            <Td><Button disabled disabledReason="Buổi đã khóa" variant="danger-outline">Hủy buổi…</Button></Td>
          </tr>
          <tr>
            <RowLabel note="luôn có aria-label + tooltip" title="Icon-only" />
            <Td className="align-middle" colSpan={2}>
              <div className="flex items-center gap-2">
                <Button aria-label="Thêm hành động" iconOnly variant="secondary">
                  <Ellipsis aria-hidden="true" size={18} />
                </Button>
                <Button aria-label="Đóng" iconOnly variant="ghost">
                  <X aria-hidden="true" size={20} strokeWidth={1.8} />
                </Button>
                <Button
                  aria-label="Thông báo, 4 chưa đọc"
                  className="bg-interactive-hover outline-2 outline-offset-2 outline-border-focus shadow-[0_0_0_5px_var(--focus-ring)]"
                  iconOnly
                  variant="ghost"
                >
                  <Bell aria-hidden="true" size={20} strokeWidth={1.8} />
                </Button>
                <span className="text-caption text-text-muted">← focus ring</span>
              </div>
            </Td>
            <Td className="align-middle" colSpan={2}>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary">Nhập kết quả</Button>
                <Button size="lg">44px touch</Button>
              </div>
              <Hint>32px: chỉ trong hàng bảng desktop, có nhãn</Hint>
            </Td>
          </tr>
          <tr>
            <RowLabel note="tên cũ, vẫn hỗ trợ" title="Alias" />
            <Td><Button variant="outline">outline</Button><Hint>→ viền nhạt</Hint></Td>
            <Td><Button variant="danger">danger</Button><Hint>→ danger-outline</Hint></Td>
            <Td colSpan={2} className="text-caption text-text-muted">
              Feature hiện có không cần đổi props.
            </Td>
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}

const badgeRows: Array<{
  family: string;
  note?: string;
  token: string;
  examples: ReactNode;
}> = [
  {
    family: "Success",
    token: "#16794C / #EAF8F1 / #B7E9D0",
    examples: (
      <>
        <Badge tone="success">Đang học</Badge>
        <Badge tone="success">Đã thu · SePay</Badge>
        <Badge tone="success">Có mặt</Badge>
        <Badge icon={<Check strokeWidth={2.5} />} tone="success">Khớp tự động</Badge>
      </>
    ),
  },
  {
    family: "Warning",
    token: "#A85B09 / #FFF5E5 / #F3D3A6",
    examples: (
      <>
        <Badge tone="warning">Chờ khóa</Badge>
        <Badge tone="warning">Thu một phần</Badge>
        <Badge tone="warning">Học thêm</Badge>
        <Badge tone="warning">Cần chú ý</Badge>
      </>
    ),
  },
  {
    family: "Danger",
    token: "#BE123C / #FFF1F2 / #FECDD3",
    examples: (
      <>
        <Badge tone="danger">Quá hạn 15 ngày</Badge>
        <Badge tone="danger">Vắng không phép</Badge>
        <Badge tone="danger">Chưa gửi được</Badge>
        <Badge tone="danger">Nhạy cảm</Badge>
      </>
    ),
  },
  {
    family: "Info",
    token: "#215FC7 / #EDF4FF / #BED4FB",
    examples: (
      <>
        <Badge tone="info">Sắp diễn ra</Badge>
        <Badge tone="info">Đang thu · 74%</Badge>
        <Badge tone="info">Vắng có phép</Badge>
        <Badge tone="info">Khai giảng 02/11</Badge>
      </>
    ),
  },
  {
    family: "Neutral",
    token: "#536174 / #F1F3F6 / #D5DCE6",
    examples: (
      <>
        <Badge icon={<Lock strokeWidth={2.2} />} tone="neutral">Đã khóa</Badge>
        <Badge tone="neutral">Đã kết thúc</Badge>
        <Badge tone="neutral">Chưa đóng</Badge>
        <Badge tone="neutral">Dạy thay</Badge>
      </>
    ),
  },
  {
    family: "Nhận diện",
    note: "không phải trạng thái",
    token: "#4F6B5A / #EDF2EE / #C9D8CE",
    examples: (
      <>
        <CountChip>5</CountChip>
        <span className="text-caption text-text-muted">số đếm việc tồn</span>
        <Badge tone="primary">Đang chọn</Badge>
        <span className="text-caption text-text-muted">
          Chỉ dùng cho chọn/active/đếm. Không dùng cho &quot;lỗi&quot; — lỗi là Danger.
        </span>
      </>
    ),
  },
];

function BadgesPanel() {
  return (
    <Panel meta="radius-sm · 12/500 · padding 3/9 · soft + fg + border · luôn có chữ" title="Badge trạng thái · 5 họ">
      <table className="w-full border-collapse text-secondary">
        <thead>
          <tr className="bg-table-header">
            <Th className="w-[90px] px-4">Họ</Th>
            <Th className="w-[200px]">Token</Th>
            <Th>Ví dụ nghiệp vụ (feature tự ánh xạ)</Th>
          </tr>
        </thead>
        <tbody>
          {badgeRows.map((row) => (
            <tr key={row.family}>
              <RowLabel note={row.note} title={row.family} />
              <Td className="text-caption tabular-nums text-text-muted">{row.token}</Td>
              <Td>
                <div className="flex flex-wrap items-center gap-2">{row.examples}</div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function TabsPanel() {
  const [active, setActive] = useState("overview");
  const tabsId = "dev-class-tabs";

  return (
    <Panel meta="40px · gạch dưới 2px · số đếm 12 muted · việc tồn = chấm 6px + số" title="Tab trong trang (tablist)">
      <div className="flex flex-col gap-4 p-4">
        <div>
          <div className="mb-1.5 text-caption font-semibold text-text-muted">Điều khiển panel (nút)</div>
          <Tabs
            id={tabsId}
            items={[
              { value: "overview", label: "Tổng quan" },
              { value: "sessions", label: "Buổi học", count: 36 },
              { value: "tuition", label: "Học phí", pending: 4 },
              { value: "archived", label: "Lưu trữ", disabled: true },
            ]}
            label="Mục trong lớp học"
            onValueChange={setActive}
            value={active}
          />
          <TabPanel activeValue={active} className="p-3 text-body text-text-default" tabsId={tabsId} value="overview">
            Tổng quan lớp: sĩ số, lịch tuần, giáo viên.
          </TabPanel>
          <TabPanel activeValue={active} className="p-3 text-body text-text-default" tabsId={tabsId} value="sessions">
            36 buổi học, chọn hàng loạt để tạo bù.
          </TabPanel>
          <TabPanel activeValue={active} className="p-3 text-body text-text-default" tabsId={tabsId} value="tuition">
            4 việc tồn về học phí cần xử lý.
          </TabPanel>
          <TabPanel activeValue={active} className="p-3 text-body text-text-default" tabsId={tabsId} value="archived">
            Lưu trữ.
          </TabPanel>
        </div>
        <div>
          <div className="mb-1.5 text-caption font-semibold text-text-muted">Điều hướng route (link, aria-current)</div>
          <Tabs
            items={[
              { value: "payments", label: "Thanh toán & số dư buổi", href: "/dev/ui#payments" },
              { value: "classes", label: "Lớp", count: 2, href: "/dev/ui#classes" },
              { value: "attendance", label: "Điểm danh", href: "/dev/ui#attendance" },
              { value: "care", label: "Chăm sóc", pending: 1, href: "/dev/ui#care" },
              { value: "history", label: "Lịch sử", href: "/dev/ui#history" },
            ]}
            label="Mục trong hồ sơ học sinh"
            value="payments"
          />
        </div>
      </div>
    </Panel>
  );
}

function ResultsPanel() {
  return (
    <Panel meta="đặt ngay dưới hành động sinh ra nó · toast chỉ cho việc nền" title="Kết quả gắn ngữ cảnh (thay cho toast vô danh)">
      <div className="flex flex-col gap-3 p-4">
        <ResultBanner
          action={<a href="/dev/ui#next">Tiếp tục nhập kết quả</a>}
          description="· 21:34 · Lê Bích Ngọc."
          title="Đã lưu điểm danh 22/22"
          tone="success"
        />
        <ResultBanner
          action={
            <Button className="h-7 border-warning px-2.5 text-[13px] text-warning hover:bg-warning-bg" size="sm" variant="secondary">
              Tải lại
            </Button>
          }
          description="Người khác vừa sửa buổi này lúc 21:51."
          title="Dữ liệu đã cũ."
          tone="conflict"
        />
        <ResultBanner
          action={<a href="/dev/ui#fix">Sửa SĐT</a>}
          description="Trịnh Bảo Châu, Đặng Hải Đăng: SĐT Zalo không hợp lệ. 39 em đã nhận."
          title="Gửi nhắc thất bại cho 2/41 học sinh."
          tone="error"
        />
        <ResultBanner
          description="Kỳ thu tháng 11 sẽ được khóa lúc 23:59 ngày 05/11."
          title="Thông tin."
          tone="info"
        />
        <ResultBanner
          description="Có 3 học sinh chưa có số dư buổi; phiếu của các em sẽ bỏ trống phần số dư."
          title="Cần chú ý."
          tone="warning"
        />
        <div className="text-caption text-text-muted">
          Toast (góc dưới phải, nền #202B40, tự tắt 6 giây, có nút đóng) chỉ cho việc chạy nền — sẽ làm ở bước sau.
        </div>
      </div>
    </Panel>
  );
}

function TokensPanel() {
  const swatches: Array<[string, string]> = [
    ["canvas", "bg-surface-canvas"],
    ["base", "bg-surface-base"],
    ["sunken", "bg-surface-sunken"],
    ["selected", "bg-surface-selected"],
    ["hover", "bg-surface-hover"],
    ["table-header", "bg-table-header"],
    ["primary", "bg-action-primary"],
    ["primary-soft", "bg-action-primary-soft"],
    ["success", "bg-success"],
    ["warning", "bg-warning"],
    ["danger", "bg-danger"],
    ["info", "bg-info"],
    ["neutral", "bg-neutral"],
  ];

  return (
    <Panel className="col-span-full" meta="Be Vietnam Pro · 24/32 · 18/28 · 14/20 · 13/18 · 12/16 · tabular-nums" title="Token · chữ">
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="flex flex-wrap gap-2">
          {swatches.map(([name, className]) => (
            <div className="flex items-center gap-2 rounded-sm border border-border-subtle px-2 py-1" key={name}>
              <span aria-hidden="true" className={`h-5 w-5 rounded-sm border border-border-row ${className}`} />
              <span className="text-caption text-text-muted">{name}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title font-semibold text-text-strong">Tiêu đề trang 24/32/600</h1>
          <h2 className="text-section-title font-semibold text-text-strong">Tiêu đề mục 18/28/600</h2>
          <p className="text-body text-text-default">Thân bài 14/20/400 · màu chữ #4A5566.</p>
          <p className="text-label font-medium text-text-strong">Nhãn 13/18/500</p>
          <p className="text-caption text-text-muted">Chú thích 12/16 · muted #647083</p>
          <p className="text-numeric font-bold tabular-nums text-text-strong">2.400.000 ₫</p>
        </div>
      </div>
    </Panel>
  );
}

export function UiGallery() {
  return (
    <main className="min-h-screen bg-surface-sunken p-6 text-text-strong lg:p-10">
      <div className="mb-6 flex items-center gap-3">
        <span className="rounded-sm bg-[#202B40] px-[9px] py-[3px] text-caption font-medium text-white">10</span>
        <span className="text-section-title font-semibold">
          Thư viện component · token theo HANDOFF 12/10/2026 · Be Vietnam Pro
        </span>
      </div>
      <div className="grid max-w-[1440px] gap-6 xl:grid-cols-2">
        <ButtonsPanel />
        <BadgesPanel />
        <TabsPanel />
        <ResultsPanel />
        <TokensPanel />
      </div>
    </main>
  );
}
