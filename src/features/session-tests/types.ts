import type { AnswerKey } from "@/features/session-tests/answer-key";

export type SessionTestStatus = "draft" | "key_review" | "key_confirmed";

export type GradingRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface SessionTestAsset {
  height: number;
  id: string;
  mimeType: string;
  pageNo: number;
  sha256: string;
  storagePath: string;
  /** Short-lived signed URL; null when Storage did not sign it. */
  url: string | null;
  width: number;
}

/** Latest "AI đọc đề" run of the test. */
export interface SessionTestExtraction {
  createdAt: string;
  errorCode: string | null;
  finishedAt: string | null;
  id: string;
  /**
   * What the finished run did with its draft: applied (written into the draft), draft_changed (the
   * draft was edited after the request, so it was kept), key_confirmed, invalid_key.
   */
  outcome?: string | null;
  status: GradingRunStatus;
  /** Spots the AI could not read for sure ("transcription_warnings"). */
  warnings?: string[];
}

/**
 * A question most graded papers got wrong on the confirmed key: over 70% of at least 5 papers
 * (approved papers count with the reviewer's verdicts, blank forms are left out). Usually a key typo.
 */
export interface SessionTestKeyWarning {
  /** The wrong answer given most often, when 2 or more papers share it (often the right answer). */
  commonAnswer: string | null;
  commonAnswerCount: number | null;
  keyAnswer: string | null;
  label: string;
  papers: number;
  wrong: number;
}

export interface SessionTestDetail {
  answerKey: AnswerKey;
  /** Number of times the key was confirmed; 0 = never. */
  answerKeyVersion: number;
  assets: SessionTestAsset[];
  classSessionId: string;
  confirmedAt: string | null;
  confirmedByName: string | null;
  extraction: SessionTestExtraction | null;
  id: string;
  /** Absent in fixtures written before the warning existed. */
  keyWarnings?: SessionTestKeyWarning[];
  markingGuide: string | null;
  /** The session this key was copied from ("Dùng đề có sẵn"). */
  source: { classCode: string; classSessionId: string; startTime: string; testId: string } | null;
  status: SessionTestStatus;
  title: string | null;
  updatedAt: string;
}

/** A confirmed test of another session on the same date and grade. */
export interface SessionTestSource {
  answerKey: AnswerKey;
  answerKeyVersion: number;
  classCode: string;
  className: string;
  classSessionId: string;
  confirmedAt: string | null;
  confirmedByName: string | null;
  endTime: string;
  markingGuide: string | null;
  pageCount: number;
  startTime: string;
  testId: string;
  title: string | null;
}

export interface SessionTestState {
  /** ANTHROPIC_API_KEY is set; without it "AI đọc đề" stays disabled. */
  aiConfigured: boolean;
  /** ai_grading.confirm_key */
  canConfirm: boolean;
  /** ai_grading.manage_tests */
  canManage: boolean;
  /** The session is neither locked nor cancelled. */
  editable: boolean;
  sessionId: string;
  /** Confirmed tests to reuse; empty unless the viewer can manage and confirm. */
  sources: SessionTestSource[];
  test: SessionTestDetail | null;
}
