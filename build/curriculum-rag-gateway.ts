import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";

const API_PATH = "/api/local-ai/curriculum-rag";
const HEALTH_PATH = `${API_PATH}/health`;
const DEFAULT_RAG_URL = "http://127.0.0.1:8091";
const MAX_DOCUMENTS = 4096;
const MAX_CONTEXT_CHARACTERS = 6_500;

type RagDocument = {
  id: string;
  text: string;
  context: string;
  lessonId: string;
  sourceId: string;
};

type RagResult = {
  id: string;
  rank: number;
  embeddingScore: number;
  rerankScore: number;
};

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage, maximum = 8 * 1024 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > maximum) throw new Error("The curriculum retrieval request is too large.");
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Enter a valid curriculum retrieval request.");
  return parsed as Record<string, unknown>;
}

function normalizedDocuments(value: unknown): RagDocument[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_DOCUMENTS).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const document = item as Partial<RagDocument>;
    if (typeof document.id !== "string" || typeof document.text !== "string" || typeof document.context !== "string") return [];
    if (typeof document.lessonId !== "string") return [];
    return [{
      id: document.id.slice(0, 300),
      text: document.text.replace(/\s+/g, " ").trim().slice(0, 1_800),
      context: document.context.trim().slice(0, 2_400),
      lessonId: document.lessonId.slice(0, 200),
      sourceId: typeof document.sourceId === "string" ? document.sourceId.slice(0, 300) : "",
    }];
  }).filter((item) => item.id && item.text && item.context);
}

async function serviceHealth() {
  const baseUrl = process.env.PLOTPICKLE_RAG_URL?.trim().replace(/\/$/, "") || DEFAULT_RAG_URL;
  try {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(1_500),
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    return { reachable: response.ok, baseUrl, ...body };
  } catch (error) {
    return {
      reachable: false,
      baseUrl,
      device: "cpu",
      embeddingModel: "Qwen/Qwen3-Embedding-0.6B",
      rerankerModel: "Qwen/Qwen3-Reranker-0.6B",
      error: error instanceof Error ? error.message : "Curriculum RAG is not running.",
    };
  }
}

async function semanticRetrieve(query: string, documents: RagDocument[]) {
  const baseUrl = process.env.PLOTPICKLE_RAG_URL?.trim().replace(/\/$/, "") || DEFAULT_RAG_URL;
  const response = await fetch(`${baseUrl}/retrieve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query,
      documents: documents.map(({ id, text }) => ({ id, text })),
      candidateK: 48,
      topK: 12,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await response.json().catch(() => ({})) as {
    message?: string;
    embeddingModel?: string;
    rerankerModel?: string;
    device?: string;
    results?: RagResult[];
  };
  if (!response.ok || !Array.isArray(body.results)) {
    throw new Error(body.message || "The local curriculum retrieval service did not return ranked passages.");
  }
  return body;
}

function assembleBoundedContext(documents: RagDocument[], ranked: RagResult[], activeDocumentId: string) {
  const byId = new Map(documents.map((document) => [document.id, document]));
  const orderedIds = [activeDocumentId, ...ranked.map((item) => item.id)].filter(Boolean);
  const unique = [...new Set(orderedIds)];
  const selected: RagDocument[] = [];
  let used = 0;
  for (const id of unique) {
    const document = byId.get(id);
    if (!document) continue;
    const addition = document.context.length + (selected.length ? 2 : 0);
    if (selected.length && used + addition > MAX_CONTEXT_CHARACTERS) continue;
    selected.push(document);
    used += addition;
    if (used >= MAX_CONTEXT_CHARACTERS) break;
  }
  return {
    context: selected.map((document) => document.context).join("\n\n"),
    lessonIds: [...new Set(selected.map((document) => document.lessonId))],
    lessonChunkIds: selected.filter((document) => !document.sourceId).map((document) => document.id),
    sourceIds: [...new Set(selected.flatMap((document) => document.sourceId ? [document.sourceId] : []))],
    sourceChunkIds: selected.filter((document) => document.sourceId).map((document) => document.id),
  };
}

export function registerCurriculumRagGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== API_PATH && pathname !== HEALTH_PATH) {
      next();
      return;
    }
    if (!isLocalRequest(request)) {
      sendJson(response, 403, { ok: false, message: "Curriculum retrieval is restricted to this PlotPickle server." });
      return;
    }
    void (async () => {
      if (pathname === HEALTH_PATH && request.method === "GET") {
        const health = await serviceHealth();
        sendJson(response, health.reachable ? 200 : 503, { ok: health.reachable, ...health });
        return;
      }
      if (pathname === API_PATH && request.method === "POST") {
        const body = await readBody(request);
        const query = typeof body.query === "string" ? body.query.trim().slice(0, 2_000) : "";
        const activeDocumentId = typeof body.activeDocumentId === "string" ? body.activeDocumentId.slice(0, 300) : "";
        const documents = normalizedDocuments(body.documents);
        if (!query || !documents.length) throw new Error("A question and curriculum passages are required for retrieval.");
        const result = await semanticRetrieve(query, documents);
        sendJson(response, 200, {
          ok: true,
          retrieval: assembleBoundedContext(documents, result.results || [], activeDocumentId),
          engine: {
            embeddingModel: result.embeddingModel || "Qwen/Qwen3-Embedding-0.6B",
            rerankerModel: result.rerankerModel || "Qwen/Qwen3-Reranker-0.6B",
            device: result.device || "cpu",
          },
        });
        return;
      }
      sendJson(response, 405, { ok: false, message: "Method not allowed." });
    })().catch((error) => {
      sendJson(response, 503, {
        ok: false,
        message: error instanceof Error ? error.message : "Curriculum semantic retrieval is unavailable.",
        fallback: "lexical-bounded",
      });
    });
  });
}
