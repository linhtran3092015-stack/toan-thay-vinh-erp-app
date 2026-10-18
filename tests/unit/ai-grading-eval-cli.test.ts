// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import writeExcelFile from "write-excel-file/node";

const CLI = fileURLToPath(new URL("../../scripts/ai-grading-eval.mjs", import.meta.url));
// No key and an unroutable base URL: nothing in this file may reach the Claude API.
const ENV = { ...process.env, ANTHROPIC_API_KEY: "", ANTHROPIC_AUTH_TOKEN: "", ANTHROPIC_BASE_URL: "http://127.0.0.1:9" };

function run(...args: string[]) {
  return execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: ENV });
}

// Both streams plus the exit code, for commands that are expected to fail.
function exec(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...ENV, ...env } });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const readJsonl = (path: string) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));

// Value: protects=the Phase 0 CLI flow end to end without the network (template → prepare → dry-run submit → report), the --confirm gate on paid commands, and that prepared data drops names; fails_when=submit or extract-keys calls the API without --confirm, prepare leaks a student name, the request file holds sampling parameters, or report cannot read collected results; why_new=scripts/ai-grading-eval.mjs had only its pure helpers tested; seam=child process + temp dir, results faked in the shape `collect` writes; no_claim=live Batch API behaviour or real Sheet headers
describe("AI grading eval CLI (offline)", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "ai-grading-eval-"));
    run("template", "--dir", dir);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("prepares the sample sheet without student names", () => {
    const out = run("prepare", "--dir", dir, "--input", join(dir, "raw", "mau-sheet.csv"));
    expect(out).toContain("giữ 3 bài");
    const prepared = readFileSync(join(dir, "prepared.jsonl"), "utf8");
    expect(prepared.trim().split("\n")).toHaveLength(3);
    expect(prepared).not.toContain("Học Sinh Mẫu");
  });

  it("only estimates paid commands until --confirm is given", () => {
    const submit = run("submit", "--dir", dir);
    expect(submit).toContain("Chưa gửi. Thêm --confirm");
    const requestsFile = readdirSync(join(dir, "batches")).find((name) => name.startsWith("requests-"));
    expect(requestsFile).toBeDefined();
    const requests = readJsonl(join(dir, "batches", requestsFile as string));
    expect(requests).toHaveLength(5 * 2 * 3);
    for (const request of requests) {
      expect(request.custom_id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
      expect(request.params).not.toHaveProperty("temperature");
    }
    expect(readdirSync(join(dir, "batches")).filter((name) => name.startsWith("msgbatch"))).toEqual([]);
    expect(run("extract-keys", "--dir", dir)).toContain("Không có đề nào cần đọc");
  });

  it("reports accuracy and writes mismatches from collected results", () => {
    const requestsFile = readdirSync(join(dir, "batches")).find((name) => name.startsWith("requests-")) as string;
    const requests = readJsonl(join(dir, "batches", requestsFile));
    const results = requests.map((request) => ({
      custom_id: request.custom_id,
      status: "succeeded",
      model: request.params.model,
      stop_reason: "end_turn",
      text: JSON.stringify({
        questions: ["1", "2", "3"].map((label) => ({
          label,
          extracted_final_answer: "",
          verdict: "correct",
          error_location: "",
          reason_for_teacher: "",
          note_for_parent: "",
        })),
        flags: [],
        confidence: "high",
      }),
      usage: { input_tokens: 1500, output_tokens: 2500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    }));
    writeFileSync(join(dir, "results", "msgbatch_test.jsonl"), results.map((r) => JSON.stringify(r)).join("\n") + "\n");
    writeFileSync(
      join(dir, "batches", "msgbatch_test.json"),
      JSON.stringify({ id: "msgbatch_test", created_at: "2026-10-17T00:00:00Z", custom_ids: results.map((r) => r.custom_id), collected_at: "2026-10-17T01:00:00Z" }),
    );

    const out = run("report", "--dir", dir);
    expect(out).toContain("haiku-medium ×2 + sonnet-high trọng tài");
    const report = readFileSync(join(dir, "report.md"), "utf8");
    expect(report).toContain("| haiku-low | 3 |");
    // Every run says "all correct": only the sample student the TA gave 10 matches.
    const mismatches = readFileSync(join(dir, "mismatches.csv"), "utf8").replace(/^﻿/, "").trim().split("\r\n");
    expect(mismatches[0]).toContain("diem_tro_giang");
    expect(mismatches.length - 1).toBe(11 * 2);
  });

  it("prints help and fails on an unknown command", () => {
    const result = spawnSync(process.execPath, [CLI, "nope"], { encoding: "utf8", env: ENV });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Cách dùng");
  });
});

