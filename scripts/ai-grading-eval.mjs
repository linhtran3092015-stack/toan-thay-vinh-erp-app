#!/usr/bin/env node
// Phase 0 of the AI grading plan (docs/AI_GRADING_INTEGRATION_PLAN_2026-10-16.md §6):
// measure how well Claude grades real end-of-session tests against the teaching
// assistants' scores before any of it is built into the ERP.
//
//   node scripts/ai-grading-eval.mjs template                    sample data + folder layout
//   node scripts/ai-grading-eval.mjs prepare --input sheet.xlsx  offline: keep answer + score only
//   node scripts/ai-grading-eval.mjs extract-keys [--confirm]    Opus 5.5 drafts answer keys from photos
//   node scripts/ai-grading-eval.mjs submit [--confirm]          Batch API: every config × 2 runs
//   node scripts/ai-grading-eval.mjs collect [--wait]            download batch results
//   node scripts/ai-grading-eval.mjs report                      accuracy, agreement, cost, mismatches.csv
//
// Everything lives under --dir (default .ai-grading-eval/, git-ignored). Commands that
// spend money print an estimate and stop unless --confirm is passed. Student names and
// phone numbers never leave `prepare`.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import readXlsxFile from "read-excel-file/node";

import * as lib from "./ai-grading-eval/lib.mjs";

const IMAGE_TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" };
const MAX_IMAGE_EDGE = 2576;
const MAX_IMAGE_TOKENS = 4800;
const KEY_OUTPUT_TOKEN_GUESS = 12000;
const MAX_BATCH_REQUESTS = 10000;
const BOOLEAN_FLAGS = new Set(["confirm", "force", "wait", "help"]);

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  const columns = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith("--")) throw new Error(`Tham số lạ: ${arg}`);
    const eq = arg.indexOf("=");
    const name = eq > 0 ? arg.slice(2, eq) : arg.slice(2);
    let value = eq > 0 ? arg.slice(eq + 1) : undefined;
    if (value === undefined && !BOOLEAN_FLAGS.has(name)) {
      value = rest[i + 1];
      i += 1;
      if (value === undefined) throw new Error(`Thiếu giá trị cho --${name}`);
    }
    if (name === "col") {
      const split = value.indexOf("=");
      if (split <= 0) throw new Error('--col cần dạng field="Tên cột", ví dụ --col answer="Bài làm"');
      columns[value.slice(0, split)] = value.slice(split + 1);
    } else {
      flags[name] = value ?? true;
    }
  }
  return { command, flags, columns };
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const readJsonl = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
const writeJsonl = (path, rows) => writeFileSync(path, rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
const usd = (value) => `$${value.toFixed(value < 1 ? 4 : 2)}`;
const pct = (value) => `${(value * 100).toFixed(1).replace(".", ",")}%`;
const naturalSort = (a, b) => a.localeCompare(b, "en", { numeric: true });
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function paths(dir) {
  return {
    dir,
    raw: join(dir, "raw"),
    tests: join(dir, "tests"),
    keys: join(dir, "keys"),
    batches: join(dir, "batches"),
    results: join(dir, "results"),
    prepared: join(dir, "prepared.jsonl"),
    prepareStats: join(dir, "prepare-stats.json"),
    salt: join(dir, ".salt"),
    aliases: join(dir, "tests", "aliases.json"),
    report: join(dir, "report.md"),
    mismatches: join(dir, "mismatches.csv"),
  };
}

function ensureDirs(p) {
  for (const dir of [p.dir, p.raw, p.tests, p.keys, p.batches, p.results]) mkdirSync(dir, { recursive: true });
}

function printTable(headers, rows) {
  const widths = headers.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i]).length)));
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join("  ");
  console.log(line(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) console.log(line(row));
}

function describeApiError(error) {
  if (error instanceof Anthropic.AuthenticationError) return "Khóa API sai hoặc chưa đặt ANTHROPIC_API_KEY.";
  if (error instanceof Anthropic.PermissionDeniedError) return `Khóa API không có quyền: ${error.message}`;
  if (error instanceof Anthropic.RateLimitError) return `Vượt hạn mức hoặc chạm trần chi tiêu (429): ${error.message}`;
  if (error instanceof Anthropic.BadRequestError) return `API từ chối yêu cầu (400), ví dụ hết tín dụng hoặc chạm trần workspace: ${error.message}`;
  if (error instanceof Anthropic.APIConnectionError) return `Không kết nối được API: ${error.message}`;
  if (error instanceof Anthropic.APIError) return `Lỗi API ${error.status}: ${error.message}`;
  return null;
}

function createClient() {
  return new Anthropic({ maxRetries: 3 });
}

// ---------------------------------------------------------------------------
// template
// ---------------------------------------------------------------------------

