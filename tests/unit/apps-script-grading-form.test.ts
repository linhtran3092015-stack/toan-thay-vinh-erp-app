import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { beforeEach, describe, expect, it } from "vitest";

import { parseGradingSubmissionPayload } from "@/features/grading-submissions/payload";
import { verifyGradingSignature } from "@/features/grading-submissions/signature";

/**
 * Runs integrations/apps-script/grading-form/Code.gs in a VM with small stand-ins for the Apps
 * Script services, and checks what it writes to the Sheet and sends to the ERP against the real
 * ERP parser and signature check.
 */

const SECRET = "test-secret-0123456789abcdef0123456789";
const CODE_GS = readFileSync(path.join(process.cwd(), "integrations/apps-script/grading-form/Code.gs"), "utf8");
const OLD_HEADERS = [
  "Họ và tên", "Tên", "Bài thi đầu ra học sinh", "Điểm thi", "Điểm vở", "Timestamp", "Xếp hạng", "Nhận xét",
  "Năm sinh", "Lớp", "", "", "", "Học thử tiếng Anh", "SĐT bố/mẹ", "Ảnh",
];

type Cell = string | number;

class FakeSheet {
  rows: Cell[][];
  maxColumns: number;
  constructor(rows: Cell[][], maxColumns = 26) {
    this.rows = rows.map((row) => [...row]);
    this.maxColumns = maxColumns;
  }
  getMaxColumns() {
    return this.maxColumns;
  }
  insertColumnsAfter(_after: number, count: number) {
    this.maxColumns += count;
  }
  getLastRow() {
    return this.rows.length;
  }
  getLastColumn() {
    let last = 0;
    for (const row of this.rows) row.forEach((cell, index) => { if (cell !== "" && cell !== undefined) last = Math.max(last, index + 1); });
    return last;
  }
  appendRow(values: Cell[]) {
    this.rows.push([...values]);
  }
  getDataRange() {
    return this.getRange(1, 1, this.rows.length, this.getLastColumn());
  }
  cell(row: number, column: number): Cell {
    return this.rows[row - 1]?.[column - 1] ?? "";
  }
  getRange(row: number, column: number, numRows = 1, numColumns = 1) {
    const sheet = this;
    const block = () =>
      Array.from({ length: numRows }, (_, r) => Array.from({ length: numColumns }, (_, c) => sheet.cell(row + r, column + c)));
    return {
      createTextFinder(text: string) {
        return {
          matchEntireCell() {
            return {
              findNext() {
                for (let r = 0; r < numRows; r++) {
                  if (String(sheet.cell(row + r, column)) === text) return { getRow: () => row + r };
                }
                return null;
              },
            };
          },
        };
      },
      getDisplayValues: () => block().map((line) => line.map((value) => String(value).replace(/^'/, ""))),
      getValues: block,
      setValue(value: Cell) {
        if (column > sheet.maxColumns) throw new Error("Range out of bounds");
        while (sheet.rows.length < row) sheet.rows.push([]);
        const line = sheet.rows[row - 1];
        while (line.length < column) line.push("");
        line[column - 1] = value;
      },
    };
  }
}

interface Sent {
  body?: string;
  headers: Record<string, string>;
  method: string;
  url: string;
}

function vietnamParts(date: Date) {
  const shifted = new Date(date.getTime() + 7 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dd: pad(shifted.getUTCDate()), HH: pad(shifted.getUTCHours()), MM: pad(shifted.getUTCMonth() + 1), mm: pad(shifted.getUTCMinutes()),
    ss: pad(shifted.getUTCSeconds()), yyyy: String(shifted.getUTCFullYear()),
  };
}

function loadScript({ data, now, respond }: { data: FakeSheet; now: Date; respond: (request: Sent) => { body: unknown; status: number } }) {
  const sent: Sent[] = [];
  const cache = new Map<string, string>();
  const roster = new FakeSheet([["Năm sinh", "Họ tên", "Tên"], [2014, "Lê Văn An", "An"]]);
  const context = {
    CacheService: { getScriptCache: () => ({ get: (k: string) => cache.get(k) ?? null, put: (k: string, v: string) => cache.set(k, v) }) },
    console: { log: () => {} },
    Date: class extends Date {
      constructor(value?: number | string | Date) {
        super(value ?? now.getTime());
      }
      static now() {
        return now.getTime();
      }
    },
    HtmlService: {},
    JSON,
    LockService: {
      getDocumentLock: () => ({ releaseLock() {}, waitLock() {} }),
      getScriptLock: () => ({ releaseLock() {}, tryLock: () => true }),
    },
    Math,
    Number,
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (key: string) => ({ ERP_BASE_URL: "https://erp.example/", ERP_FORM_SECRET: SECRET })[key] ?? null }),
    },
    ScriptApp: {},
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getSheetByName: (name: string) => (name === "Data" ? data : name === "DanhSachHocSinh" ? roster : null) }),
    },
    String,
    UrlFetchApp: {
      fetch(url: string, options: { headers: Record<string, string>; method: string; payload?: string }) {
        const request = { body: options.payload, headers: options.headers, method: options.method, url };
        sent.push(request);
        const answer = respond(request);
        // The ERP sends "application/json" without a charset; read without one, the bytes would be
        // decoded as Latin-1 ("Nguyá»…n"), so only an explicit UTF-8 read gets the real text.
        const text = JSON.stringify(answer.body);
        return {
          getContentText: (charset?: string) => (charset?.toUpperCase() === "UTF-8" ? text : Buffer.from(text, "utf8").toString("latin1")),
          getResponseCode: () => answer.status,
        };
      },
    },
    Utilities: {
      Charset: { UTF_8: "UTF-8" },
      computeHmacSha256Signature(value: string, key: string) {
        // Apps Script returns signed bytes.
        return [...createHmac("sha256", key).update(value, "utf8").digest()].map((b) => (b > 127 ? b - 256 : b));
      },
      formatDate(date: Date, _zone: string, pattern: string) {
        const p = vietnamParts(date);
        return pattern
          .replace("yyyy", p.yyyy).replace("MM", p.MM).replace("dd", p.dd).replace("HH", p.HH).replace("mm", p.mm).replace("ss", p.ss)
          .replace("'T'", "T").replace("XXX", "+07:00");
      },
      getUuid: () => randomUUID(),
      sleep() {},
    },
  };
  vm.createContext(context);
  vm.runInContext(CODE_GS, context);
  return { cache, context: context as unknown as Record<string, (...args: unknown[]) => unknown>, sent };
}

