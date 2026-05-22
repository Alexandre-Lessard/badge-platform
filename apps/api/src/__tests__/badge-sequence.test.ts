import { describe, it, expect } from "vitest";
import { normalizeBadgeCode, BADGE_ALPHABET } from "@rnbp/shared";
import { codeToInt, intToCode, expandRange } from "../utils/badge-sequence.js";

describe("normalizeBadgeCode", () => {
  it("uppercases input", () => {
    expect(normalizeBadgeCode("badge-a2b3c4d5")).toBe("BADGE-A2B3C4D5");
  });

  it("strips external whitespace", () => {
    expect(normalizeBadgeCode("  BADGE-A2B3C4D5  ")).toBe("BADGE-A2B3C4D5");
  });

  it("strips internal spaces (paste artefacts)", () => {
    expect(normalizeBadgeCode("BADGE- A2 B3 C4D5")).toBe("BADGE-A2B3C4D5");
  });
});

describe("codeToInt / intToCode round-trip", () => {
  it("maps the first alphabet position to 0", () => {
    const first = BADGE_ALPHABET[0].repeat(8);
    const code = `BADGE-${first}`;
    expect(codeToInt(code)).toBe(0n);
    expect(intToCode(0n)).toBe(code);
  });

  it("maps the last alphabet position to ALPHABET_SIZE^8 - 1", () => {
    const last = BADGE_ALPHABET[BADGE_ALPHABET.length - 1].repeat(8);
    const code = `BADGE-${last}`;
    const max = BigInt(BADGE_ALPHABET.length) ** 8n - 1n;
    expect(codeToInt(code)).toBe(max);
    expect(intToCode(max)).toBe(code);
  });

  it("round-trips a few mid-range codes", () => {
    const samples = ["BADGE-A2B3C4D5", "BADGE-Z9Y8X7W6", "BADGE-J3K4M5N6"];
    for (const code of samples) {
      expect(intToCode(codeToInt(code))).toBe(code);
    }
  });

  it("rejects codes with characters outside the alphabet", () => {
    expect(() => codeToInt("BADGE-12222222")).toThrow("INVALID_BADGE_FORMAT");
    expect(() => codeToInt("BADGE-O2222222")).toThrow("INVALID_BADGE_FORMAT");
    expect(() => codeToInt("BADGE-I2222222")).toThrow("INVALID_BADGE_FORMAT");
    expect(() => codeToInt("BADGE-L2222222")).toThrow("INVALID_BADGE_FORMAT");
  });

  it("rejects wrong prefix or length", () => {
    expect(() => codeToInt("XYZ-A2B3C4D5")).toThrow("INVALID_BADGE_FORMAT");
    expect(() => codeToInt("BADGE-A2B3C4D")).toThrow("INVALID_BADGE_FORMAT");
    expect(() => codeToInt("BADGE-A2B3C4D5X")).toThrow("INVALID_BADGE_FORMAT");
  });
});

describe("expandRange", () => {
  it("returns 10 codes for a 10-code range", () => {
    const codes = expandRange("BADGE-A2222222", "BADGE-A222222B");
    expect(codes).toHaveLength(10);
    expect(codes[0]).toBe("BADGE-A2222222");
    expect(codes[9]).toBe("BADGE-A222222B");
  });

  it("is contiguous (no gaps)", () => {
    const codes = expandRange("BADGE-A2222222", "BADGE-A222222B");
    for (let i = 0; i < codes.length - 1; i++) {
      expect(codeToInt(codes[i + 1]) - codeToInt(codes[i])).toBe(1n);
    }
  });

  it("returns a single code when first === last", () => {
    expect(expandRange("BADGE-A2222222", "BADGE-A2222222")).toEqual(["BADGE-A2222222"]);
  });

  it("normalizes lowercase + whitespace inputs", () => {
    const codes = expandRange("  badge-a2222222  ", "badge- a2 22222b");
    expect(codes).toHaveLength(10);
    expect(codes[0]).toBe("BADGE-A2222222");
  });

  it("throws INVALID_RANGE when last < first", () => {
    expect(() => expandRange("BADGE-A222222B", "BADGE-A2222222")).toThrow("INVALID_RANGE");
  });

  it("throws INVALID_RANGE when the range exceeds the safety cap", () => {
    expect(() => expandRange("BADGE-A2222222", "BADGE-A222Z222")).toThrow("INVALID_RANGE");
  });

  it("rejects invalid bound formats", () => {
    expect(() => expandRange("BADGE-A2222222", "BADGE-A222222I")).toThrow("INVALID_BADGE_FORMAT");
  });
});
