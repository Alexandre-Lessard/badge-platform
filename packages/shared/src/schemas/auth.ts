import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one digit"),
  firstName: z.string().min(1, "First name required").max(100),
  lastName: z.string().min(1, "Last name required").max(100),
  phone: z.string().max(20).optional(),
  preferredLanguage: z.enum(["fr", "en"]).optional(),
});

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name required").max(100).optional(),
  lastName: z.string().trim().min(1, "Last name required").max(100).optional(),
  contactEmail: z.union([z.string().trim().email("Invalid email address").max(255), z.literal("")]).optional(),
  phone: z.string().trim().max(20).optional(),
  address1: z.string().trim().max(255).optional(),
  address2: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  province: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(2).optional(),
  preferredLanguage: z.enum(["fr", "en"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one digit"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
