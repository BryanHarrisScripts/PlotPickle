// Shared loopback-only ComfyUI endpoint contract for dashboard and media routing.
export const DEFAULT_COMFYUI_BASE_URL = "http://127.0.0.1:8188";

export function normalizeComfyUIBaseUrl(value: unknown) {
  const source = typeof value === "string" ? value.trim() : "";
  const url = new URL(source || DEFAULT_COMFYUI_BASE_URL);
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(hostname)) {
    throw new Error("ComfyUI must use a local loopback address such as http://127.0.0.1:8188.");
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== "/")) {
    throw new Error("Enter only the local ComfyUI server address, without credentials, a path, query string or fragment.");
  }
  const port = url.port || "8188";
  const portNumber = Number(port);
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    throw new Error("Choose a valid local ComfyUI port between 1 and 65535.");
  }
  return `http://${hostname}:${portNumber}`;
}

export function comfyUIUrl(baseUrl: unknown, pathname: string) {
  const root = normalizeComfyUIBaseUrl(baseUrl);
  const suffix = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${root}${suffix}`;
}
