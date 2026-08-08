export type User = {
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
  preferredLanguage: "fr" | "en";
  termsAcceptedAt: string | null;
  createdAt: string;
};

export type AuthResponse = {
  user: User;
  accessToken: string;
};
