import { publicAgentProfiles } from "../../lib/agent-profiles";
import {
  createCommunityExtensionSnapshot,
  defineCommunityExtensionPlugin,
} from "../../lib/community-extension-plugin";
import { PLUGIN_API_VERSION, type PluginManifest } from "../../lib/plugin-platform";

const manifest: PluginManifest = {
  id: "org.plotpickle.playhouse",
  name: "PlotPicklePlayhouse",
  version: "1.0.0",
  apiVersion: PLUGIN_API_VERSION,
  author: "PlotPickle",
  description: "Default PlotPickle Community rooms, public Agent directory, Help presentation, and BUZZ provisioning plan.",
  entryPoint: "plugins/plotpickle-playhouse/index.js",
  minimumPlotPickleVersion: "1.0.0-rc.3",
  permissions: [],
  capabilities: ["community", "agent-directory", "buzz-agent-provisioner"],
  dependencies: {},
  commands: [],
  menus: [],
  panels: [],
};

export const PLOTPICKLE_PLAYHOUSE_PLUGIN = defineCommunityExtensionPlugin({
  manifest,
  communityId: "plotpickle-playhouse",
  displayName: "PlotPicklePlayhouse",
  rooms: [
    {
      id: "great-hall",
      label: "Great Hall",
      description: "General Community conversation, welcome, questions and handoffs.",
      actionHint: "Meet people, ask where to go, or continue a general PlotPickle conversation.",
    },
    {
      id: "story-council",
      label: "Story Workshop",
      description: "Planning, structure, characters, continuity and story critique.",
      actionHint: "Bring a story question, planning problem, character issue, or draft concern.",
    },
    {
      id: "wyrmwood-ring",
      label: "Wyrmwood",
      description: "Curriculum challenges, game discussion and lesson evaluation.",
      actionHint: "Work through Wyrmwood challenges or ask about the lesson behind a result.",
    },
    {
      id: "marquee",
      label: "Marquee",
      description: "Visual development, posters, key art and promotion.",
      actionHint: "Develop campaign visuals, poster ideas, key art, teasers, or trailer concepts.",
    },
  ],
  helpGroups: [
    {
      id: "writing-story",
      label: "Writing & Story",
      description: "Helpers who teach, plan, challenge and strengthen the story you are making.",
    },
    {
      id: "creative-visual",
      label: "Creative & Visual",
      description: "Helpers who develop posters, key art, teasers and other visual storytelling material.",
    },
    {
      id: "community",
      label: "Community",
      description: "Helpers who welcome you, find earlier decisions and explain verified PlotPicklePlayhouse context.",
    },
  ],
  agents: publicAgentProfiles().flatMap((profile) => {
    const presentation = profile.publicPresentation;
    if (!presentation) return [];
    return [{
      profileId: profile.id,
      displayName: profile.displayName,
      title: profile.title,
      avatarRef: presentation.avatarRef,
      shortBio: presentation.shortBio,
      publicBio: presentation.publicBio,
      helpPrompt: presentation.helpPrompt,
      helpGroup: presentation.helpGroup,
      roomIds: presentation.communityRoomIds,
      officialBuzzPubkey: presentation.officialBuzzIdentity.pubkey,
    }];
  }),
});

export const PLOTPICKLE_COMMUNITY_EXTENSIONS = createCommunityExtensionSnapshot([
  PLOTPICKLE_PLAYHOUSE_PLUGIN,
]);