const NOW = new Date("2026-10-18T12:35:00Z"); // 19:35 in Vietnam
const SESSION_ID = "3a000000-0000-4000-8000-000000000031";

function erpAccepts(request: Sent) {
  const url = new URL(request.url);
  const message = request.method === "get" ? `GET ${url.pathname}${url.search}` : request.body ?? "";
  const valid = verifyGradingSignature({
    message,
    nowMs: NOW.getTime(),
    secret: SECRET,
    signature: request.headers["x-ttv-signature"],
    timestamp: request.headers["x-ttv-timestamp"],
  });
  if (!valid) return { body: { ok: false }, status: 401 };
  if (request.method === "get") {
    return { body: { birthYears: [2014], ok: true, students: [{ code: "TV-2026-00001", fullName: "Nguyễn Minh Anh", givenName: "Anh", label: "Nguyễn Minh Anh", sessions: [{ id: SESSION_ID, label: "7CLC1 · 18:00–19:30" }] }] }, status: 200 };
  }
  const parsed = parseGradingSubmissionPayload(request.body ?? "");
  return parsed.ok ? { body: { duplicate: false, matchStatus: "matched", ok: true }, status: 200 } : { body: { ok: false }, status: 400 };
}

describe("Apps Script grading form (Code.gs)", () => {
  let data: FakeSheet;
  beforeEach(() => {
    data = new FakeSheet([OLD_HEADERS, ["Bài cũ", "Cũ", "13. 18", "", "", "01/10/2026 19:00:00", "", "", 2014, "A - Nâng cao - Thầy Vinh"]]);
  });

  it("writes the Sheet as before, then posts a signed payload the ERP accepts (code, session, no phone)", () => {
    const { context, sent } = loadScript({ data, now: NOW, respond: erpAccepts });

    const result = context.processForm({
      buoiHoc: "",
      buoiHocErp: SESSION_ID,
      buoiHocErpLabel: "Buổi 7CLC1 · 18:00–19:30",
      hoTen: "TV-2026-00001",
      hoTenDayDu: "Nguyễn Minh Anh",
      hoTenManual: "",
      linkBaiThi: "13. x=18\n14. 8",
      maHocSinh: "TV-2026-00001",
      namSinh: "2014",
      sdtBoMe: "0912344828",
      tenHocSinh: "Anh",
      files: [],
    });

    expect(result).toBe("OK");
    const header = data.rows[0];
    expect(header.slice(16)).toEqual(["Mã HS ERP", "Buổi học ERP", "Mã bài ERP", "Giờ nộp ERP", "Đã gửi ERP"]);
    const row = data.rows[2];
    expect(row.slice(0, 3)).toEqual(["Nguyễn Minh Anh", "Anh", "'13. x=18\n14. 8"]);
    expect(row[5]).toBe("18/10/2026 19:35:00");
    expect(row[9]).toBe("Buổi 7CLC1 · 18:00–19:30");
    expect(row[14]).toBe("'0912344828");
    expect(row.slice(16, 18)).toEqual(["TV-2026-00001", SESSION_ID]);
    expect(String(row[20])).toMatch(/^OK 18\/10 19:35$/);

    expect(sent).toHaveLength(1);
    const payload = JSON.parse(sent[0].body ?? "{}");
    expect(payload).toMatchObject({
      birthYear: 2014,
      classOption: null,
      classSessionId: SESSION_ID,
      externalId: row[18],
      fullName: "Nguyễn Minh Anh",
      studentCode: "TV-2026-00001",
      submittedAt: "2026-10-18T19:35:00+07:00",
    });
    expect(sent[0].body).not.toContain("0912344828");
  });

  it("keeps the 'Khác' text in the Sheet and in the payload", () => {
    const { context, sent } = loadScript({ data, now: NOW, respond: erpAccepts });
    context.processForm({ buoiHoc: "Other", buoiHocKhac: "Lớp cô Hương", hoTen: "CHUA_CO_TEN", hoTenManual: "Trần Thị Mai", linkBaiThi: "x", namSinh: "2015", files: [] });

    expect(data.rows[2][9]).toBe("Khác: Lớp cô Hương");
    expect(JSON.parse(sent[0].body ?? "{}")).toMatchObject({ classOption: "Khác", classOptionOther: "Lớp cô Hương", fullName: "Trần Thị Mai", studentCode: null });
  });

  // Value: protects=question 6 "Khác" (restored from the original form) keeps the typed text in column N, which stays Sheet-only; fails_when=N falls back to the old bare "Other" or the text leaks into the ERP payload; why_new=the phase 1 form had dropped the option; seam=none; no_claim=the HTML radio rendering (FormHocSinh.html has no DOM test)
  it("writes question 6 'Khác' with the typed text in column N and keeps it out of the ERP payload", () => {
    const { context, sent } = loadScript({ data, now: NOW, respond: erpAccepts });
    context.processForm({ buoiHoc: "Con không rõ", hocThuAnh: "Other", hocThuAnhKhac: " Để con hỏi bố mẹ ", hoTen: "CHUA_CO_TEN", hoTenManual: "Trần Thị Mai", linkBaiThi: "x", namSinh: "2015", files: [] });
    context.processForm({ buoiHoc: "Con không rõ", hocThuAnh: "Có ạ! Con cảm ơn thầy", hoTen: "CHUA_CO_TEN", hoTenManual: "Lê Hoa", linkBaiThi: "y", namSinh: "2015", files: [] });

    expect(data.rows[2][13]).toBe("Khác: Để con hỏi bố mẹ");
    expect(data.rows[3][13]).toBe("Có ạ! Con cảm ơn thầy");
    expect(sent[0].body).not.toContain("Để con hỏi bố mẹ");
  });

  it("still accepts the submission when the ERP is down, and the trigger resends only unsent new rows", () => {
    let erpUp = false;
    const { cache, context, sent } = loadScript({ data, now: NOW, respond: (request) => (erpUp ? erpAccepts(request) : { body: { ok: false }, status: 503 }) });

    expect(context.processForm({ buoiHoc: "B - Cơ bản - Thầy Vinh", hoTen: "IDX:0", hoTenDayDu: "Lê Văn An", linkBaiThi: "0,5", namSinh: "2014", files: [] })).toBe("OK");
    expect(String(data.rows[2][20])).toMatch(/^Lỗi 503/);

    erpUp = true;
    context.resendPendingSubmissions();
    expect(sent).toHaveLength(2);
    expect(JSON.parse(sent[1].body ?? "{}")).toMatchObject({ answerText: "0,5", classOption: "B - Cơ bản - Thầy Vinh", fullName: "Lê Văn An", submittedAt: "2026-10-18T19:35:00+07:00" });
    expect(String(data.rows[2][20])).toMatch(/^OK/);

    // Nothing left: the old row has no submission id, the new one is OK.
    cache.clear();
    context.resendPendingSubmissions();
    expect(sent).toHaveLength(2);
  });

  it("resends newest rows first and ignores calls made right after a run (form visitors can call it)", () => {
    let erpUp = false;
    const { cache, context, sent } = loadScript({ data, now: NOW, respond: (request) => (erpUp ? erpAccepts(request) : { body: { ok: false }, status: 503 }) });
    context.processForm({ buoiHoc: "Con không rõ", hoTen: "CHUA_CO_TEN", hoTenManual: "Học sinh Một", linkBaiThi: "a", namSinh: "2015", files: [] });
    context.processForm({ buoiHoc: "Con không rõ", hoTen: "CHUA_CO_TEN", hoTenManual: "Học sinh Hai", linkBaiThi: "b", namSinh: "2015", files: [] });

    erpUp = true;
    context.resendPendingSubmissions();
    expect(sent.slice(2).map((request) => JSON.parse(request.body ?? "{}").fullName)).toEqual(["Học sinh Hai", "Học sinh Một"]);

    erpUp = false;
    data.rows[2][20] = "Lỗi 503";
    context.resendPendingSubmissions();
    expect(sent).toHaveLength(4);
    cache.clear();
    context.resendPendingSubmissions();
    expect(sent).toHaveLength(5);
  });

  it("adds columns when the Data tab is full, and keeps typed text from turning into formulas or dates", () => {
    const full = new FakeSheet([OLD_HEADERS], 16);
    const { context, sent } = loadScript({ data: full, now: NOW, respond: erpAccepts });
    expect(
      context.processForm({ buoiHoc: "Con không rõ", hoTen: "CHUA_CO_TEN", hoTenManual: "=IMPORTXML(1)", linkBaiThi: "15/4", namSinh: "2015", files: [] }),
    ).toBe("OK");

    expect(full.maxColumns).toBe(21);
    expect(full.rows[1].slice(0, 3)).toEqual(["'=IMPORTXML(1)", "", "'15/4"]);
    expect(JSON.parse(sent[0].body ?? "{}")).toMatchObject({ answerText: "15/4", fullName: "=IMPORTXML(1)" });
  });

  it("still saves the row like the old form when the ERP columns cannot be added", () => {
    const broken = new FakeSheet([OLD_HEADERS], 16);
    broken.insertColumnsAfter = () => {
      throw new Error("protected range");
    };
    const { context, sent } = loadScript({ data: broken, now: NOW, respond: erpAccepts });
    expect(context.processForm({ buoiHoc: "Con không rõ", hoTen: "CHUA_CO_TEN", hoTenManual: "Học sinh Ba", linkBaiThi: "c", namSinh: "2015", files: [] })).toBe("OK");
    expect(broken.rows).toHaveLength(2);
    expect(broken.rows[1][0]).toBe("Học sinh Ba");
    expect(sent).toHaveLength(0);
  });

  it("marks a payload the ERP rejects as final instead of resending it forever", () => {
    const { context, sent } = loadScript({ data, now: NOW, respond: () => ({ body: { ok: false }, status: 400 }) });
    context.processForm({ buoiHoc: "Con không rõ", hoTen: "CHUA_CO_TEN", hoTenManual: "Trần Thị Mai", linkBaiThi: "x", namSinh: "2015", files: [] });
    expect(String(data.rows[2][20])).toMatch(/^Bị từ chối 400/);

    context.resendPendingSubmissions();
    expect(sent).toHaveLength(1);
  });

  it("signs roster requests the ERP accepts and falls back to the DanhSachHocSinh tab when the ERP fails", () => {
    const up = loadScript({ data, now: NOW, respond: erpAccepts });
    expect(up.context.getBirthYears()).toEqual([2014]);
    // Vietnamese names and the "–" in session labels survive the trip (UTF-8 read, not Latin-1).
    expect(up.context.getStudentsByBirthYear("2014")).toMatchObject({
      source: "erp",
      students: [{ code: "TV-2026-00001", fullName: "Nguyễn Minh Anh", sessions: [{ id: SESSION_ID, label: "7CLC1 · 18:00–19:30" }] }],
    });

    const down = loadScript({ data, now: NOW, respond: () => ({ body: {}, status: 500 }) });
    expect(down.context.getStudentsByBirthYear(2014)).toEqual({
      source: "sheet",
      students: [{ code: "", fullName: "Lê Văn An", givenName: "An", label: "Lê Văn An", sessions: [] }],
    });
    expect(down.context.getBirthYears()).toContain(2008);
  });
});
