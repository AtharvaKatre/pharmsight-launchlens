import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest, onUnauthorized, setAuthToken } from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  setAuthToken(null);
  onUnauthorized(null);
});

describe("apiRequest", () => {
  it("prefixes /api, sends JSON and attaches the bearer token", async () => {
    setAuthToken("abc.def");
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await expect(apiRequest("/scenarios", { method: "POST", body: { name: "X" } })).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/scenarios");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"name":"X"}');
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer abc.def");
  });

  it("omits the Authorization header when signed out", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await apiRequest("/scenarios");
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("returns undefined for 204 No Content", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiRequest("/scenarios/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("calls the unauthorized handler on 401 for an authenticated request", async () => {
    const handler = vi.fn();
    onUnauthorized(handler);
    setAuthToken("expired");
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: "Not authenticated" }));

    await expect(apiRequest("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not treat a failed login (401 without a token) as an expired session", async () => {
    const handler = vi.fn();
    onUnauthorized(handler);
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: "Incorrect email or password" }));

    await expect(apiRequest("/auth/login", { method: "POST", body: {} })).rejects.toThrow("Incorrect email or password");
    expect(handler).not.toHaveBeenCalled();
  });

  it("turns 403 into a permission message", async () => {
    setAuthToken("t");
    fetchMock.mockResolvedValue(jsonResponse(403, { detail: "Only Forecasters can perform this action" }));

    const error = await apiRequest("/scenarios/1", { method: "DELETE" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isForbidden).toBe(true);
    expect((error as ApiError).message).toBe("You don't have permission to do this. Only Forecasters can perform this action.");
  });

  it("exposes 422 validation issues", async () => {
    const detail = [{ loc: ["body", "years", 0, "uptake_pct"], msg: "Input should be less than or equal to 100", type: "x" }];
    fetchMock.mockResolvedValue(jsonResponse(422, { detail }));

    const error = (await apiRequest("/scenarios/1", { method: "PUT", body: {} }).catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(422);
    expect(error.issues).toEqual(detail);
  });

  it("reports network failures with status 0", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiRequest("/scenarios")).rejects.toMatchObject({ status: 0 });
  });

  it("gives a generic message for server errors without a JSON body", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 500 }));
    await expect(apiRequest("/scenarios")).rejects.toThrow(/server had a problem/);
  });
});