// A 1x1 PNG: enough for the CLI to treat a folder as a photographed test.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const SLOW = { timeout: 60_000 };

// Value: protects=extract-keys stops at the cost estimate until --confirm, skips tests that already have a draft, and skips HEIC photos; fails_when=the gate is removed (Opus call), --force or the draft skip stops working, or HEIC is sent on; why_new=the earlier test only reached the no-photos return; seam=child process on a temp dir with an unroutable API URL; no_claim=the Opus call or draft contents
describe("AI grading eval CLI: extract-keys gate", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "ai-grading-eval-keys-"));
    exec(["template", "--dir", dir]);
    mkdirSync(join(dir, "tests", "de-1"), { recursive: true });
    writeFileSync(join(dir, "tests", "de-1", "trang-1.png"), PNG_1X1);
    writeFileSync(join(dir, "tests", "de-1", "trang-2.png"), PNG_1X1);
    mkdirSync(join(dir, "tests", "de-2"), { recursive: true });
    writeFileSync(join(dir, "tests", "de-2", "trang-1.heic"), "not really a photo");
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("prints an estimate without calling the API, honours drafts and --force, and rejects HEIC", SLOW, () => {
    const draftPath = join(dir, "keys", "de-1.draft.json");

    const dry = exec(["extract-keys", "--dir", dir, "--tests", "de-1"]);
    expect(dry.status).toBe(0);
    expect(dry.stdout).toMatch(/de-1\s+2\s/);
    expect(dry.stdout).toContain("Chưa gọi API");
    expect(existsSync(draftPath)).toBe(false);

    writeFileSync(draftPath, "{}");
    const skipped = exec(["extract-keys", "--dir", dir, "--tests", "de-1"]);
    expect(skipped.stdout).toContain("Bỏ qua de-1: đã có bản nháp");
    expect(skipped.stdout).toContain("Không có đề nào cần đọc");
    expect(readFileSync(draftPath, "utf8")).toBe("{}");

    const forced = exec(["extract-keys", "--dir", dir, "--tests", "de-1", "--force"]);
    expect(forced.stdout).toContain("Chưa gọi API");
    expect(readFileSync(draftPath, "utf8")).toBe("{}");

    const heic = exec(["extract-keys", "--dir", dir, "--tests", "de-2"]);
    expect(heic.status).toBe(0);
    expect(heic.stderr).toContain("HEIC");
    expect(heic.stdout).toContain("Không có đề nào cần đọc");
  });
});

