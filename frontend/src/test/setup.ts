import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Recharts' ResponsiveContainer measures its parent with ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

// React Router's data router builds a `Request` with an AbortSignal. Under jsdom that signal comes from
// jsdom, while `Request` is Node's (undici), which rejects foreign signals. Drop the signal in tests only.
const NodeRequest = globalThis.Request;
class TestRequest extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    const { signal: _signal, ...rest } = init ?? {};
    super(input, rest);
  }
}
vi.stubGlobal("Request", TestRequest);

afterEach(() => {
  cleanup();
  localStorage.clear();
});