const SAMPLE_KEY = {
  test_id: "mau-1",
  title: "Bài kiểm tra sự tiến bộ (mẫu)",
  confirmed: true,
  version: 1,
  questions: [
    {
      label: "1",
      prompt_text: "Tính 3/4 + 1/4.",
      max_points: 2,
      final_answer: "1",
      accepted_equivalents: ["4/4", "1,0"],
      solution_steps: ["3/4 + 1/4 = (3 + 1)/4 = 4/4 = 1."],
    },
    {
      label: "2",
      prompt_text: "Giải phương trình 2x + 6 = 0.",
      max_points: 3,
      final_answer: "x = -3",
      accepted_equivalents: ["-3", "x=-3"],
      solution_steps: ["2x + 6 = 0", "2x = -6", "x = -3."],
    },
    {
      label: "3",
      prompt_text: "Tìm x biết x² = 9.",
      max_points: 5,
      final_answer: "x = 3 hoặc x = -3",
      accepted_equivalents: ["x = ±3", "x ∈ {3; -3}", "3 và -3"],
      solution_steps: ["x² = 9 nên x = 3 hoặc x = -3 (vì 3² = (-3)² = 9)."],
    },
  ],
};

const SAMPLE_ROWS = [
  ["Dấu thời gian", "Bài làm", "Năm sinh", "Họ và tên", "Tên", "Lớp hôm nay", "Mã đề", "Điểm", "Tích cực tương tác"],
  ["15/10/2026 20:41:05", "Câu 1: 3/4+1/4 = 1\nCâu 2: x = -3\nCâu 3: x = 3", "2013", "Học Sinh Mẫu Một", "Một", "CLC1", "mau-1", "5", ""],
  ["15/10/2026 20:43:10", "1) 1\n2) 2x=-6 => x=-3\n3) x=3 hoặc x=-3", "2013", "Học Sinh Mẫu Hai", "Hai", "CLC1", "mau-1", "10", "x"],
  ["15/10/2026 20:44:00", "câu 1 = 4/4\ncâu 2 x = 3\ncâu 3 x = ±3", "2012", "Học Sinh Mẫu Ba", "Ba", "B – Cơ bản", "mau-1", "7", ""],
];

const README = `Thư mục dữ liệu Giai đoạn 0 (chấm bài AI). KHÔNG đưa thư mục này lên git.

1. Xuất Sheet nhận bài (kèm cột điểm trợ giảng) ra .xlsx hoặc .csv, để vào raw/.
   Cột cần có: bài làm, điểm. Nên có: dấu thời gian, họ tên, năm sinh, lớp hôm nay,
   cột "Tích cực tương tác" (x = được cộng 1), hoặc cột "Mã đề".
2. node scripts/ai-grading-eval.mjs prepare --input raw/<file> [--score-includes-bonus yes|no]
   Chạy offline: chỉ giữ bài làm + điểm, bỏ tên/SĐT. Kết quả: prepared.jsonl.
   Mã đề tự đặt theo ngày + năm sinh (ví dụ 2026-10-08_sinh-2014, tức đề lớp 7 ngày 08/10) nếu không có
   cột "Mã đề"; không có cột năm sinh thì theo ngày + lớp hôm nay. Bài ghi "Đã làm trên lớp" hoặc
   "Chưa có dữ liệu bài làm" bị bỏ qua. Hai năm sinh làm chung một đề: ghi vào tests/aliases.json,
   ví dụ {"2026-10-08_sinh-2015": "2026-10-08_sinh-2014"}.
3. Ảnh đề: tests/<mã đề>/trang-1.jpg, trang-2.jpg ... (JPEG/PNG/WebP/GIF; HEIC phải đổi sang JPEG).
4. node scripts/ai-grading-eval.mjs extract-keys            (xem ước tính chi phí)
   node scripts/ai-grading-eval.mjs extract-keys --confirm  (Opus 5.5 viết keys/<mã đề>.draft.json)
5. Người kiểm tra từng bản nháp, sửa, rồi lưu thành keys/<mã đề>.json với "confirmed": true.
   Tổng max_points phải bằng 10. Mỗi câu đúng trọn điểm hoặc sai. Xem mẫu: keys/mau-1.json.
6. node scripts/ai-grading-eval.mjs submit            (ước tính)  → submit --confirm (gửi Batch API)
   Thử ít trước: submit --limit 20 --configs haiku-medium --confirm
7. node scripts/ai-grading-eval.mjs collect --wait   (thường xong trong 1 giờ, tối đa 24 giờ)
8. node scripts/ai-grading-eval.mjs report           → report.md + mismatches.csv
   Rà tay mọi bài lệch trong mismatches.csv: có khi trợ giảng chấm sai.
`;

