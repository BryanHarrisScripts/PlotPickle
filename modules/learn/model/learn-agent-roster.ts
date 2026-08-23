import agentProfiles from "../../../config/agent-profiles.json";

const LEARN_WIZARD_IDS = [
  "sage-brinewick",
  "tamsin-hearthquill",
  "master-oaken-vague",
  "rowan-scalequill",
  "quillan-reedcloak",
] as const;

export type LearnWizardAgentId = (typeof LEARN_WIZARD_IDS)[number];

export type LearnWizardAgent = {
  readonly id: LearnWizardAgentId;
  readonly displayName: string;
  readonly title: string;
  readonly responsibility: string;
  readonly available: boolean;
  readonly destination: "learn" | "plan" | null;
  readonly lockedReason: string;
};

export function learnWizardRoster(): readonly LearnWizardAgent[] {
  return LEARN_WIZARD_IDS.map((id) => {
    const profile = agentProfiles.profiles.find((item) => item.id === id);
    if (!profile) throw new Error(`Canonical PlotPickle agent profile is missing: ${id}.`);
    const available = id === "sage-brinewick" || id === "tamsin-hearthquill";
    return {
      id,
      displayName: profile.displayName,
      title: profile.title,
      responsibility: profile.responsibility,
      available,
      destination: id === "sage-brinewick" ? "learn" : id === "tamsin-hearthquill" ? "plan" : null,
      lockedReason: available ? "" : "Unlocks later in the PlotPickle journey",
    };
  });
}
