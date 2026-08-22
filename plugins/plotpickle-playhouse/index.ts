import communityConfig from "./community.json";
import { AGENT_PROFILES } from "../../lib/agent-profiles";
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

type CommunityConfig = {
  readonly schemaVersion: number;
  readonly communityId: string;
  readonly displayName: string;
  readonly rooms: readonly {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly actionHint: string;
  }[];
  readonly helpGroups: readonly {
    readonly id: string;
    readonly label: string;
    readonly description: string;
  }[];
  readonly agents: readonly {
    readonly profileId: string;
    readonly shortBio: string;
    readonly helpPrompt: string;
    readonly helpGroup: string;
    readonly roomIds: readonly string[];
  }[];
};

const config = communityConfig as unknown as CommunityConfig;
if (config.schemaVersion !== 1) throw new Error(`Unsupported PlotPicklePlayhouse plugin schema: ${config.schemaVersion}.`);

const profileById = new Map(AGENT_PROFILES.map((profile) => [profile.id, profile]));

export const PLOTPICKLE_PLAYHOUSE_PLUGIN = defineCommunityExtensionPlugin({
  manifest,
  communityId: config.communityId,
  displayName: config.displayName,
  rooms: config.rooms,
  helpGroups: config.helpGroups,
  agents: config.agents.map((entry) => {
    const profile = profileById.get(entry.profileId);
    if (!profile?.publicPresentation) throw new Error(`Playhouse plugin references a non-public Agent Profile: ${entry.profileId}.`);
    return {
      profileId: profile.id,
      displayName: profile.displayName,
      title: profile.title,
      avatarRef: profile.publicPresentation.avatarRef,
      shortBio: entry.shortBio,
      publicBio: profile.publicPresentation.publicBio,
      helpPrompt: entry.helpPrompt,
      helpGroup: entry.helpGroup,
      roomIds: entry.roomIds,
      officialBuzzPubkey: profile.publicPresentation.officialBuzzIdentity.pubkey,
    };
  }),
});

export const PLOTPICKLE_COMMUNITY_EXTENSIONS = createCommunityExtensionSnapshot([
  PLOTPICKLE_PLAYHOUSE_PLUGIN,
]);
