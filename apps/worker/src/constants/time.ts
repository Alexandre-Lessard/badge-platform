/** Centralized token/session expiry durations (in milliseconds) */
export const TOKEN_EXPIRY = {
  /** Refresh token / session: 7 days */
  SESSION: 7 * 24 * 60 * 60 * 1000,
  /** Email verification token: 24 hours */
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  /** Password reset token: 1 hour */
  PASSWORD_RESET: 60 * 60 * 1000,
} as const;
