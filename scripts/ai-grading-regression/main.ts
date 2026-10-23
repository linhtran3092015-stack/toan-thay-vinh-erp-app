import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages/messages";

import {
  buildGradeParams,
  combineRuns,
  needsTiebreak,
  parseGradeMessage,
  renderKeyForPrompt,
  type GradeEffort,
  type MessageLike,
  type ParsedGrade,
  type StoredKey,
} from "@/features/ai-grading/grading";
import { CLAUDE_MODELS, estimateCostUsd, type TokenUsage } from "@/features/ai-grading/models";
import { GRADER_INSTRUCTIONS } from "@/features/ai-grading/prompts";
import type { Verdict } from "@/features/ai-grading/scoring";

import { comparePaper, excludeReason, summarize, type PaperComparison, type RegressionPaper } from "./compare";

/**
 * AI grading regression set (plan §7): node scripts/ai-grading-regression.mjs <command>
 *   export                 approved papers from production (read-only, via the linked Supabase CLI)
 *   estimate               request count and expected cost
 *   submit --confirm       primary runs through the Message Batches API (half price); --max-usd caps the estimate
 *   collect                exit 2 while a batch runs; sends the tiebreak batch, then writes the report
 * Data stays in .ai-grading-eval/regression/ (git-ignored). Same request as the worker (buildGradeParams).
 */

const ROOT = process.cwd();
const DIR = path.join(ROOT, ".ai-grading-eval", "regression");
const FILES = {
  dataset: path.join(DIR, "dataset.json"),
  primary: path.join(DIR, "primary.jsonl"),
  results: path.join(DIR, "results.json"),
  state: path.join(DIR, "state.json"),
  tiebreak: path.join(DIR, "tiebreak.jsonl"),
};
const BATCH_DISCOUNT = 0.5;
const WAITING = 2;

interface State {
  effort: GradeEffort;
  estimateUsd: number;
  model: string;
  primaryBatchId: string;
  submittedAt: string;
  tiebreakBatchId: string | null;
  tiebreakModel: string | null;
}

interface BatchLine {
  custom_id: string;
  message: (MessageLike & { model: string; usage: TokenUsage }) | null;
  error: string | null;
}

