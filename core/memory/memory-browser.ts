import { authenticatedProfileFetch } from "../auth/profile-request-browser";
import type { MemoryRetrievalResult } from "./memory-retrieval";

async function jsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(body.message || "PlotPickle Memory is unavailable.");
  return body;
}

export async function retrieveSageMemory(projectId: string, query: string) {
  const params = new URLSearchParams({
    agentId: "sage-brinewick",
    projectId,
    q: query,
  });
  const response = await authenticatedProfileFetch(`/api/memory?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  return jsonResponse<{ ok: true; retrieval: MemoryRetrievalResult }>(response);
}

export async function rememberSageMemory(input: Readonly<{
  scope: "human" | "project";
  projectId: string;
  content: string;
}>) {
  const response = await authenticatedProfileFetch("/api/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      action: "remember",
      scope: input.scope,
      projectId: input.projectId,
      content: input.content,
    }),
  });
  return jsonResponse<{ ok: true; action: "remember" }>(response);
}

export async function forgetSageMemory(input: Readonly<{
  projectId: string;
  query?: string;
}>) {
  const response = await authenticatedProfileFetch("/api/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      action: "forget",
      projectId: input.projectId,
      query: input.query || "",
    }),
  });
  return jsonResponse<{ ok: true; action: "forget" }>(response);
}
