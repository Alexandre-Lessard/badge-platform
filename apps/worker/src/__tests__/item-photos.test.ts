import { describe, expect, it } from "vitest";
import { pickPrimaryPhotoUrl, sortPhotosForDisplay } from "../utils/item-photos.js";

describe("pickPrimaryPhotoUrl", () => {
  it("returns the oldest primary photo when one exists", () => {
    const photos = [
      { url: "https://cdn.example.com/first.webp", isPrimary: false },
      { url: "https://cdn.example.com/primary.webp", isPrimary: true },
      { url: "https://cdn.example.com/secondary-primary.webp", isPrimary: true },
    ];

    expect(pickPrimaryPhotoUrl(photos)).toBe("https://cdn.example.com/primary.webp");
  });

  it("falls back to the oldest photo when no primary exists", () => {
    const photos = [
      { url: "https://cdn.example.com/first.webp", isPrimary: false },
      { url: "https://cdn.example.com/second.webp", isPrimary: false },
    ];

    expect(pickPrimaryPhotoUrl(photos)).toBe("https://cdn.example.com/first.webp");
  });
});

describe("sortPhotosForDisplay", () => {
  it("moves the primary photo first while keeping creation order within each group", () => {
    const photos = [
      {
        url: "https://cdn.example.com/oldest.webp",
        isPrimary: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        url: "https://cdn.example.com/primary.webp",
        isPrimary: true,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        url: "https://cdn.example.com/newest.webp",
        isPrimary: false,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      },
    ];

    expect(sortPhotosForDisplay(photos).map((photo) => photo.url)).toEqual([
      "https://cdn.example.com/primary.webp",
      "https://cdn.example.com/oldest.webp",
      "https://cdn.example.com/newest.webp",
    ]);
  });
});
