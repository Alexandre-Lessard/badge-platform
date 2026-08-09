import { BADGE_ALPHABET, BADGE_CODE_REGEX, normalizeBadgeCode } from "@badge/shared";

const SUFFIX_LENGTH = 8;
const ALPHABET_SIZE = BigInt(BADGE_ALPHABET.length);
const MAX_SUFFIX_VALUE = ALPHABET_SIZE ** BigInt(SUFFIX_LENGTH) - 1n;
const MAX_RANGE_SIZE = 1000;
const PREFIX = "BADGE-";

export function codeToInt(code: string): bigint {
  if (!BADGE_CODE_REGEX.test(code)) {
    throw new Error("INVALID_BADGE_FORMAT");
  }
  const suffix = code.slice(PREFIX.length);
  let n = 0n;
  for (const ch of suffix) {
    const idx = BADGE_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("INVALID_BADGE_FORMAT");
    n = n * ALPHABET_SIZE + BigInt(idx);
  }
  return n;
}

export function intToCode(n: bigint): string {
  if (n < 0n || n > MAX_SUFFIX_VALUE) {
    throw new Error("BADGE_OUT_OF_RANGE");
  }
  let suffix = "";
  let v = n;
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    const idx = Number(v % ALPHABET_SIZE);
    suffix = BADGE_ALPHABET[idx] + suffix;
    v = v / ALPHABET_SIZE;
  }
  return `${PREFIX}${suffix}`;
}

export function expandRange(first: string, last: string): string[] {
  const f = codeToInt(normalizeBadgeCode(first));
  const l = codeToInt(normalizeBadgeCode(last));
  if (l < f) {
    throw new Error("INVALID_RANGE");
  }
  const length = l - f + 1n;
  if (length > BigInt(MAX_RANGE_SIZE)) {
    throw new Error("INVALID_RANGE");
  }
  const codes: string[] = new Array(Number(length));
  for (let i = 0n; i < length; i++) {
    codes[Number(i)] = intToCode(f + i);
  }
  return codes;
}