function cmdTemplate(p) {
  ensureDirs(p);
  mkdirSync(join(p.tests, "mau-1"), { recursive: true });
  const files = [
    [join(p.dir, "README.txt"), README],
    [join(p.raw, "mau-sheet.csv"), `﻿${lib.toCsv(SAMPLE_ROWS)}\r\n`],
    [join(p.keys, "mau-1.json"), `${JSON.stringify(SAMPLE_KEY, null, 2)}\n`],
    [p.aliases, "{}\n"],
    [join(p.tests, "mau-1", "README.txt"), "Đặt ảnh đề vào đây: trang-1.jpg, trang-2.jpg ...\n"],
  ];
  for (const [path, content] of files) {
    if (existsSync(path)) {
      console.log(`Giữ nguyên ${path}`);
    } else {
      writeFileSync(path, content);
      console.log(`Đã tạo ${path}`);
    }
  }
  console.log(`\nThử ngay: node scripts/ai-grading-eval.mjs prepare --dir ${p.dir} --input ${join(p.raw, "mau-sheet.csv")}`);
}

// ---------------------------------------------------------------------------
// prepare (offline)
// ---------------------------------------------------------------------------

async function readRows(input, flags) {
  const ext = extname(input).toLowerCase();
  if (ext === ".xlsx") {
    const sheets = await readXlsxFile(input);
    const sheet = flags.sheet ? sheets.find((s) => s.sheet === flags.sheet) : sheets[0];
    if (!sheet) throw new Error(`Không thấy sheet "${flags.sheet}". Có: ${sheets.map((s) => s.sheet).join(", ")}`);
    return sheet.data;
  }
  if ([".csv", ".tsv", ".txt"].includes(ext)) {
    const delimiter = flags.delimiter === "tab" ? "\t" : flags.delimiter;
    return lib.parseCsv(readFileSync(input, "utf8"), delimiter);
  }
  throw new Error(`Chỉ đọc .xlsx, .csv, .tsv (nhận ${ext || "file không có đuôi"}).`);
}

async function cmdPrepare(p, flags, columns) {
  if (!flags.input || flags.input === true) throw new Error("Cần --input <file .xlsx/.csv>");
  ensureDirs(p);
  if (!existsSync(p.salt)) writeFileSync(p.salt, randomBytes(16).toString("hex"));
  const includesBonus = String(flags["score-includes-bonus"] ?? "yes").toLowerCase();
  if (!["yes", "no"].includes(includesBonus)) throw new Error("--score-includes-bonus chỉ nhận yes hoặc no");
  const rows = await readRows(resolve(flags.input), flags);
  const { submissions, stats } = lib.prepareRows(rows, {
    salt: readFileSync(p.salt, "utf8").trim(),
    overrides: columns,
    aliases: existsSync(p.aliases) ? readJson(p.aliases) : {},
    dateOrder: flags["date-order"] === "mdy" ? "mdy" : "dmy",
  });
  writeJsonl(p.prepared, submissions);
  writeJson(p.prepareStats, {
    ...stats,
    input: basename(flags.input),
    score_includes_bonus: includesBonus === "yes",
    prepared_at: new Date().toISOString(),
  });
  console.log("Cột đã nhận:", stats.columns);
  console.log(`Dòng: ${stats.rows} → giữ ${stats.kept} bài.`, "Bỏ:", stats.dropped);
  console.log(`Bài có thay tên/SĐT trong bài làm: ${stats.scrubbed_rows}`);
  printTable(
    ["Mã đề", "Bài", "Ảnh đề", "Đáp án"],
    Object.entries(stats.per_test).map(([testId, count]) => [
      testId,
      count,
      listImages(p, testId).length || "chưa có",
      existsSync(join(p.keys, `${testId}.json`)) ? "đã chốt" : existsSync(join(p.keys, `${testId}.draft.json`)) ? "nháp" : "chưa có",
    ]),
  );
  console.log(`\nĐã ghi ${p.prepared} (không có tên, năm sinh, SĐT).`);
}

// ---------------------------------------------------------------------------
// extract-keys
// ---------------------------------------------------------------------------

function listImages(p, testId) {
  const dir = join(p.tests, testId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => [...Object.keys(IMAGE_TYPES), ".heic", ".heif"].includes(extname(name).toLowerCase()))
    .sort(naturalSort)
    .map((name) => join(dir, name));
}

let sharpModule;
async function loadSharp() {
  if (sharpModule === undefined) {
    try {
      sharpModule = (await import("sharp")).default;
    } catch {
      sharpModule = null;
    }
  }
  return sharpModule;
}

/** Long edge ≤ 2576 px, JPEG quality 0.9 (plan §4.4). Without sharp, send as-is if ≤ 5 MB. */
async function loadPage(path) {
  const ext = extname(path).toLowerCase();
  if (ext === ".heic" || ext === ".heif") throw new Error(`${basename(path)}: ảnh HEIC chưa đọc được, đổi sang JPEG.`);
  const buffer = readFileSync(path);
  const sharp = await loadSharp();
  if (sharp) {
    const { data, info } = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    return { mediaType: "image/jpeg", base64: data.toString("base64"), tokens: Math.min(MAX_IMAGE_TOKENS, Math.ceil((info.width * info.height) / 750)) };
  }
  if (buffer.length > 5 * 1024 * 1024) throw new Error(`${basename(path)} lớn hơn 5 MB: thu nhỏ ảnh trước.`);
  return { mediaType: IMAGE_TYPES[ext], base64: buffer.toString("base64"), tokens: MAX_IMAGE_TOKENS };
}

