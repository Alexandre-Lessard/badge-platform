import { describe, expect, it } from "vitest";
import { toUserDto } from "../utils/user-dto.js";

describe("toUserDto", () => {
  it("serializes the full user shape expected by /auth/me", () => {
    const dto = toUserDto({
      id: "user-123",
      email: "person@example.com",
      contactEmail: null,
      firstName: "Alex",
      lastName: "Martin",
      phone: "514-555-1234",
      address1: "123 Rue Principale",
      address2: "Bureau 5",
      city: "Montreal",
      province: "QC",
      postalCode: "H1H1H1",
      country: "CA",
      emailVerified: true,
      isAdmin: false,
      clientNumber: "123456789",
      preferredLanguage: "fr",
      termsAcceptedAt: new Date("2026-04-20T10:00:00.000Z"),
      createdAt: new Date("2026-04-19T09:00:00.000Z"),
    });

    expect(dto).toEqual({
      id: "user-123",
      email: "person@example.com",
      contactEmail: null,
      firstName: "Alex",
      lastName: "Martin",
      phone: "514-555-1234",
      address1: "123 Rue Principale",
      address2: "Bureau 5",
      city: "Montreal",
      province: "QC",
      postalCode: "H1H1H1",
      country: "CA",
      emailVerified: true,
      isAdmin: false,
      clientNumber: "123456789",
      preferredLanguage: "fr",
      termsAcceptedAt: "2026-04-20T10:00:00.000Z",
      createdAt: "2026-04-19T09:00:00.000Z",
    });
  });
});