// Value: protects=submit never re-sends requests a batch already holds (no double spend) and obeys --limit/--configs/--runs; collect never re-downloads a collected batch; fails_when=sent ids are ignored, a flag stops narrowing the run, or a collected batch is fetched again; why_new=earlier tests only ran a first dry run; seam=child process, manifests written as submit --confirm would; no_claim=batches.create itself
describe("AI grading eval CLI: batch bookkeeping", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "ai-grading-eval-batches-"));
    exec(["template", "--dir", dir]);
    exec(["prepare", "--dir", dir, "--input", join(dir, "raw", "mau-sheet.csv")]);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const requestFiles = () => readdirSync(join(dir, "batches")).filter((name) => name.startsWith("requests-"));
  const writeManifest = (customIds: string[], collectedAt: string | null) =>
    writeFileSync(
      join(dir, "batches", "msgbatch_sent.json"),
      JSON.stringify({ id: "msgbatch_sent", created_at: "2026-10-17T00:00:00Z", custom_ids: customIds, collected_at: collectedAt }),
    );

  it("skips ids already sent, narrows with flags, and ignores collected batches", SLOW, () => {
    expect(exec(["submit", "--dir", dir]).stdout).toContain("Tổng: 30 lượt cho 3 bài");
    const all = readJsonl(join(dir, "batches", requestFiles()[0])).map((r) => r.custom_id as string);
    expect(all).toHaveLength(30);

    writeManifest(all.filter((id) => id.startsWith("haiku-low_r1_")), null);
    expect(exec(["submit", "--dir", dir]).stdout).toContain("Tổng: 27 lượt cho 3 bài");

    writeManifest(all, "2026-10-17T01:00:00Z");
    const before = requestFiles();
    expect(exec(["submit", "--dir", dir]).stdout).toContain("Mọi yêu cầu đã gửi ở các batch trước");
    expect(requestFiles()).toEqual(before);

    const narrow = exec(["submit", "--dir", dir, "--force", "--limit", "1", "--configs", "haiku-medium", "--runs", "1"]);
    expect(narrow.stdout).toContain("Tổng: 1 lượt cho 1 bài");
    const added = requestFiles().filter((name) => !before.includes(name));
    expect(added).toHaveLength(1);
    const narrowed = readJsonl(join(dir, "batches", added[0]));
    expect(narrowed).toHaveLength(1);
    expect(narrowed[0].custom_id).toMatch(/^haiku-medium_r1_sub_/);

    // collected_at is set, so collect has nothing to fetch and must not reach the API.
    const collect = exec(["collect", "--dir", dir]);
    expect(collect.status).toBe(0);
    expect(collect.stdout).toContain("Không có batch nào chờ tải");
  });
});

// Value: protects=bad flags, missing files and unusable input stop with exit 1 and a readable Vietnamese message, before any paid call; fails_when=--runs or --configs is not validated, a stray argument is ignored, or an error escapes as a stack trace; why_new=only the unknown-command exit was tested; seam=child process on a temp dir; no_claim=the wording of every message
describe("AI grading eval CLI: misuse", () => {
  let dir: string;
  let csv: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "ai-grading-eval-misuse-"));
    exec(["template", "--dir", dir]);
    csv = join(dir, "raw", "mau-sheet.csv");
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails with exit 1 and a clear message", SLOW, () => {
    const dirFlag = ["--dir", dir];
    const cases: Array<[string[], string]> = [
      [["submit", ...dirFlag], "Chưa có prepared.jsonl"],
      [["report", ...dirFlag], "Chưa có prepared.jsonl"],
      [["prepare", ...dirFlag], "Cần --input"],
      [["prepare", ...dirFlag, "--input"], "Thiếu giá trị cho --input"],
      [["prepare", ...dirFlag, "--input", join(dir, "raw", "bai.pdf")], "Chỉ đọc .xlsx, .csv, .tsv"],
      [["prepare", ...dirFlag, "--input", csv, "--score-includes-bonus", "maybe"], "chỉ nhận yes hoặc no"],
      [["prepare", ...dirFlag, "--input", csv, "--col", "answer"], "--col cần dạng"],
      [["prepare", ...dirFlag, "--input", csv, "--col", "answer=Cột không có"], 'Không thấy cột "Cột không có"'],
      [["submit", ...dirFlag, "stray"], "Tham số lạ: stray"],
    ];
    for (const [args, message] of cases) {
      const result = exec(args);
      expect({ args, status: result.status, stderr: result.stderr }).toEqual({
        args,
        status: 1,
        stderr: expect.stringContaining(message),
      });
      expect(result.stderr).not.toMatch(/\n\s+at /);
    }

    // Preconditions now exist; the spend-related flags and the empty-results case still fail early.
    expect(exec(["prepare", ...dirFlag, "--input", csv]).status).toBe(0);
    const later: Array<[string[], string]> = [
      [["submit", ...dirFlag, "--runs", "9"], "--runs từ 1 đến 5"],
      [["submit", ...dirFlag, "--runs", "abc"], "--runs từ 1 đến 5"],
      [["submit", ...dirFlag, "--configs", "haiku-medium,nope"], "Cấu hình lạ: nope"],
      [["report", ...dirFlag], "Chưa có kết quả"],
    ];
    for (const [args, message] of later) {
      const result = exec(args);
      expect({ args, status: result.status, stderr: result.stderr }).toEqual({
        args,
        status: 1,
        stderr: expect.stringContaining(message),
      });
    }
    expect(readdirSync(join(dir, "batches")).filter((name) => name.startsWith("requests-"))).toEqual([]);
  });
});

