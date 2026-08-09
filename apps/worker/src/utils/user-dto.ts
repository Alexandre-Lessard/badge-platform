import type { User } from "@badge/shared";
import { users } from "../db/schema.js";

export const userSelect = {
  id: users.id,
  email: users.email,
  contactEmail: users.contactEmail,
  firstName: users.firstName,
  lastName: users.lastName,
  phone: users.phone,
  address1: users.address1,
  address2: users.address2,
  city: users.city,
  province: users.province,
  postalCode: users.postalCode,
  country: users.country,
  emailVerified: users.emailVerified,
  isAdmin: users.isAdmin,
  clientNumber: users.clientNumber,
  preferredLanguage: users.preferredLanguage,
  termsAcceptedAt: users.termsAcceptedAt,
  createdAt: users.createdAt,
} as const;

type UserRow = {
  id: string;
  email: string;
  contactEmail: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  clientNumber: string | null;
  preferredLanguage: string;
  termsAcceptedAt: Date | null;
  createdAt: Date;
};

export function toUserDto(user: UserRow): User {
  return {
    id: user.id,
    email: user.email,
    contactEmail: user.contactEmail,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    address1: user.address1,
    address2: user.address2,
    city: user.city,
    province: user.province,
    postalCode: user.postalCode,
    country: user.country,
    emailVerified: user.emailVerified,
    isAdmin: user.isAdmin,
    clientNumber: user.clientNumber,
    preferredLanguage: user.preferredLanguage === "en" ? "en" : "fr",
    termsAcceptedAt: user.termsAcceptedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
