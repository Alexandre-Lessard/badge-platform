/**
 * Centralized error and success codes used by the API and mapped to i18n on the frontend.
 * Backend throws AppError with these codes; frontend maps them to localized messages.
 */

// ── Auth ─────────────────────────────────────────────────────────────
export const INVALID_CREDENTIALS = "INVALID_CREDENTIALS";
export const SOCIAL_ACCOUNT = "SOCIAL_ACCOUNT";
export const EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS";
export const TOKEN_MISSING = "TOKEN_MISSING";
export const TOKEN_INVALID = "TOKEN_INVALID";
export const TOKEN_REVOKED = "TOKEN_REVOKED";
export const USER_NOT_FOUND = "USER_NOT_FOUND";
export const ADMIN_REQUIRED = "ADMIN_REQUIRED";
export const EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED";
export const REFRESH_TOKEN_REQUIRED = "REFRESH_TOKEN_REQUIRED";
export const SESSION_NOT_FOUND = "SESSION_NOT_FOUND";
export const RESET_LINK_INVALID = "RESET_LINK_INVALID";
export const VERIFY_LINK_INVALID = "VERIFY_LINK_INVALID";
export const TOKEN_REQUIRED = "TOKEN_REQUIRED";
export const OAUTH_TOKEN_INVALID = "OAUTH_TOKEN_INVALID";

// ── Items ────────────────────────────────────────────────────────────
export const ITEM_NOT_FOUND = "ITEM_NOT_FOUND";
export const ITEM_ALREADY_STOLEN = "ITEM_ALREADY_STOLEN";
export const ITEM_NOT_STOLEN = "ITEM_NOT_STOLEN";
export const INVALID_ID = "INVALID_ID";
export const ITEMS_NOT_OWNED = "ITEMS_NOT_OWNED";

// ── Files ────────────────────────────────────────────────────────────
export const FILE_TYPE_UNKNOWN = "FILE_TYPE_UNKNOWN";
export const FILE_TYPE_NOT_ALLOWED = "FILE_TYPE_NOT_ALLOWED";
export const FILE_TOO_LARGE = "FILE_TOO_LARGE";

// ── Admin ────────────────────────────────────────────────────────────
export const ORDER_NOT_FOUND = "ORDER_NOT_FOUND";
export const ORDER_LINE_NOT_FOUND = "ORDER_LINE_NOT_FOUND";
export const INVALID_RNBP_FORMAT = "INVALID_RNBP_FORMAT";
export const RNBP_NUMBER_TAKEN = "RNBP_NUMBER_TAKEN";
export const ITEM_DELETED = "ITEM_DELETED";
export const ORDER_NOT_PAID = "ORDER_NOT_PAID";
export const UNASSIGNED_ITEMS = "UNASSIGNED_ITEMS";

// ── Sticker codes ────────────────────────────────────────────────────
export const INVALID_RANGE = "INVALID_RANGE";
export const CODES_ALREADY_EXIST = "CODES_ALREADY_EXIST";
export const CODES_NOT_REGISTERED = "CODES_NOT_REGISTERED";
export const RNBP_CODE_UNKNOWN = "RNBP_CODE_UNKNOWN";
export const RNBP_CODE_NOT_YOURS = "RNBP_CODE_NOT_YOURS";
export const RNBP_CODE_ALREADY_USED = "RNBP_CODE_ALREADY_USED";
export const RNBP_CODE_VOIDED = "RNBP_CODE_VOIDED";
export const CODES_HAVE_CLAIMS = "CODES_HAVE_CLAIMS";

// ── Products ─────────────────────────────────────────────────────────
export const PRODUCT_NOT_FOUND = "PRODUCT_NOT_FOUND";
export const PRODUCT_INACTIVE = "PRODUCT_INACTIVE";

// ── General ──────────────────────────────────────────────────────────
export const TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS";
export const INTERNAL_ERROR = "INTERNAL_ERROR";
export const VALIDATION_ERROR = "VALIDATION_ERROR";

// ── Success codes ────────────────────────────────────────────────────
export const LOGOUT_SUCCESS = "LOGOUT_SUCCESS";
export const PASSWORD_RESET_SENT = "PASSWORD_RESET_SENT";
export const PASSWORD_RESET_SUCCESS = "PASSWORD_RESET_SUCCESS";
export const EMAIL_VERIFIED = "EMAIL_VERIFIED";
export const EMAIL_ALREADY_VERIFIED = "EMAIL_ALREADY_VERIFIED";
export const VERIFICATION_SENT = "VERIFICATION_SENT";
export const MESSAGE_SENT = "MESSAGE_SENT";
export const SUBSCRIPTION_SUCCESS = "SUBSCRIPTION_SUCCESS";
