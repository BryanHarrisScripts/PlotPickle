const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type ProfileSessionStatus = {
  readonly authenticated?: boolean;
  readonly csrfToken?: string | null;
  readonly message?: string;
};

async function activeHumanCsrfToken() {
  const response = await fetch("/api/auth/profile", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({})) as ProfileSessionStatus;
  const token = typeof body.csrfToken === "string" ? body.csrfToken.trim() : "";
  if (!response.ok || body.authenticated !== true || !token) {
    throw new Error(body.message || "Unlock a PlotPickle Human profile before using account-owned resources.");
  }
  return token;
}

function requestMethod(input: RequestInfo | URL, init: RequestInit) {
  if (init.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function mergedHeaders(input: RequestInfo | URL, init: RequestInit) {
  const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return headers;
}

export async function authenticatedProfileFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = requestMethod(input, init);
  const headers = mergedHeaders(input, init);
  if (!SAFE_HTTP_METHODS.has(method)) {
    headers.set("X-PlotPickle-CSRF", await activeHumanCsrfToken());
  }
  return fetch(input, {
    ...init,
    method,
    credentials: init.credentials ?? "same-origin",
    headers,
  });
}

// Compatibility callers can retain fetch syntax while sharing the same mutation proof.
export function authenticatedComputeFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const raw = typeof Request !== "undefined" && input instanceof Request ? input.url : String(input);
  const url = new URL(raw, window.location.href);
  const prefixes = ["/api/writing-assistant", "/api/media-routing", "/api/ai-routing", "/api/ai-model-catalog", "/api/provider-diagnostics", "/api/local-ai/runtime", "/api/local-ai/plugins", "/api/local-ai/connection", "/api/local-ai/generate", "/api/local-ai/video", "/api/story-mode"];
  if (url.origin === window.location.origin && prefixes.some((prefix) => url.pathname.startsWith(prefix))) return authenticatedProfileFetch(input, init);
  return globalThis.fetch(input, init);
}
