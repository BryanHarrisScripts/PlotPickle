import { BUZZ_GUILDHALL_ACTORS } from "./buzz-guildhall";

export type RawCommunityActivity = {
  id: string;
  content: string;
  author: string;
  createdAt: string;
};

export type CommunityConversationItem = RawCommunityActivity & {
  role: string;
  originStudio: string;
  room: string;
  speakerType: "human" | "agent";
  badge: "" | "Synthetic Agent" | "Synthetic Writer";
};

type ParsedGuildhallEvent = {
  displayName: string;
  title: string;
  summary: string;
  type: string;
};

const EVENT_METADATA = /^(?:type|project|target|occurred|route)=/i;
const EVIDENCE_LINE = /^evidence:\s/i;
const WINDOWS_PATH = /\b[A-Za-z]:\\(?:Users|ProgramData|Windows|Temp|AppData)\\[^\s<>"']+/gi;
const POSIX_PATH = /\/(?:home|Users|tmp|var\/tmp)\/[^\s<>"']+/gi;
const RAW_HASH = /\b[a-f0-9]{64}\b/gi;
const TRANSPORT_ID = /\b(?:event|message|delivery|transport|route)[-_ ]?id\s*[=:]\s*[^\s,;]+/gi;

function cleanHumanText(value: string) {
  return value
    .replace(/nsec1[a-z0-9]+/gi, "[private credential hidden]")
    .replace(RAW_HASH, "[technical reference hidden]")
    .replace(TRANSPORT_ID, "[technical reference hidden]")
    .replace(WINDOWS_PATH, "[local path hidden]")
    .replace(POSIX_PATH, "[local path hidden]")
    .trim();
}

function parseGuildhallEvent(content: string): ParsedGuildhallEvent | null {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return null;
  const header = lines[0].match(/^\[([^\]·]+?)\s*·\s*([^\]]+?)\]$/);
  const metadata = lines.find((line) => /^type=/.test(line));
  if (!header || !metadata) return null;
  const type = metadata.match(/^type=([^\s]+)/)?.[1] || "";
  if (!type) return null;
  return {
    displayName: header[1].trim(),
    title: header[2].trim(),
    summary: cleanHumanText(lines[1]),
    type,
  };
}

function actorFor(displayName: string, fallbackAuthor: string) {
  const names = [displayName, fallbackAuthor].map((value) => value.trim().toLowerCase()).filter(Boolean);
  return BUZZ_GUILDHALL_ACTORS.find((actor) => names.includes(actor.displayName.toLowerCase()) || names.includes(actor.id.toLowerCase())) ?? null;
}

function actorBadge(kind: string | undefined): CommunityConversationItem["badge"] {
  if (kind === "synthetic-writer") return "Synthetic Writer";
  if (kind === "product-agent" || kind === "buzz-native-agent") return "Synthetic Agent";
  return "";
}

function displayAuthor(name: string, role: string, badge: CommunityConversationItem["badge"]) {
  return [name, role, badge].filter(Boolean).join(" · ");
}

function looksOperational(content: string) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const markers = lines.filter((line) => EVENT_METADATA.test(line) || EVIDENCE_LINE.test(line)).length;
  return markers >= 2
    || /\b(?:uat|runtime|repair|github)\.(?:result|alert|request|status)\b/i.test(content)
    || /\b(?:PASS|FAIL)\b.*\b(?:UAT|verification|health check|CI)\b/i.test(content);
}

export function projectCommunityConversation(activity: RawCommunityActivity): CommunityConversationItem | null {
  const parsed = parseGuildhallEvent(activity.content);
  if (parsed) {
    // Only intentional agent notes belong in ordinary Great Hall conversation.
    // Every other Guildhall event stays available to BUZZ/diagnostic tooling but
    // is excluded from the human-facing feed.
    if (parsed.type !== "agent.note") return null;
    const actor = actorFor(parsed.displayName, activity.author);
    const role = parsed.title || actor?.title || "";
    const badge = actorBadge(actor?.kind) || "Synthetic Agent";
    const name = parsed.displayName || actor?.displayName || "PlotPickle agent";
    return {
      ...activity,
      content: parsed.summary,
      author: displayAuthor(name, role, badge),
      role,
      originStudio: "",
      room: "Great Hall",
      speakerType: "agent",
      badge,
    };
  }

  if (looksOperational(activity.content)) return null;
  const actor = actorFor("", activity.author);
  const role = actor?.title || "";
  const badge = actorBadge(actor?.kind);
  const authorLooksTechnical = /^[a-f0-9]{32,}$/i.test(activity.author.trim());
  const name = authorLooksTechnical ? "Community member" : activity.author || "Community member";
  return {
    ...activity,
    content: cleanHumanText(activity.content),
    author: actor ? displayAuthor(name, role, badge) : name,
    role,
    originStudio: "",
    room: "Great Hall",
    speakerType: actor ? "agent" : "human",
    badge,
  };
}

export function projectCommunityConversationFeed(activity: RawCommunityActivity[]) {
  return activity.flatMap((item) => {
    const projected = projectCommunityConversation(item);
    return projected ? [projected] : [];
  });
}
