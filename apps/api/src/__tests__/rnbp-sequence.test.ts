import { describe, it, expect } from "vitest";
import { normalizeRnbpCode, RNBP_ALPHABET } from "@rnbp/shared";
import { codeToInt, intToCode, expandRange } from "../utils/rnbp-sequence.js";

describe("normalizeRnbpCode", () => {
  it("uppercases input", () => {
    expect(normalizeRnbpCode("rnbp-a2b3c4d5")).toBe("RNBP-A2B3C4D5");
  });

  it("strips external whitespace", () => {
    expect(normalizeRnbpCode("  RNBP-A2B3C4D5  ")).toBe("RNBP-A2B3C4D5");
  });

  it("strips internal spaces (paste artefacts)", () => {
    expect(normalizeRnbpCode("RNBP- A2 B3 C4D5")).toBe("RNBP-A2B3C4D5");
  });
});

describe("codeToInt / intToCode round-trip", () => {
  it("maps the first alphabet position to 0", () => {
    const first = RNBP_ALPHABET[0].repeat(8);
    const code = `RNBP-${first}`;
    expect(codeToInt(code)).toBe(0n);
    expect(intToCode(0n)).toBe(code);
  });

  it("maps the last alphabet position to ALPHABET_SIZE^8 - 1", () => {
    const last = RNBP_ALPHABET[RNBP_ALPHABET.length - 1].repeat(8);
    const code = `RNBP-${last}`;
    const max = BigInt(RNBP_ALPHABET.length) ** 8n - 1n;
    expect(codeToInt(code)).toBe(max);
    expect(intToCode(max)).toBe(code);
  });

  it("round-trips a few mid-range codes", () => {
    const samples = ["RNBP-A2B3C4D5", "RNBP-Z9Y8X7W6", "RNBP-J3K4M5N6"];
    for (const code of samples) {
      expect(intToCode(codeToInt(code))).toBe(code);
    }
  });

  it("rejects codes with characters outside the alphabet", () => {
    expect(() => codeToInt("RNBP-12222222")).toThrow("INVALID_RNBP_FORMAT"); // '1'
    expect(() => codeToInt("RNBP-O2222222")).toThrow("INVALID_RNBP_FORMAT"); // 'O'
    expect(() => codeToInt("RNBP-I2222222")).toThrow("INVALID_RNBP_FORMAT"); // 'I'
    expect(() => codeToInt("RNBP-L2222222")).toThrow("INVALID_RNBP_FORMAT"); // 'L'
  });

  it("rejects wrong prefix or length", () => {
    expect(() => codeToInt("XYZ-A2B3C4D5")).toThrow("INVALID_RNBP_FORMAT");
    expect(() => codeToInt("RNBP-A2B3C4D")).toThrow("INVALID_RNBP_FORMAT");
    expect(() => codeToInt("RNBP-A2B3C4D5X")).toThrow("INVALID_RNBP_FORMAT");
  });
});

describe("expandRange", () => {
  it("returns 10 codes for a 10-code range", () => {
    const codes = expandRange("RNBP-A2222222", "RNBP-A222222B");
    expect(codes).toHaveLength(10);
    expect(codes[0]).toBe("RNBP-A2222222");
    expect(codes[9]).toBe("RNBP-A222222B");
  });

  it("is contiguous (no gaps)", () => {
    const codes = expandRange("RNBP-A2222222", "RNBP-A222222B");
    for (let i = 0; i < codes.length - 1; i++) {
      expect(codeToInt(codes[i + 1]) - codeToInt(codes[i])).toBe(1n);
    }
  });

  it("returns a single code when first === last", () => {
    expect(expandRange("RNBP-A2222222", "RNBP-A2222222")).toEqual(["RNBP-A2222222"]);
  });

  it("normalizes lowercase + whitespace inputs", () => {
    const codes = expandRange("  rnbp-a2222222  ", "rnbp- a2 22222b");
    expect(codes).toHaveLength(10);
    expect(codes[0]).toBe("RNBP-A2222222");
  });

  it("throws INVALID_RANGE when last < first", () => {
    expect(() => expandRange("RNBP-A222222B", "RNBP-A2222222")).toThrow("INVALID_RANGE");
  });

  it("throws INVALID_RANGE when the range exceeds the safety cap", () => {
    // 32^4 = 1_048_576 (well over the 1000 cap), so a 4-char delta blows the limit
    expect(() => expandRange("RNBP-A2222222", "RNBP-A222Z222")).toThrow("INVALID_RANGE");
  });

  it("rejects invalid bound formats", () => {
    expect(() => expandRange("RNBP-A2222222", "RNBP-A222222I")).toThrow("INVALID_RNBP_FORMAT");
  });
});
