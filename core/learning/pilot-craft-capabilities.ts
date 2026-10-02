export const PILOT_CRAFT_CAPABILITIES = [
  { id: "craft-theme", domain: "theme", lessonTopics: ["theme"], actions: ["explain", "diagnose", "exercise", "compare"] },
  { id: "craft-genre-tropes", domain: "genre-tropes", lessonTopics: ["world", "theme"], actions: ["explain", "diagnose", "exercise", "compare"] },
  { id: "craft-character", domain: "character", lessonTopics: ["character"], actions: ["explain", "diagnose", "exercise", "compare"] },
  { id: "craft-scene", domain: "scene", lessonTopics: ["drafting", "structure"], actions: ["explain", "diagnose", "exercise", "compare"] },
  { id: "craft-dialogue", domain: "dialogue", lessonTopics: ["dialogue"], actions: ["explain", "diagnose", "exercise", "compare"] },
  { id: "craft-reader-response", domain: "reader-response", lessonTopics: ["revision"], actions: ["explain", "diagnose", "compare", "reader-response"] },
] as const;

export type PilotCraftCapabilityId = typeof PILOT_CRAFT_CAPABILITIES[number]["id"];

export function pilotCraftCapability(id: PilotCraftCapabilityId) {
  return PILOT_CRAFT_CAPABILITIES.find((capability) => capability.id === id)!;
}

export const PILOT_CRAFT_GOVERNANCE = Object.freeze({
  invocationModes: ["learn", "authoring-proposal"] as const,
  primaryCapabilityCount: 1,
  maximumSupportingCapabilities: 2,
  canonicalWriteAuthority: false,
  authoringProposalRequiresHumanAcceptance: true,
  readerResponseIsSimulated: true,
  tropesAreAdvisory: true,
});
