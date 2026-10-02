import { routeCraftCapability, type CraftInvocationMode } from "./contextual-craft-router.ts";
import { PILOT_CRAFT_CAPABILITIES } from "./pilot-craft-capabilities.ts";

export const LIVE_CRAFT_CAPABILITIES = Object.freeze(PILOT_CRAFT_CAPABILITIES.map(({ id, domain }) => Object.freeze({ id, domain, available: true })));

export function liveCraftRoute(mode: CraftInvocationMode, context: readonly string[]) {
  const domains = context.flatMap((value) => {
    const normalized = value.toLowerCase();
    return PILOT_CRAFT_CAPABILITIES.filter((capability) =>
      capability.domain === normalized || capability.lessonTopics.some((topic) => topic === normalized),
    ).map((capability) => capability.domain);
  });
  return routeCraftCapability({ mode, context: domains, capabilities: LIVE_CRAFT_CAPABILITIES });
}

export function craftRouteInstruction(mode: CraftInvocationMode, context: readonly string[]) {
  const route = liveCraftRoute(mode, context);
  if (!route.primary) return "";
  return [
    `Craft focus: ${route.primary.domain}. Supporting focus: ${route.supporting.map((capability) => capability.domain).join(", ") || "none"}.`,
    "Use only the supplied curriculum and accepted story context. Capabilities are advisory; they do not create curriculum facts or change canon.",
    mode === "learn" ? "Teach or explain the requested craft concept." : "Return an unaccepted authoring proposal for explicit Human review. Never claim the story has been changed.",
    route.primary.domain === "reader-response" || route.supporting.some((capability) => capability.domain === "reader-response") ? "Label reader reactions as simulated." : "",
  ].filter(Boolean).join("\n");
}

export function craftContextForQuestion(question: string, lessonTopic?: string) {
  const terms = question.toLowerCase().match(/\b(theme|motif|genre|trope|character|scene|dialogue|reader)\b/g) ?? [];
  const aliases: Record<string, string> = { motif: "theme", genre: "genre-tropes", trope: "genre-tropes", reader: "reader-response" };
  return [...new Set([...terms.map((term) => aliases[term] ?? term), ...(lessonTopic ? [lessonTopic] : [])])];
}
