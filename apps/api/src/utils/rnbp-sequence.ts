import { RNBP_ALPHABET, RNBP_REGEX, normalizeRnbpCode } from "@rnbp/shared";

const SUFFIX_LENGTH = 8;
const ALPHABET_SIZE = BigInt(RNBP_ALPHABET.length);
const MAX_SUFFIX_VALUE = ALPHABET_SIZE ** BigInt(SUFFIX_LENGTH) - 1n;
const MAX_RANGE_SIZE = 1000;

/**
 * Convert an RNBP code (e.g. "RNBP-A2B3C4D5") to its positional integer
 * in the ambiguity-free alphabet (excludes 0, 1, I, L, O).
 */
export function codeToInt(code: string): bigint {
  if (!RNBP_REGEX.test(code)) {
    throw new Error("INVALID_RNBP_FORMAT");
  }
  const suffix = code.slice("RNBP-".length);
  let n = 0n;
  for (const ch of suffix) {
    const idx = RNBP_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("INVALID_RNBP_FORMAT");
    n = n * ALPHABET_SIZE + BigInt(idx);
  }
  return n;
}

/** Reverse of codeToInt — format an integer back to "RNBP-XXXXXXXX". */
export function intToCode(n: bigint): string {
  if (n < 0n || n > MAX_SUFFIX_VALUE) {
    throw new Error("RNBP_OUT_OF_RANGE");
  }
  let suffix = "";
  let v = n;
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    const idx = Number(v % ALPHABET_SIZE);
    suffix = RNBP_ALPHABET[idx] + suffix;
    v = v / ALPHABET_SIZE;
  }
  return `RNBP-${suffix}`;
}

/**
 * Expand an inclusive range of RNBP codes from `first` to `last`.
 * Inputs are normalized (strip spaces, uppercase) before parsing.
 * Throws "INVALID_RANGE" if last < first or the range exceeds MAX_RANGE_SIZE.
 */
export function expandRange(first: string, last: string): string[] {
  const f = codeToInt(normalizeRnbpCode(first));
  const l = codeToInt(normalizeRnbpCode(last));
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