// Value: protects=prepare reads a real .xlsx (read-excel-file sheet list, Date cells as wall-clock dates, numeric score cells, --sheet) and scrubs names; fails_when=the reader's result shape changes, a date shifts by a day in another time zone, --sheet is ignored, or a name survives; why_new=only CSV input was tested; seam=xlsx written by write-excel-file, CLI as child process; no_claim=Google Sheets header wording
describe("AI grading eval CLI: xlsx input", () => {
  let dir: string;
  let xlsx: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "ai-grading-eval-xlsx-"));
    xlsx = join(dir, "sheet.xlsx");
    const when = { type: Date, format: "dd/mm/yyyy hh:mm:ss" } as const;
    await writeExcelFile([
      {
        sheet: "Bai nop",
        data: [
          ["Dấu thời gian", "Bài làm", "Họ và tên", "Lớp hôm nay", "Điểm", "Tích cực tương tác"],
          [{ value: new Date(Date.UTC(2026, 9, 15, 23, 30, 5)), ...when }, "Nguyễn Minh Anh: x = 3", "Nguyễn Minh Anh", "CLC1", 7.5, "x"],
          [{ value: new Date(Date.UTC(2026, 9, 15, 20, 41, 5)), ...when }, "x = 4", "Lê Hoa", "CLC1", "8", ""],
        ],
      },
      { sheet: "Phu", data: [["Ghi chú"], ["không phải bài làm"]] },
    ]).toFile(xlsx);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads the first sheet by default, picks another with --sheet, and keeps dates and scores", SLOW, () => {
    // A zone far from UTC: any local-time conversion of the date cells would move the 23:30 row.
    const out = exec(["prepare", "--dir", dir, "--input", xlsx], { TZ: "Pacific/Kiritimati" });
    expect(out.status).toBe(0);
    const rows = readJsonl(join(dir, "prepared.jsonl"));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.test_id)).toEqual(["2026-10-15_clc1", "2026-10-15_clc1"]);
    expect(rows.map((r) => r.submitted_on)).toEqual(["2026-10-15", "2026-10-15"]);
    expect(rows.map((r) => r.ta_score).sort()).toEqual([7.5, 8]);
    expect(rows.find((r) => r.ta_score === 7.5)).toMatchObject({ answer_text: "[TÊN]: x = 3", bonus: true });
    expect(readFileSync(join(dir, "prepared.jsonl"), "utf8")).not.toMatch(/Nguyễn|Minh Anh|Lê Hoa/);

    const decoy = exec(["prepare", "--dir", dir, "--input", xlsx, "--sheet", "Phu"]);
    expect(decoy.status).toBe(1);
    expect(decoy.stderr).toContain("Không thấy cột bài làm");
    const missing = exec(["prepare", "--dir", dir, "--input", xlsx, "--sheet", "Nope"]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('Không thấy sheet "Nope". Có: Bai nop, Phu');
  });
});