async function cmdExtractKeys(p, flags) {
  ensureDirs(p);
  const wanted = typeof flags.tests === "string" ? new Set(flags.tests.split(",").map((s) => s.trim())) : null;
  const testIds = readdirSync(p.tests)
    .filter((name) => statSync(join(p.tests, name)).isDirectory())
    .filter((name) => (wanted ? wanted.has(name) : true))
    .sort(naturalSort);
  const jobs = [];
  for (const testId of testIds) {
    const images = listImages(p, testId);
    if (images.length === 0) continue;
    if (existsSync(join(p.keys, `${testId}.draft.json`)) && !flags.force) {
      console.log(`Bỏ qua ${testId}: đã có bản nháp (dùng --force để đọc lại).`);
      continue;
    }
    try {
      jobs.push({ testId, images, pages: await Promise.all(images.map(loadPage)) });
    } catch (error) {
      console.error(`Bỏ qua ${testId}: ${error.message}`);
    }
  }
  if (jobs.length === 0) return console.log("Không có đề nào cần đọc. Đặt ảnh vào tests/<mã đề>/.");
  if (!(await loadSharp())) console.log("Không có sharp: ảnh gửi nguyên bản, không thu nhỏ.");

  const rows = jobs.map((job) => {
    const input = job.pages.reduce((sum, page) => sum + page.tokens, 0) + 1500;
    const cost = lib.costUsd({ input_tokens: input, output_tokens: KEY_OUTPUT_TOKEN_GUESS }, lib.MODELS.opus, { batch: false });
    return { job, input, cost };
  });
  printTable(
    ["Mã đề", "Trang", "Token vào ~", "Token ra ~", "USD ~"],
    rows.map(({ job, input, cost }) => [job.testId, job.pages.length, input, KEY_OUTPUT_TOKEN_GUESS, usd(cost)]),
  );
  console.log(`Tổng ước tính: ${usd(rows.reduce((sum, r) => sum + r.cost, 0))} (${lib.MODELS.opus}, effort high, giá thường).`);
  if (!flags.confirm) return console.log("\nChưa gọi API. Thêm --confirm để chạy.");

  const client = createClient();
  const concurrency = Math.max(1, Number(flags.concurrency ?? 2));
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) await extractOne(client, p, job);
    }),
  );
}

async function extractOne(client, p, job) {
  const started = Date.now();
  try {
    const message = await client.beta.messages.stream(lib.buildKeyExtractionParams({ pages: job.pages })).finalMessage();
    if (message.stop_reason !== "end_turn") {
      console.error(`${job.testId}: không dùng được kết quả (stop_reason = ${message.stop_reason}).`);
      return;
    }
    const data = JSON.parse(message.content.map((block) => (block.type === "text" ? block.text : "")).join(""));
    const fallbackUsed = (message.usage.iterations ?? []).some((entry) => entry.type === "fallback_message");
    const draft = {
      test_id: job.testId,
      title: data.title,
      confirmed: false,
      version: 1,
      questions: data.questions,
      total_points_printed: data.total_points_printed,
      transcription_warnings: data.transcription_warnings,
      _meta: {
        requested_model: lib.MODELS.opus,
        served_by: message.model,
        fallback_used: fallbackUsed,
        prompt_version: lib.KEY_PROMPT_VERSION,
        message_id: message.id,
        pages: job.images.map((path) => basename(path)),
        usage: message.usage,
        cost_usd: lib.costUsd(message.usage, message.model, { batch: false }),
        seconds: Math.round((Date.now() - started) / 1000),
        created_at: new Date().toISOString(),
      },
    };
    writeJson(join(p.keys, `${job.testId}.draft.json`), draft);
    const total = data.questions.reduce((sum, q) => sum + (typeof q.max_points === "number" ? q.max_points : 0), 0);
    console.log(
      `${job.testId}: ${data.questions.length} câu, tổng điểm đọc được ${total}, ${data.transcription_warnings.length} cảnh báo, ` +
        `${usd(draft._meta.cost_usd)}${fallbackUsed ? `, đã chuyển sang ${message.model}` : ""}.`,
    );
  } catch (error) {
    console.error(`${job.testId}: ${describeApiError(error) ?? error.message}`);
  }
}

// ---------------------------------------------------------------------------
// submit
// ---------------------------------------------------------------------------

