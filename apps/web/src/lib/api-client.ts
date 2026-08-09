const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787/api";

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export type ApiError = Error & { status: number; code?: string };

export function isNetworkError(err: unknown): boolean {
  return (err as ApiError)?.code === "NETWORK_ERROR";
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const error = new Error("Service temporarily unavailable") as ApiError;
    error.status = 0;
    error.code = "NETWORK_ERROR";
    throw error;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message =
      data?.error?.message || `Error ${response.status}`;
    const error = new Error(message) as ApiError;
    error.status = response.status;
    error.code = data?.error?.code;
    throw error;
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

/**
 * Upload files via multipart/form-data.
 * Does NOT set Content-Type (browser adds boundary automatically).
 */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });
  } catch {
    const error = new Error("Service temporarily unavailable") as ApiError;
    error.status = 0;
    error.code = "NETWORK_ERROR";
    throw error;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data?.error?.message || `Error ${response.status}`;
    const error = new Error(message) as ApiError;
    error.status = response.status;
    error.code = data?.error?.code;
    throw error;
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
