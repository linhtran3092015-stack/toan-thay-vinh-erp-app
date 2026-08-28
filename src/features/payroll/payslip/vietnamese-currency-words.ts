const digits = [
  "không",
  "một",
  "hai",
  "ba",
  "bốn",
  "năm",
  "sáu",
  "bảy",
  "tám",
  "chín",
];

const tiers = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

function readGroupOfThree(
  threeDigits: number,
  isHighestGroup: boolean,
): string {
  const hundreds = Math.floor(threeDigits / 100);
  const remainder = threeDigits % 100;
  const tens = Math.floor(remainder / 10);
  const units = remainder % 10;

  const parts: string[] = [];

  if (hundreds > 0 || !isHighestGroup) {
    parts.push(digits[hundreds], "trăm");
  }

  if (tens > 1) {
    parts.push(digits[tens], "mươi");
    if (units === 1) {
      parts.push("mốt");
    } else if (units === 4) {
      parts.push("tư");
    } else if (units === 5) {
      parts.push("lăm");
    } else if (units > 0) {
      parts.push(digits[units]);
    }
  } else if (tens === 1) {
    parts.push("mười");
    if (units === 5) {
      parts.push("lăm");
    } else if (units > 0) {
      parts.push(digits[units]);
    }
  } else if (tens === 0) {
    if (units > 0) {
      if (hundreds > 0 || !isHighestGroup) {
        parts.push("linh");
      }
      parts.push(digits[units]);
    }
  }

  return parts.join(" ");
}

/**
 * Converts a non-negative integer amount to Vietnamese currency words.
 * Example: 13500000 -> "Mười ba triệu năm trăm nghìn đồng chẵn./."
 */
export function formatVietnameseCurrencyWords(amountVnd: number): string {
  const safeAmount = Math.max(0, Math.round(amountVnd));

  if (safeAmount === 0) {
    return "Không đồng chẵn./.";
  }

  const groups: number[] = [];
  let remaining = safeAmount;

  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const groupTexts: string[] = [];

  for (let i = groups.length - 1; i >= 0; i--) {
    const groupValue = groups[i];
    if (groupValue === 0) continue;

    const isHighest = i === groups.length - 1;
    const groupSpelled = readGroupOfThree(groupValue, isHighest);
    const tierName = tiers[i];

    if (groupSpelled.trim()) {
      groupTexts.push(
        tierName ? `${groupSpelled} ${tierName}` : groupSpelled,
      );
    }
  }

  const combined = groupTexts.join(" ").trim().replace(/\s+/g, " ");
  if (!combined) {
    return "Không đồng chẵn./.";
  }

  const capitalized = combined.charAt(0).toUpperCase() + combined.slice(1);
  return `${capitalized} đồng chẵn./.`;
}
