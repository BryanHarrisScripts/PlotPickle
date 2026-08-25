import portableConfig from "../../config/agent-profile-extensions/portable-story-pickles.json";
import {
  STORY_PICKLE_PROFILE_IDS,
  buildStoryPickleMintPreparation,
  resolveStoryPickleArtifactState,
  validatePortableStoryPickleConfig,
} from "./story-pickle-agents-core.mjs";

export { STORY_PICKLE_PROFILE_IDS, buildStoryPickleMintPreparation, resolveStoryPickleArtifactState };

export const STORY_PICKLE_PORTABLE_CONFIG = validatePortableStoryPickleConfig(portableConfig);

export function storyPickleContract(profileId: string) {
  if (!STORY_PICKLE_PROFILE_IDS.includes(profileId)) return null;
  return STORY_PICKLE_PORTABLE_CONFIG.contracts[profileId as keyof typeof STORY_PICKLE_PORTABLE_CONFIG.contracts] ?? null;
}
