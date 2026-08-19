export type AgentPortraitAccessory =
  | "bell"
  | "circlet"
  | "code"
  | "compass"
  | "council"
  | "gate"
  | "iron-quill"
  | "journal"
  | "ledger"
  | "lens"
  | "quill"
  | "scale"
  | "scroll"
  | "staff"
  | "thread";

export type AgentPortraitSpec = {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly hair: string;
  readonly hairHighlight: string;
  readonly cloak: string;
  readonly skin: string;
  readonly accent: string;
  readonly accessory: AgentPortraitAccessory;
  readonly elf?: boolean;
  readonly source?: string;
};

const PORTRAITS: readonly AgentPortraitSpec[] = [
  {
    id: "sage-brinewick",
    displayName: "Sage Brinewick",
    description: "the approved older wizard and curriculum-guide portrait",
    hair: "#d8d4c8",
    hairHighlight: "#f1eee7",
    cloak: "#244b48",
    skin: "#c79b7b",
    accent: "#d7bc76",
    accessory: "staff",
    source: "/assets/curriculum-guide-master-storyteller.png",
  },
  {
    id: "tamsin-hearthquill",
    displayName: "Tamsin Hearthquill",
    description: "a warm story planner with a copper circlet and parchment-clasped robes",
    hair: "#71432f",
    hairHighlight: "#b8784c",
    cloak: "#35584b",
    skin: "#d5a17d",
    accent: "#d7bc76",
    accessory: "circlet",
  },
  {
    id: "master-oaken-vague",
    displayName: "Master Oaken Vague",
    description: "an enigmatic older challenge-master in forest robes",
    hair: "#aaa89f",
    hairHighlight: "#e0ded4",
    cloak: "#314a3b",
    skin: "#c29473",
    accent: "#bd8b48",
    accessory: "staff",
  },
  {
    id: "rowan-scalequill",
    displayName: "Rowan Scalequill",
    description: "a precise evaluator in moss-green and bronze",
    hair: "#4d2c26",
    hairHighlight: "#8b5140",
    cloak: "#405943",
    skin: "#cc9875",
    accent: "#d7bc76",
    accessory: "scale",
  },
  {
    id: "quillan-reedcloak",
    displayName: "Quillan Reedcloak",
    description: "a calm synthesis adviser in a reed-green cloak",
    hair: "#211a18",
    hairHighlight: "#54413a",
    cloak: "#31584b",
    skin: "#b98268",
    accent: "#d7bc76",
    accessory: "quill",
  },
  {
    id: "elowen-mapweaver",
    displayName: "Elowen Mapweaver",
    description: "a map-weaver with braided golden-brown hair and a compass brooch",
    hair: "#7a5132",
    hairHighlight: "#c28a4e",
    cloak: "#27564f",
    skin: "#d8a789",
    accent: "#d7bc76",
    accessory: "compass",
  },
  {
    id: "mira-threadmere",
    displayName: "Mira Threadmere",
    description: "a continuity keeper with deep brown hair and silver thread ornaments",
    hair: "#32231f",
    hairHighlight: "#6d5147",
    cloak: "#3d5360",
    skin: "#c99578",
    accent: "#c8d3d7",
    accessory: "thread",
  },
  {
    id: "critics-circle",
    displayName: "Critics Circle",
    description: "the independent story-review council represented in one ceremonial portrait",
    hair: "#51483f",
    hairHighlight: "#b6aa99",
    cloak: "#443d51",
    skin: "#c49a7a",
    accent: "#d7bc76",
    accessory: "council",
  },
  {
    id: "marquee-director",
    displayName: "The Marquee Director",
    description: "an elegant adult female elf marketing director with luminous red-golden copper hair",
    hair: "#9f4829",
    hairHighlight: "#efab58",
    cloak: "#205a54",
    skin: "#dfab8f",
    accent: "#e2bd68",
    accessory: "circlet",
    elf: true,
  },
  {
    id: "luma-glassfern",
    displayName: "Luma Glassfern",
    description: "a visual-continuity artist with pale-gold hair and glass-green accents",
    hair: "#9c8657",
    hairHighlight: "#d9c58a",
    cloak: "#285f59",
    skin: "#d2a184",
    accent: "#78e0d0",
    accessory: "lens",
  },
  {
    id: "orin-ledgerbark",
    displayName: "Orin Ledgerbark",
    description: "a weathered archive keeper with bronze spectacles and a ledger clasp",
    hair: "#58463d",
    hairHighlight: "#8c7466",
    cloak: "#3a4d40",
    skin: "#b98a6b",
    accent: "#c89446",
    accessory: "ledger",
  },
  {
    id: "merrin-bellwarden",
    displayName: "Merrin Bellwarden",
    description: "a welcoming community bell warden in a teal hood with dark-copper hair",
    hair: "#65402f",
    hairHighlight: "#a96942",
    cloak: "#20594f",
    skin: "#ca9979",
    accent: "#d6a34e",
    accessory: "bell",
  },
  {
    id: "avery-north",
    displayName: "Avery North",
    description: "a first-time-writer observer in practical travel leathers",
    hair: "#6f6144",
    hairHighlight: "#aa986b",
    cloak: "#374b4d",
    skin: "#d0a080",
    accent: "#c7a763",
    accessory: "journal",
  },
  {
    id: "bram-gatewick",
    displayName: "Bram Gatewick",
    description: "a stern evidence gatekeeper in dark armour and bronze trim",
    hair: "#565958",
    hairHighlight: "#969a96",
    cloak: "#2f4140",
    skin: "#b98669",
    accent: "#c89446",
    accessory: "gate",
  },
  {
    id: "rook-ironquill",
    displayName: "Rook Ironquill",
    description: "a bounded repair-handoff steward with an iron-quill insignia",
    hair: "#191817",
    hairHighlight: "#4a4946",
    cloak: "#344144",
    skin: "#b67d62",
    accent: "#a8acad",
    accessory: "iron-quill",
  },
  {
    id: "ben",
    displayName: "BEN",
    description: "a code-quality reviewer in refined teal workshop attire",
    hair: "#30241f",
    hairHighlight: "#68493a",
    cloak: "#274b48",
    skin: "#c38d6d",
    accent: "#65ddce",
    accessory: "code",
  },
  {
    id: "fen-copperwind",
    displayName: "Fen Copperwind",
    description: "a GitHub herald with wind-swept copper hair and a sealed scroll",
    hair: "#914b2e",
    hairHighlight: "#d37a42",
    cloak: "#30534b",
    skin: "#d2a17d",
    accent: "#d7bc76",
    accessory: "scroll",
  },
] as const;

export const AGENT_PORTRAIT_SPECS = new Map(PORTRAITS.map((portrait) => [portrait.id, portrait]));

export function agentPortraitSpec(id: string) {
  return AGENT_PORTRAIT_SPECS.get(id) ?? null;
}

export function agentPortraitIds() {
  return PORTRAITS.map((portrait) => portrait.id);
}
