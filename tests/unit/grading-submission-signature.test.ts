import { describe, expect, it } from "vitest";

import {
  gradingRequestMessage,
  signGradingMessage,
  verifyGradingSignature,
} from "@/features/grading-submissions/signature";

const SECRET = "test-secret-0123456789abcdef0123456789";
const TIMESTAMP = 1_760_770_000;
const NOW_MS = TIMESTAMP * 1000;
const BODY = '{"fullName":"Nguyễn Đức Anh","answerText":"13. x=18"}';

describe("grading form HMAC", () => {
  it("matches an HMAC computed outside Node over the UTF-8 body (Apps Script parity)", () => {
    // printf '%s' '<ts>.<body>' | openssl dgst -sha256 -hmac '<secret>'
    expect(signGradingMessage(SECRET, TIMESTAMP, BODY)).toBe(
      "sha256=69abf3a8d7f905a223ac69335cd79da39caa6aa748b27efc4f98e50a4683d5c4",
    );
  });

  it("accepts a valid signature, also in upper-case hex", () => {
    const signature = signGradingMessage(SECRET, TIMESTAMP, BODY);
    expect(verifyGradingSignature({ message: BODY, nowMs: NOW_MS, secret: SECRET, signature, timestamp: String(TIMESTAMP) })).toBe(true);
    expect(
      verifyGradingSignature({ message: BODY, nowMs: NOW_MS, secret: SECRET, signature: signature.toUpperCase().replace("SHA256=", "sha256="), timestamp: String(TIMESTAMP) }),
    ).toBe(true);
  });

  it("rejects a tampered body, another secret, a missing header or a non-numeric timestamp", () => {
    const signature = signGradingMessage(SECRET, TIMESTAMP, BODY);
    const base = { nowMs: NOW_MS, secret: SECRET, signature, timestamp: String(TIMESTAMP) };
    expect(verifyGradingSignature({ ...base, message: BODY.replace("18", "19") })).toBe(false);
    expect(verifyGradingSignature({ ...base, message: BODY, secret: `${SECRET}x` })).toBe(false);
    expect(verifyGradingSignature({ ...base, message: BODY, signature: null })).toBe(false);
    expect(verifyGradingSignature({ ...base, message: BODY, timestamp: null })).toBe(false);
    expect(verifyGradingSignature({ ...base, message: BODY, timestamp: "1760770000.5" })).toBe(false);
    expect(verifyGradingSignature({ ...base, message: BODY, timestamp: " " })).toBe(false);
  });

  it("allows 5 minutes of clock skew either way, not more", () => {
    const signature = signGradingMessage(SECRET, TIMESTAMP, BODY);
    const check = (offsetSeconds: number) =>
      verifyGradingSignature({ message: BODY, nowMs: NOW_MS + offsetSeconds * 1000, secret: SECRET, signature, timestamp: String(TIMESTAMP) });
    expect(check(300)).toBe(true);
    expect(check(-300)).toBe(true);
    expect(check(301)).toBe(false);
    expect(check(-301)).toBe(false);
  });

  it("signs a GET as method, path and query", () => {
    const message = gradingRequestMessage("get", new URL("https://erp.example/api/integrations/grading-roster?birthYear=2014"));
    expect(message).toBe("GET /api/integrations/grading-roster?birthYear=2014");
    expect(signGradingMessage(SECRET, TIMESTAMP, message)).toBe(
      "sha256=9cedf8c20de57d8c9a750a98f748b52dbd4e7c708cf6682402bc3a8a7f12a792",
    );
  });
});