function loadConfirmedKeys(p) {
  const keys = new Map();
  if (!existsSync(p.keys)) return keys;
  for (const name of readdirSync(p.keys).sort(naturalSort)) {
    if (!name.endsWith(".json") || name.endsWith(".draft.json")) continue;
    const key = readJson(join(p.keys, name));
    const problems = lib.validateKey(key);
    if (problems.length > 0) {
      console.log(`Bỏ qua đáp án ${name}: ${problems.join(" ")}`);
      continue;
    }
    keys.set(key.test_id, key);
  }
  return keys;
}

function loadManifests(p) {
  if (!existsSync(p.batches)) return [];
  return readdirSync(p.batches)
    .filter((name) => name.startsWith("msgbatch") && name.endsWith(".json"))
    .map((name) => ({ path: join(p.batches, name), ...readJson(join(p.batches, name)) }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function selectConfigs(flags) {
  if (typeof flags.configs !== "string") return [...lib.GRADE_CONFIGS];
  return flags.configs.split(",").map((id) => {
    const config = lib.GRADE_CONFIGS.find((c) => c.id === id.trim());
    if (!config) throw new Error(`Cấu hình lạ: ${id}. Có: ${lib.GRADE_CONFIGS.map((c) => c.id).join(", ")}`);
    return config;
  });
}

async function cmdSubmit(p, flags) {
  if (!existsSync(p.prepared)) throw new Error("Chưa có prepared.jsonl. Chạy prepare trước.");
  const submissions = readJsonl(p.prepared);
  const keys = loadConfirmedKeys(p);
  const configs = selectConfigs(flags);
  const runs = Number(flags.runs ?? lib.DEFAULT_RUNS);
  if (!Number.isInteger(runs) || runs < 1 || runs > 5) throw new Error("--runs từ 1 đến 5");

  const withoutKey = {};
  for (const s of submissions) if (!keys.has(s.test_id)) withoutKey[s.test_id] = (withoutKey[s.test_id] ?? 0) + 1;
  if (Object.keys(withoutKey).length) console.log("Chưa có đáp án đã chốt, bỏ qua:", withoutKey);
  let usable = submissions.filter((s) => keys.has(s.test_id));
  if (flags.limit) usable = usable.slice(0, Number(flags.limit));
  if (usable.length === 0) throw new Error("Không có bài nào có đáp án đã chốt.");

  const alreadySent = new Set(flags.force ? [] : loadManifests(p).flatMap((m) => m.custom_ids));
  const requests = [];
  const estimates = new Map(configs.map((c) => [c.id, { calls: 0, input: 0, output: 0, usd: 0 }]));
  for (const config of configs) {
    for (let run = 1; run <= runs; run += 1) {
      for (const s of usable) {
        const id = lib.customId(config.id, run, s.submission_id);
        if (alreadySent.has(id)) continue;
        const key = keys.get(s.test_id);
        requests.push({ custom_id: id, params: lib.buildGradeParams({ config, key, answerText: s.answer_text }) });
        const estimate = lib.estimateGradeCall({ config, key, answerText: s.answer_text });
        const row = estimates.get(config.id);
        row.calls += 1;
        row.input += estimate.input;
        row.output += estimate.output;
        row.usd += estimate.usd;
      }
    }
  }
  if (requests.length === 0) return console.log("Mọi yêu cầu đã gửi ở các batch trước (dùng --force để gửi lại).");

  printTable(
    ["Cấu hình", "Model", "Effort", "Lượt", "Token vào ~", "Token ra ~", "USD ~ (Batch)"],
    configs.map((c) => {
      const e = estimates.get(c.id);
      return [c.id, c.model, c.effort, e.calls, e.input, e.output, usd(e.usd)];
    }),
  );
  const totalUsd = [...estimates.values()].reduce((sum, e) => sum + e.usd, 0);
  console.log(`Tổng: ${requests.length} lượt cho ${usable.length} bài, ước tính ${usd(totalUsd)} (chưa trừ cache; token ra là phỏng đoán).`);
  const requestsFile = join(p.batches, `requests-${stamp()}.jsonl`);
  writeJsonl(requestsFile, requests);
  console.log(`Đã ghi các yêu cầu vào ${requestsFile} để xem lại.`);
  if (!flags.confirm) return console.log("\nChưa gửi. Thêm --confirm để gửi qua Batch API.");

  const client = createClient();
  for (let start = 0; start < requests.length; start += MAX_BATCH_REQUESTS) {
    const chunk = requests.slice(start, start + MAX_BATCH_REQUESTS);
    const batch = await client.messages.batches.create({ requests: chunk });
    writeJson(join(p.batches, `${batch.id}.json`), {
      id: batch.id,
      created_at: batch.created_at,
      prompt_version: lib.PROMPT_VERSION,
      configs: configs.map((c) => c.id),
      runs,
      count: chunk.length,
      key_versions: Object.fromEntries([...keys].map(([testId, key]) => [testId, key.version ?? 1])),
      requests_file: basename(requestsFile),
      custom_ids: chunk.map((r) => r.custom_id),
      collected_at: null,
    });
    console.log(`Đã gửi batch ${batch.id} (${chunk.length} lượt).`);
  }
  console.log("Thường xong trong 1 giờ (tối đa 24 giờ). Sau đó: collect --wait");
}

// ---------------------------------------------------------------------------
// collect
// ---------------------------------------------------------------------------

async function cmdCollect(p, flags) {
  ensureDirs(p);
  const manifests = loadManifests(p).filter((m) =>
    typeof flags.batch === "string" ? m.id === flags.batch : flags.force || !m.collected_at,
  );
  if (manifests.length === 0) return console.log("Không có batch nào chờ tải.");
  const client = createClient();
  for (const manifest of manifests) {
    let batch = await client.messages.batches.retrieve(manifest.id);
    while (batch.processing_status !== "ended" && flags.wait) {
      console.log(`${manifest.id}: ${batch.processing_status}, đang chạy ${batch.request_counts.processing}…`);
      await sleep(60_000);
      batch = await client.messages.batches.retrieve(manifest.id);
    }
    if (batch.processing_status !== "ended") {
      console.log(`${manifest.id}: ${batch.processing_status} (${batch.request_counts.processing} lượt đang chạy). Thêm --wait để chờ.`);
      continue;
    }
    const lines = [];
    for await (const item of await client.messages.batches.results(manifest.id)) lines.push(lib.summarizeBatchResult(item));
    writeJsonl(join(p.results, `${manifest.id}.jsonl`), lines);
    const { path, ...rest } = manifest;
    writeJson(path, { ...rest, collected_at: new Date().toISOString(), request_counts: batch.request_counts });
    console.log(`${manifest.id}: đã tải ${lines.length} kết quả`, batch.request_counts);
  }
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

function loadResults(p) {
  const results = new Map();
  const ordered = loadManifests(p);
  const files = existsSync(p.results) ? readdirSync(p.results).filter((n) => n.endsWith(".jsonl")) : [];
  const rank = (name) => ordered.findIndex((m) => `${m.id}.jsonl` === name);
  for (const name of files.sort((a, b) => rank(a) - rank(b))) {
    for (const line of readJsonl(join(p.results, name))) results.set(line.custom_id, line); // later batches win
  }
  return results;
}

function verdictText(verdicts) {
  return verdicts ? Object.entries(verdicts).map(([label, v]) => `${label}:${v === "correct" ? "đúng" : v === "incorrect" ? "sai" : "trống"}`).join(" ") : "";
}

const COLOR_VI = { green: "xanh", yellow: "vàng", red: "đỏ" };

async function cmdReport(p) {
  if (!existsSync(p.prepared)) throw new Error("Chưa có prepared.jsonl.");
  const submissions = readJsonl(p.prepared);
  const stats = existsSync(p.prepareStats) ? readJson(p.prepareStats) : {};
  const scoreIncludesBonus = stats.score_includes_bonus !== false;
  const keys = loadConfirmedKeys(p);
  const results = loadResults(p);
  if (results.size === 0) throw new Error("Chưa có kết quả. Chạy submit --confirm rồi collect.");
  const present = new Set([...results.keys()].map((id) => lib.parseCustomId(id)?.configId));
  const configs = lib.GRADE_CONFIGS.filter((c) => present.has(c.id));
  const runs = Math.max(...[...results.keys()].map((id) => lib.parseCustomId(id)?.run ?? 1));
  const common = { submissions, keys, results, runs, scoreIncludesBonus };

  const evaluations = [];
  for (const config of configs) {
    const items = lib.scoreConfig({ ...common, configId: config.id });
    const cost = lib.configCost(results, config.id);
    evaluations.push({ name: config.id, kind: "single", items, summary: lib.summarizeItems(items), monthly: cost.perCall * 2 * runs * lib.MONTHLY_PAPERS, cost });
  }
  for (const main of configs.filter((c) => c.model === lib.MODELS.haiku)) {
    for (const judge of configs.filter((c) => c.model === lib.MODELS.sonnet)) {
      const items = lib.scoreConfig({ ...common, configId: main.id, tiebreakId: judge.id });
      const summary = lib.summarizeItems(items);
      const mainCost = lib.configCost(results, main.id).perCall;
      const judgeCost = lib.configCost(results, judge.id).perCall;
      const judgeShare = summary.n === 0 ? 0 : summary.usedTiebreak / summary.n;
      evaluations.push({
        name: `${main.id} ×${runs} + ${judge.id} trọng tài`,
        kind: "combo",
        items,
        summary,
        monthly: (mainCost * runs + judgeCost * judgeShare) * 2 * lib.MONTHLY_PAPERS,
      });
    }
  }

  const keyRows = [];
  for (const [testId, key] of keys) {
    const draftPath = join(p.keys, `${testId}.draft.json`);
    if (!existsSync(draftPath)) continue;
    const draft = readJson(draftPath);
    keyRows.push({ testId, ...lib.keyDraftAccuracy(draft, key), cost: draft._meta?.cost_usd ?? 0 });
  }

  writeFileSync(p.report, renderReport({ evaluations, keyRows, stats, scoreIncludesBonus, keys, results, submissions, runs }));
  const mismatchRows = [
    ["cau_hinh", "submission_id", "ma_de", "diem_tro_giang", "diem_ai", "lech", "mau", "diem_tung_lan", "dung_trong_tai", "duoc_cong", "ket_qua_tung_cau", "ly_do", "bai_lam"],
  ];
  for (const evaluation of evaluations) {
    for (const item of evaluation.items) {
      if (item.strictDiff === 0) continue;
      mismatchRows.push([
        evaluation.name,
        item.submission.submission_id,
        item.submission.test_id,
        item.expected,
        item.score ?? "",
        item.bonusExplains ? `${item.strictDiff} (+1 chưa rõ)` : item.strictDiff ?? "",
        COLOR_VI[item.color],
        item.runScores.map((s) => s ?? "lỗi").join(" / "),
        item.usedTiebreak ? "có" : "",
        item.submission.bonus === null ? "không rõ" : item.submission.bonus ? "có" : "",
        verdictText(item.verdicts),
        item.reasons,
        item.submission.answer_text,
      ]);
    }
  }
  writeFileSync(p.mismatches, `﻿${lib.toCsv(mismatchRows)}\r\n`);

  printTable(
    ["Cấu hình", "Bài", "Khớp", "Khớp chặt", "Lệch ≤ 1", "Xanh", "Xanh lệch ≥ 2", "USD/tháng ~", "Đạt"],
    evaluations.map(({ name, summary, monthly }) => [
      name,
      summary.n,
      pct(summary.exactRate),
      pct(summary.exactStrictRate),
      pct(summary.within1Rate),
      pct(summary.greenRate),
      summary.greenOffBy2,
      usd(monthly),
      summary.passes ? "ĐẠT" : "chưa",
    ]),
  );
  console.log(`\nĐã ghi ${p.report} và ${p.mismatches} (${mismatchRows.length - 1} dòng lệch).`);
}

function renderReport({ evaluations, keyRows, stats, scoreIncludesBonus, keys, results, submissions, runs }) {
  const graded = submissions.filter((s) => keys.has(s.test_id)).length;
  const failures = {};
  for (const result of results.values()) {
    const reason = result.status !== "succeeded" ? result.status : result.stop_reason !== "end_turn" ? `stop_${result.stop_reason}` : null;
    if (reason) failures[reason] = (failures[reason] ?? 0) + 1;
  }
  const lines = [
    "# Báo cáo Giai đoạn 0: chấm bài kiểm tra cuối buổi bằng AI",
    "",
    `Tạo lúc ${new Date().toISOString()} · prompt \`${lib.PROMPT_VERSION}\` · ${graded} bài có đáp án đã chốt, ${keys.size} đề · mỗi cấu hình chấm ${runs} lần · nguồn: ${stats.input ?? "?"}.`,
    "",
    `Điểm so sánh là số nguyên (làm tròn x,5 lên). Điểm trợ giảng được coi là ${scoreIncludesBonus ? "**đã gồm** điểm cộng (+1 khi có tick)" : "**chưa gồm** điểm cộng"}.`,
    "",
    `**Chuẩn đạt:** ≥ ${pct(lib.CRITERIA.exactRate)} bài khớp tuyệt đối; ≥ ${pct(lib.CRITERIA.within1Rate)} lệch ≤ 1 điểm; không bài xanh nào lệch ≥ 2 điểm.`,
    "",
    "| Cấu hình | Bài | Khớp | Khớp chặt | Lệch ≤ 1 | Xanh | Xanh lệch ≥ 2 | Các lần chấm khớp nhau | Dùng trọng tài | Xếp hạng khớp | USD/tháng ~ | Đạt |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...evaluations.map(({ name, summary: s, monthly }) =>
      `| ${name} | ${s.n} | ${pct(s.exactRate)} | ${pct(s.exactStrictRate)} | ${pct(s.within1Rate)} | ${pct(s.greenRate)} | ${s.greenOffBy2} | ${pct(s.n ? s.runsAgree / s.n : 0)} | ${s.usedTiebreak} | ${pct(s.n ? s.rankMatch / s.n : 0)} | ${usd(monthly)} | ${s.passes ? "ĐẠT" : "chưa"} |`,
    ),
    "",
    `USD/tháng ~: ước tính cho ${lib.MONTHLY_PAPERS.toLocaleString("vi-VN")} bài/tháng, tính theo token thật của đợt chạy này nhưng ở **giá thường** (khi chạy thật, bài chấm ngay chứ không qua Batch API, nên gấp đôi giá Batch). Chưa gồm đọc đề.`,
    "",
    "## Token và chi phí thật của đợt chạy (giá Batch)",
    "",
    "| Cấu hình | Lượt | Token vào | Cache đọc | Cache ghi | Token ra | USD | USD/lượt |",
    "|---|---|---|---|---|---|---|---|",
    ...evaluations
      .filter((e) => e.kind === "single")
      .map(({ name, cost: c }) => `| ${name} | ${c.calls} | ${c.tokens.input} | ${c.tokens.cacheRead} | ${c.tokens.cacheWrite} | ${c.tokens.output} | ${usd(c.total)} | ${usd(c.perCall)} |`),
    "",
    "## Đọc đề bằng Opus 5.5",
    "",
  ];
  if (keyRows.length === 0) {
    lines.push("Chưa có cặp bản nháp + đáp án đã chốt để so.");
  } else {
    const total = keyRows.reduce((sum, r) => sum + r.total, 0);
    const matched = keyRows.reduce((sum, r) => sum + r.matched, 0);
    const perTest = keyRows.reduce((sum, r) => sum + r.cost, 0) / keyRows.length;
    lines.push(
      `Bản nháp đúng đáp án cuối ở **${matched}/${total} câu (${pct(total ? matched / total : 0)})**, chuẩn ≥ 95%. Chi phí trung bình ${usd(perTest)}/đề (giá thường).`,
      "",
      "| Đề | Câu | Nháp đúng | Nháp thiếu câu | Nháp thừa câu | USD |",
      "|---|---|---|---|---|---|",
      ...keyRows.map((r) => `| ${r.testId} | ${r.total} | ${r.matched} | ${r.missing} | ${r.extra} | ${usd(r.cost)} |`),
    );
  }
  lines.push(
    "",
    "## Ghi chú",
    "",
    `- Lượt lỗi hoặc không dùng được: ${Object.keys(failures).length ? Object.entries(failures).map(([k, v]) => `${k} ${v}`).join(", ") : "không có"}.`,
    `- Bài không rõ có được cộng điểm không: ${evaluations[0]?.summary.bonusUnknown ?? 0}. Bài nào điểm trợ giảng cao hơn AI đúng 1 điểm thì cột "Khớp" coi là khớp (đó là +1 "tích cực tương tác", AI không thấy được); cột "Khớp chặt" không tính như vậy. Khi đề có câu 1 điểm, lệch 1 điểm cũng có thể là AI chấm sai một câu: xem cột \`lech\` ghi "(+1 chưa rõ)" trong \`mismatches.csv\`.`,
    "- Xanh: các lần chấm khớp từng câu (hoặc trọng tài phân xử được), không cờ, không có lần nào tự báo độ tin cậy thấp. Vàng: cần người xem. Đỏ: không có kết quả dùng được.",
    "- Mọi bài lệch nằm trong `mismatches.csv`. Rà tay từng bài: có khi trợ giảng chấm sai, có khi đáp án chốt sai.",
  );
  return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------

const HELP = `Cách dùng: node scripts/ai-grading-eval.mjs <lệnh> [--dir .ai-grading-eval]

  template                       tạo thư mục, dữ liệu mẫu và README
  prepare --input <file>         đọc .xlsx/.csv, chỉ giữ bài làm + điểm (offline)
          [--col field="Tên cột"] [--sheet <tên>] [--delimiter tab|;] [--date-order dmy|mdy]
          [--score-includes-bonus yes|no]
  extract-keys [--tests a,b] [--force] [--concurrency 2] [--confirm]
  submit [--configs ${lib.GRADE_CONFIGS.map((c) => c.id).join(",")}] [--runs 2] [--limit N] [--force] [--confirm]
  collect [--batch <id>] [--wait] [--force]
  report

Các field cho --col: answer, score, bonus, testId, timestamp, fullName, givenName, birthYear, classOption, phone.
Lệnh tốn tiền (extract-keys, submit) chỉ in ước tính nếu thiếu --confirm.`;

async function main() {
  const { command, flags, columns } = parseArgs(process.argv.slice(2));
  const p = paths(resolve(typeof flags.dir === "string" ? flags.dir : ".ai-grading-eval"));
  switch (command) {
    case "template":
      return cmdTemplate(p);
    case "prepare":
      return cmdPrepare(p, flags, columns);
    case "extract-keys":
      return cmdExtractKeys(p, flags);
    case "submit":
      return cmdSubmit(p, flags);
    case "collect":
      return cmdCollect(p, flags);
    case "report":
      return cmdReport(p);
    default:
      console.log(HELP);
      if (command && command !== "help" && !flags.help) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(describeApiError(error) ?? error?.message ?? error);
  process.exitCode = 1;
});