function writePrivate(file: string, text: string) {
  mkdirSync(DIR, { mode: 0o700, recursive: true });
  writeFileSync(file, text, { mode: 0o600 });
  chmodSync(file, 0o600);
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function flag(args: string[], name: string): string | null {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? (args[index + 1] ?? null) : null;
}

function paramsFor(paper: RegressionPaper, model: string, effort: GradeEffort) {
  return buildGradeParams({ answerText: paper.answerText, effort, key: paper.key, model, title: paper.testTitle }) as unknown as MessageCreateParamsNonStreaming;
}

// custom_id allows [a-zA-Z0-9_-]{1,64}: submission uuid + run.
const customId = (paper: RegressionPaper, run: string) => `${paper.submissionId}_${run}`;

function loadPapers(): { excluded: RegressionPaper[]; papers: RegressionPaper[] } {
  if (!existsSync(FILES.dataset)) throw new Error("Run `export` first.");
  const all = readJson<RegressionPaper[]>(FILES.dataset);
  return { excluded: all.filter((paper) => excludeReason(paper)), papers: all.filter((paper) => !excludeReason(paper)) };
}

/** Rough expected cost: ~3 characters per token in, 1,500 tokens out per call, batch price. */
function estimateUsd(papers: RegressionPaper[], model: string, calls: number): number {
  return papers.reduce((sum, paper) => {
    const chars = GRADER_INSTRUCTIONS.length + renderKeyForPrompt(paper.key, paper.testTitle).length + paper.answerText.length;
    return sum + calls * estimateCostUsd(model, { input_tokens: Math.ceil(chars / 3), output_tokens: 1500 }) * BATCH_DISCOUNT;
  }, 0);
}

async function downloadBatch(client: Anthropic, batchId: string, file: string): Promise<BatchLine[]> {
  const lines: BatchLine[] = [];
  for await (const entry of await client.messages.batches.results(batchId)) {
    const result = entry.result;
    lines.push({
      custom_id: entry.custom_id,
      error: result.type === "succeeded" ? null : result.type === "errored" ? `errored:${result.error.error.type}` : result.type,
      message: result.type === "succeeded" ? (result.message as unknown as BatchLine["message"]) : null,
    });
  }
  writePrivate(file, lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
  return lines;
}

function parsed(line: BatchLine | undefined, key: StoredKey): ParsedGrade {
  if (!line) return { error: "missing_result", ok: false };
  if (!line.message) return { error: line.error ?? "no_message", ok: false };
  return parseGradeMessage(line.message, key);
}

const spent = (lines: BatchLine[]) =>
  lines.reduce((sum, line) => sum + (line.message ? estimateCostUsd(line.message.model, line.message.usage) * BATCH_DISCOUNT : 0), 0);

function readLines(file: string): BatchLine[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as BatchLine);
}

async function exportDataset() {
  // The CLI can exit 1 after printing the rows (its telemetry times out), so judge by the output.
  const output = spawnSync("npx", ["supabase", "db", "query", "--linked", "-f", "scripts/ai-grading-regression/dataset.sql", "-o", "json"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  }).stdout;
  if (!output || !output.includes('"rows"')) throw new Error("The Supabase CLI returned no rows (is this checkout linked?).");
  const body = JSON.parse(output.slice(output.indexOf("{"), output.lastIndexOf("}") + 1)) as { rows: Array<{ papers: string }> };
  const rows = JSON.parse(body.rows[0].papers) as Array<Record<string, unknown>>;
  const papers: RegressionPaper[] = rows.map((row) => ({
    answerText: String(row.answer_text ?? ""),
    grade: typeof row.grade === "number" ? row.grade : null,
    key: row.answer_key as StoredKey,
    keyVersion: Number(row.key_version),
    live: {
      color: (row.live_color as string | null) ?? null,
      flags: (row.live_flags as string[] | null) ?? [],
      verdicts: (row.live_verdicts as Record<string, Verdict> | null) ?? null,
    },
    sessionDate: String(row.session_date),
    submissionId: String(row.submission_id),
    ta: { paperScore: (row.ta_paper_score as number | null) ?? null, verdicts: row.ta_verdicts as Record<string, Verdict> },
    testTitle: (row.test_title as string | null) ?? null,
  }));
  writePrivate(FILES.dataset, JSON.stringify(papers, null, 1));
  const blank = papers.filter((paper) => excludeReason(paper)).length;
  const tests = new Set(papers.map((paper) => `${paper.sessionDate}:${paper.grade}`)).size;
  console.log(`exported ${papers.length} approved papers from ${tests} tests; ${blank} blank forms left out; ${papers.length - blank} to regrade`);
}

function settings(args: string[]) {
  const effort = (flag(args, "effort") ?? "medium") as GradeEffort;
  return {
    effort,
    model: flag(args, "model") ?? CLAUDE_MODELS.haiku,
    tiebreakModel: flag(args, "tiebreak") === "none" ? null : (flag(args, "tiebreak") ?? CLAUDE_MODELS.sonnet),
  };
}

function estimate(args: string[]) {
  const { papers, excluded } = loadPapers();
  const { model, tiebreakModel } = settings(args);
  const primary = estimateUsd(papers, model, 2);
  // Live runs needed a tiebreak on roughly a third of papers; budget for half.
  const tiebreak = tiebreakModel ? estimateUsd(papers.slice(0, Math.ceil(papers.length / 2)), tiebreakModel, 1) : 0;
  console.log(`${papers.length} papers (${excluded.length} blank left out): ${papers.length * 2} primary calls ≈ $${primary.toFixed(3)}, tiebreak ≈ $${tiebreak.toFixed(3)} (batch price)`);
  return primary + tiebreak;
}

async function submit(args: string[]) {
  if (!args.includes("--confirm")) throw new Error("Paid call: add --confirm.");
  if (existsSync(FILES.state)) throw new Error(`A run already exists (${FILES.state}); move it away to start over.`);
  const maxUsd = Number(flag(args, "max-usd") ?? "1");
  const expected = estimate(args);
  if (!(expected <= maxUsd)) throw new Error(`Estimate $${expected.toFixed(3)} is over --max-usd ${maxUsd}.`);
  const { papers } = loadPapers();
  const { effort, model, tiebreakModel } = settings(args);
  const client = new Anthropic({ maxRetries: 2, timeout: 120_000 });
  const requests = papers.flatMap((paper) =>
    ["1", "2"].map((run) => ({ custom_id: customId(paper, run), params: paramsFor(paper, model, effort) })),
  );
  const batch = await client.messages.batches.create({ requests });
  const state: State = { effort, estimateUsd: expected, model, primaryBatchId: batch.id, submittedAt: new Date().toISOString(), tiebreakBatchId: null, tiebreakModel };
  writePrivate(FILES.state, JSON.stringify(state, null, 1));
  console.log(`submitted ${requests.length} requests as batch ${batch.id}`);
}

async function collect() {
  const state = readJson<State>(FILES.state);
  const { papers, excluded } = loadPapers();
  const client = new Anthropic({ maxRetries: 2, timeout: 120_000 });

  let primary = readLines(FILES.primary);
  if (primary.length === 0) {
    const batch = await client.messages.batches.retrieve(state.primaryBatchId);
    if (batch.processing_status !== "ended") {
      console.log(`primary batch ${batch.processing_status}: ${JSON.stringify(batch.request_counts)}`);
      return WAITING;
    }
    primary = await downloadBatch(client, state.primaryBatchId, FILES.primary);
  }
  const byId = new Map(primary.map((line) => [line.custom_id, line]));
  const runsFor = (paper: RegressionPaper) => ["1", "2"].map((run) => parsed(byId.get(customId(paper, run)), paper.key));

  const needTiebreak = state.tiebreakModel ? papers.filter((paper) => needsTiebreak(paper.key, runsFor(paper))) : [];
  let tiebreak: BatchLine[] = readLines(FILES.tiebreak);
  if (needTiebreak.length > 0 && tiebreak.length === 0) {
    if (!state.tiebreakBatchId) {
      const batch = await client.messages.batches.create({
        requests: needTiebreak.map((paper) => ({ custom_id: customId(paper, "t"), params: paramsFor(paper, state.tiebreakModel!, state.effort) })),
      });
      writePrivate(FILES.state, JSON.stringify({ ...state, tiebreakBatchId: batch.id }, null, 1));
      console.log(`sent ${needTiebreak.length} tiebreak requests as batch ${batch.id}`);
      return WAITING;
    }
    const batch = await client.messages.batches.retrieve(state.tiebreakBatchId);
    if (batch.processing_status !== "ended") {
      console.log(`tiebreak batch ${batch.processing_status}: ${JSON.stringify(batch.request_counts)}`);
      return WAITING;
    }
    tiebreak = await downloadBatch(client, state.tiebreakBatchId, FILES.tiebreak);
  }
  const tiebreakById = new Map(tiebreak.map((line) => [line.custom_id, line]));

  const comparisons: PaperComparison[] = papers.map((paper) => {
    const runs = runsFor(paper);
    const extra = tiebreakById.get(customId(paper, "t"));
    return comparePaper(paper, combineRuns(paper.key, runs, extra ? parsed(extra, paper.key) : undefined));
  });
  const summary = summarize(comparisons);
  const cost = spent(primary) + spent(tiebreak);
  const failedCalls = [...primary, ...tiebreak].filter((line) => !line.message).length;
  writePrivate(FILES.results, JSON.stringify({ comparisons, cost, failedCalls, state, summary }, null, 1));
  const reportFile = path.join(DIR, `report-${state.submittedAt.slice(0, 10)}.md`);
  writePrivate(reportFile, report(papers, excluded, comparisons, summary, state, cost, failedCalls));
  console.log(readFileSync(reportFile, "utf8"));
  return 0;
}

const pct = (part: number, whole: number) => (whole === 0 ? "–" : `${((part / whole) * 100).toFixed(1)}%`);

function report(
  papers: RegressionPaper[],
  excluded: RegressionPaper[],
  comparisons: PaperComparison[],
  summary: ReturnType<typeof summarize>,
  state: State,
  cost: number,
  failedCalls: number,
): string {
  const byId = new Map(papers.map((paper) => [paper.submissionId, paper]));
  const ok = (value: boolean) => (value ? "đạt" : "CHƯA ĐẠT");
  const lines = [
    `# Bộ đề hồi quy chấm bài AI (${state.submittedAt.slice(0, 10)})`,
    "",
    `Cấu hình: ${state.model} effort ${state.effort} chấm 2 lần, trọng tài ${state.tiebreakModel ?? "không"}. Chi phí thật ≈ $${cost.toFixed(3)} (giá batch). Lượt gọi lỗi: ${failedCalls}.`,
    `Bài: ${papers.length} bài đã duyệt được chấm lại; ${excluded.length} bài nộp trống (làm trên giấy) không tính.`,
    "",
    "| Chỉ số | Kết quả | Mốc kế hoạch |",
    "|---|---|---|",
    `| Khớp từng câu với trợ giảng | ${summary.exact}/${summary.compared} (${pct(summary.exact, summary.compared)}) | ≥ 90%: ${ok(summary.bars.exact)} |`,
    `| Lệch ≤ 1 điểm | ${summary.withinOne}/${summary.compared} (${pct(summary.withinOne, summary.compared)}) | ≥ 98%: ${ok(summary.bars.withinOne)} |`,
    `| Lệch ≥ 2 điểm mà vẫn xanh | ${summary.bigMisses.filter((item) => item.color === "green").length} | 0: ${ok(summary.bars.noSilentBigMiss)} |`,
    `| Câu lệch / tổng câu | ${summary.questions.different}/${summary.questions.compared} (${pct(summary.questions.different, summary.questions.compared)}) | |`,
    `| Xanh · vàng · đỏ | ${summary.colors.green} · ${summary.colors.yellow} · ${summary.colors.red} | |`,
    `| Bài xanh nhưng lệch trợ giảng | ${summary.greenWrong} | |`,
    `| 2 lần chấm khớp nhau | ${summary.runsAgree}/${comparisons.length} (${pct(summary.runsAgree, comparisons.length)}) | |`,
    `| Cần trọng tài | ${summary.tiebreaks} | |`,
    `| Khớp lần chấm thật trước đó | ${summary.liveAgreement.agree}/${summary.liveAgreement.compared} (${pct(summary.liveAgreement.agree, summary.liveAgreement.compared)}) | |`,
    "",
    "## Bài lệch trợ giảng",
    "",
    "| Bài | Ngày · khối | Màu | Điểm AI / TG | Câu | TG | AI | AI đọc được | Lý do AI |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const item of comparisons.filter((comparison) => comparison.differences.length > 0)) {
    const paper = byId.get(item.submissionId)!;
    for (const difference of item.differences) {
      const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").slice(0, 120);
      lines.push(
        `| ${item.submissionId.slice(0, 8)} | ${paper.sessionDate} · lớp ${paper.grade ?? "?"} | ${item.color} | ${item.aiScore ?? "–"} / ${item.taScore} | ${difference.label} | ${difference.ta} | ${difference.ai ?? "–"} | ${cell(difference.extracted)} | ${cell(difference.reason)} |`,
      );
    }
  }
  return lines.join("\n") + "\n";
}

export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  if (command === "export") await exportDataset();
  else if (command === "estimate") estimate(rest);
  else if (command === "submit") await submit(rest);
  else if (command === "collect") return collect();
  else {
    console.error("usage: node scripts/ai-grading-regression.mjs export | estimate | submit --confirm [--max-usd 1] | collect");
    return 1;
  }
  return 0;
}
