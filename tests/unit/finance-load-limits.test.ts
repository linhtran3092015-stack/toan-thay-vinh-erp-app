// Value: protects=the list caps the UI names ("chỉ gồm 1.000 yêu cầu mới nhất", "tối đa 100") match the reads in data.ts;
// fails_when=a loader's .limit(...) changes without the constant the page uses for its notice, or the constant changes alone;
// why_new=step 14c review (M7): the payment-request header and the ledger line state the caps as constants; seam=source text of data.ts (no database); no_claim=what the database returns
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PAYMENT_REQUEST_LOAD_LIMIT } from "@/features/finance/payment-request-directory-models";
import { SESSION_LEDGER_ENTRY_LIMIT } from "@/features/finance/session-ledger-models";

const source = readFileSync(join(process.cwd(), "src/features/finance/data.ts"), "utf8");

/** The body of one exported loader, up to the next exported function. */
function loaderBody(name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("export async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("finance list load limits", () => {
  it("the payment-request read is capped at PAYMENT_REQUEST_LOAD_LIMIT", () => {
    expect(loaderBody("getPaymentRequestsResult")).toContain(`.limit(${PAYMENT_REQUEST_LOAD_LIMIT})`);
  });

  it("the session-ledger read is capped at SESSION_LEDGER_ENTRY_LIMIT", () => {
    expect(loaderBody("getCenterSessionLedgerEntriesResult")).toContain(`.limit(${SESSION_LEDGER_ENTRY_LIMIT})`);
  });
});
