/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const PUBLIC_WEB_REQUEST_HEADER = "x-plotpickle-public-web";
const PUBLIC_WEB_HOSTS = new Set([
  "plotpickle.com",
  "plotpickle.avairis.chatgpt.site",
]);

function isPublicWebHost(hostname: string): boolean {
  return PUBLIC_WEB_HOSTS.has(hostname.toLowerCase());
}

function withPublicWebRequest(request: Request, url: URL): Request {
  const rewritten = new Request(url, request);
  const headers = new Headers(rewritten.headers);
  headers.set(PUBLIC_WEB_REQUEST_HEADER, "1");
  return new Request(rewritten, { headers });
}

function withoutPublicWebRequest(request: Request): Request {
  if (!request.headers.has(PUBLIC_WEB_REQUEST_HEADER)) return request;
  const headers = new Headers(request.headers);
  headers.delete(PUBLIC_WEB_REQUEST_HEADER);
  return new Request(request, { headers });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === "www.plotpickle.com") {
      const canonical = new URL(request.url);
      canonical.hostname = "plotpickle.com";
      canonical.protocol = "https:";
      canonical.port = "";
      return Response.redirect(canonical.toString(), 308);
    }

    if (
      isPublicWebHost(url.hostname)
      && (url.pathname === "/skin-v1" || url.pathname.startsWith("/skin-v1/"))
    ) {
      const publicHome = new URL(request.url);
      publicHome.pathname = "/";
      publicHome.search = "";
      publicHome.hash = "";
      return Response.redirect(publicHome.toString(), 307);
    }

    if (isPublicWebHost(url.hostname) && url.pathname === "/") {
      const publicUrl = new URL(request.url);
      publicUrl.pathname = "/site";
      return handler.fetch(withPublicWebRequest(request, publicUrl), env, ctx);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(withoutPublicWebRequest(request), env, ctx);
  },
};

export default worker;
