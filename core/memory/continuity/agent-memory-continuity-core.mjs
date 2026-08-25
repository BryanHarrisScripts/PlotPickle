import { retrieveRelevantMemories } from "../memory-retrieval-core.mjs";

const SAGE_SCOPES = Object.freeze(["human", "project"]);
const AVERY_SCOPES = Object.freeze(["project"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function commandContent(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^[:\s-]+/, "").trim();
}

export function parseSageMemoryCommand(value) {
  const input = text(value);
  if (!input) return null;

  let match = input.match(/^remember\s+(?:for\s+)?(?:all\s+)?(?:my\s+)?projects?\s*[:,-]?\s*(.+)$/i);
  if (match) {
    const content = commandContent(match[1]);
    return content ? Object.freeze({ action: "remember", scope: "human", content }) : null;
  }

  match = input.match(/^remember\s+(?:this|that)\s*[:,-]?\s*(.+)$/i);
  if (match) {
    const content = commandContent(match[1]);
    return content ? Object.freeze({ action: "remember", scope: "project", content }) : null;
  }

  match = input.match(/^remember\s*[:,-]\s*(.+)$/i);
  if (match) {
    const content = commandContent(match[1]);
    return content ? Object.freeze({ action: "remember", scope: "project", content }) : null;
  }

  match = input.match(/^always\s+(.{6,})$/i);
  if (match) {
    const content = commandContent(match[1]);
    return content ? Object.freeze({ action: "remember", scope: "human", content: `Always ${content}` }) : null;
  }

  match = input.match(/^do\s+not\s+suggest\s+(.{4,}?)\s+again[.!]?$/i);
  if (match) {
    const content = commandContent(match[1]);
    return content ? Object.freeze({ action: "remember", scope: "project", content: `Do not suggest ${content} again.` }) : null;
  }

  if (/^forget\s+(?:this|that)[.!]?$/i.test(input)) {
    return Object.freeze({ action: "forget", mode: "latest", query: "" });
  }

  match = input.match(/^forget\s+(?:that\s+)?(.{3,})$/i);
  if (match) {
    const query = commandContent(match[1]).replace(/[.!?]+$/, "").trim();
    return query ? Object.freeze({ action: "forget", mode: "matching", query }) : null;
  }

  return null;
}

export async function retrieveSageContinuity(memoryService, proof, { projectId, text: queryText }) {
  return retrieveRelevantMemories(memoryService, proof, {
    text: text(queryText),
    projectId: text(projectId),
    scopes: SAGE_SCOPES,
    maxResults: 4,
    maxCharacters: 1_800,
  });
}

export async function retrieveAveryContinuity(memoryService, proof, { projectId, text: queryText }) {
  return retrieveRelevantMemories(memoryService, proof, {
    text: text(queryText),
    projectId: text(projectId),
    scopes: AVERY_SCOPES,
    maxResults: 3,
    maxCharacters: 1_200,
  });
}
