import { describe, expect, it } from "vitest";
import { createItemSchema, updateItemSchema } from "@badge/shared";

const validBase = { name: "Bike", category: "velo-electrique" as const };

describe("createItemSchema — serialNumber / trackerId transform", () => {
  it("preserves undefined when the field is omitted (PATCH skip semantics)", () => {
    const result = createItemSchema.parse(validBase);
    expect(result.serialNumber).toBeUndefined();
    expect(result.trackerId).toBeUndefined();
  });

  it("converts empty string to null (clear semantics)", () => {
    const result = createItemSchema.parse({ ...validBase, serialNumber: "", trackerId: "" });
    expect(result.serialNumber).toBeNull();
    expect(result.trackerId).toBeNull();
  });

  it("converts whitespace-only string to null", () => {
    const result = createItemSchema.parse({ ...validBase, serialNumber: "   ", trackerId: "\t\n " });
    expect(result.serialNumber).toBeNull();
    expect(result.trackerId).toBeNull();
  });

  it("trims non-empty values", () => {
    const result = createItemSchema.parse({
      ...validBase,
      serialNumber: "  SN-123  ",
      trackerId: "  AIRTAG-XYZ  ",
    });
    expect(result.serialNumber).toBe("SN-123");
    expect(result.trackerId).toBe("AIRTAG-XYZ");
  });
});

describe("updateItemSchema — same transform applies via .partial()", () => {
  it("empty string becomes null on PATCH (explicit clear)", () => {
    const result = updateItemSchema.parse({ trackerId: "" });
    expect(result.trackerId).toBeNull();
  });

  it("omitted field stays undefined on PATCH (no-op)", () => {
    const result = updateItemSchema.parse({ name: "x" });
    expect(result.trackerId).toBeUndefined();
    expect(result.serialNumber).toBeUndefined();
  });
});
