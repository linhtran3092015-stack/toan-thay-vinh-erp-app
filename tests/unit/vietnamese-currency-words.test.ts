import { describe, expect, it } from "vitest";

import { formatVietnameseCurrencyWords } from "@/features/payroll/payslip/vietnamese-currency-words";

describe("formatVietnameseCurrencyWords", () => {
  it("formats zero amount", () => {
    expect(formatVietnameseCurrencyWords(0)).toBe("Không đồng chẵn./.");
  });

  it("formats round hundreds and thousands", () => {
    expect(formatVietnameseCurrencyWords(500_000)).toBe(
      "Năm trăm nghìn đồng chẵn./.",
    );
    expect(formatVietnameseCurrencyWords(1_000_000)).toBe(
      "Một triệu đồng chẵn./.",
    );
    expect(formatVietnameseCurrencyWords(10_000_000)).toBe(
      "Mười triệu đồng chẵn./.",
    );
  });

  it("formats standard mockup amount: 13,500,000 VND", () => {
    expect(formatVietnameseCurrencyWords(13_500_000)).toBe(
      "Mười ba triệu năm trăm nghìn đồng chẵn./.",
    );
  });

  it("formats gross amount: 15,850,000 VND", () => {
    expect(formatVietnameseCurrencyWords(15_850_000)).toBe(
      "Mười lăm triệu tám trăm năm mươi nghìn đồng chẵn./.",
    );
  });

  it("formats deduction amount: 2,350,000 VND", () => {
    expect(formatVietnameseCurrencyWords(2_350_000)).toBe(
      "Hai triệu ba trăm năm mươi nghìn đồng chẵn./.",
    );
  });

  it("formats amounts with units: mốt, tư, lăm, linh", () => {
    expect(formatVietnameseCurrencyWords(21_000_000)).toBe(
      "Hai mươi mốt triệu đồng chẵn./.",
    );
    expect(formatVietnameseCurrencyWords(24_000_000)).toBe(
      "Hai mươi tư triệu đồng chẵn./.",
    );
    expect(formatVietnameseCurrencyWords(25_000_000)).toBe(
      "Hai mươi lăm triệu đồng chẵn./.",
    );
    expect(formatVietnameseCurrencyWords(1_005_000)).toBe(
      "Một triệu không trăm linh năm nghìn đồng chẵn./.",
    );
  });

  it("formats large amounts into billions", () => {
    expect(formatVietnameseCurrencyWords(1_000_000_000)).toBe(
      "Một tỷ đồng chẵn./.",
    );
    expect(formatVietnameseCurrencyWords(2_500_000_000)).toBe(
      "Hai tỷ năm trăm triệu đồng chẵn./.",
    );
  });
});
