// Value: protects=the shared module vocabulary used by the /audit Module column and the settings permission matrix: Vietnamese names for every module the audit writers and permission codes use (incl. rbac, ops, parent_messages, settings, student_care, which the matrix's private map lacked), and a prototype-safe fallback;
// fails_when=a module name drifts, a lookup reads an Object prototype member ("constructor" would print a function), or the raw-code fallback stops capitalising word by word;
// why_new=step 14d lifts the settings page's private formatModuleName into src/lib so /audit can show the same names;
// seam=pure function, no mocks; no_claim=does not prove which modules exist in production rows (the audit map lists the writers)
import { describe, expect, it } from "vitest";

import { formatModuleLabel } from "@/lib/module-labels";

describe("formatModuleLabel", () => {
  it("names the modules the matrix already named the same way", () => {
    expect(formatModuleLabel("advances")).toBe("Tạm ứng lương");
    expect(formatModuleLabel("session_ledger")).toBe("Sổ buổi học");
    expect(formatModuleLabel("crm")).toBe("Tuyển sinh & CRM");
  });

  it("names the audit-only modules", () => {
    expect(formatModuleLabel("rbac")).toBe("Phân quyền");
    expect(formatModuleLabel("ops")).toBe("Vận hành hệ thống");
    expect(formatModuleLabel("parent_messages")).toBe("Tin nhắn phụ huynh");
    expect(formatModuleLabel("settings")).toBe("Cài đặt");
    expect(formatModuleLabel("student_care")).toBe("Chăm sóc học viên");
    expect(formatModuleLabel("ai_grading")).toBe("Chấm bài AI");
  });

  it("falls back to the capitalised code and never reads the prototype", () => {
    expect(formatModuleLabel("student_import")).toBe("Student Import");
    expect(formatModuleLabel("constructor")).toBe("Constructor");
    expect(formatModuleLabel("__proto__").trim()).toBe("Proto");
    expect(formatModuleLabel("toString")).toBe("ToString");
  });
});
