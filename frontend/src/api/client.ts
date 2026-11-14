import type { ValidationIssue } from "./types";

/** Error raised for any failed API call. `status` is 0 when the server could not be reached. */
export class ApiError extends Error {
  readonly status: number;
  readonly issues: ValidationIssue[];

  constructor(status: number, message: string, issues: ValidationIssue[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** Register a callback for 401 responses to authenticated requests (expired or revoked session). */
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

export async function apiRequest<T>(path: string, { method = "GET", body }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const sentToken = authToken;
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Unable to reach the PharmSight server. Check your connection and try again.");
  }

  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // A 401 on an authenticated request means the session is no longer valid.
    // (A 401 from the login form itself is just a wrong password.)
    if (response.status === 401 && sentToken) unauthorizedHandler?.();
    throw toApiError(response.status, data);
  }
  return data as T;
}

function toApiError(status: number, data: unknown): ApiError {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (Array.isArray(detail)) {
    return new ApiError(status, "Some values are invalid. Review the highlighted fields.", detail as ValidationIssue[]);
  }
  if (typeof detail === "string") {
    return new ApiError(status, status === 403 ? `You don't have permission to do this. ${detail}.` : detail);
  }
  if (status >= 500) return new ApiError(status, `The server had a problem handling this request (${status}). Please try again.`);
  return new ApiError(status, `Request failed (${status}).`);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
