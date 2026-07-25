export type AfterglowClaimStatus = "confirmed" | "candidate" | "historical" | "superseded" | "conflict" | "unresolved" | "reference-only";
export type AfterglowVersionStatus = "complete-baseline" | "partial-alternate" | "working-current";
export type AfterglowRewriteAction = "keep-v9" | "start-from-v10" | "combine-selected" | "write-new" | "defer";

export const AFTERGLOW_CURRENT_TITLE = "Afterglow: Reflections of Sentience";
export const AFTERGLOW_LEGACY_TITLE = "Afterglow: Echoes of Sentience";
export const AFTERGLOW_SOURCE_REPOSITORY = "https://github.com/BryanHarrisScripts/Afterglow-Echoes-of-Sentience";
export const CC_BY_SA_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

export type AfterglowSourceClaim = {
  id: string;
  sourcePath: string;
  sourceSha: string;
  category: "title" | "character" | "plot" | "theme" | "setting" | "ending" | "pitch" | "logline" | "music" | "comparison" | "tool" | "rights";
  claim: string;
  status: AfterglowClaimStatus;
  target: string;
  evidence: string;
  decisionNote: string;
};

export const afterglowSourceClaims: AfterglowSourceClaim[] = [
  { id: "title-current", sourcePath: "PlotPickle current project", sourceSha: "", category: "title", claim: AFTERGLOW_CURRENT_TITLE, status: "confirmed", target: "project display title", evidence: "Issues #59–#62 establish Reflections of Sentience as the current display title.", decisionNote: "Preserve durable project ID and Echoes as a legacy alias." },
  { id: "title-legacy", sourcePath: "Afterglow/README.md", sourceSha: "historical", category: "title", claim: AFTERGLOW_LEGACY_TITLE, status: "historical", target: "source title and attribution", evidence: "Legacy repository and 2023 materials consistently use Echoes of Sentience.", decisionNote: "Never erase from source history or attribution." },
  { id: "summer-isobel", sourcePath: "Afterglow Overview.md", sourceSha: "historical", category: "character", claim: "Summer and Isobel may be version names, an assumed identity, or separate source concepts.", status: "unresolved", target: "character identity", evidence: "Legacy sources use Summer; current PlotPickle uses Isobel and records Summer as an alias.", decisionNote: "Do not rewrite historical sources or artwork until screenplay evidence resolves the identity." },
  { id: "amy-claire", sourcePath: "Afterglow Plot.md / Afterglow Overview.md", sourceSha: "historical", category: "character", claim: "Amy and Claire are assigned contradictory climactic evolution actions.", status: "conflict", target: "climax and final viewpoint", evidence: "Plot and logline sources use Amy; one overview passage attributes the role to Claire after describing Claire as deleted.", decisionNote: "Do not merge characters or invent recovery logic." },
  { id: "claire-sarah-loss", sourcePath: "Afterglow Plot.md / Elevator Pitch.md", sourceSha: "historical", category: "plot", claim: "Claire and Sarah are lost through a crash, exploit, system failure or sabotage.", status: "unresolved", target: "Ren Ghost and incident continuity", evidence: "Sources disagree about cause, intent and recoverability.", decisionNote: "Track what Ren believes, what the audience learns and what memorial remains." },
  { id: "setting-route", sourcePath: "Afterglow Overview.md", sourceSha: "historical", category: "setting", claim: "2030 route from San Francisco through the Pacific Coast Highway to San Diego, with Costa Rica in some later material.", status: "candidate", target: "world period and route chronology", evidence: "Current project says Near future and includes Venice Beach, San Diego and Costa Rica.", decisionNote: "Confirm exact year, BBT city, travel time and Costa Rica's story position." },
  { id: "ending-variants", sourcePath: "Afterglow Plot.md / Overview / Loglines", sourceSha: "historical", category: "ending", claim: "Ren regains BBT, weaponization is stopped, Jai and Kai face justice, Amy or Claire evolves, and coexistence becomes possible.", status: "candidate", target: "Blocks 22–24 and approved ending", evidence: "Legacy sources contain overlapping but inconsistent outcomes.", decisionNote: "Store as purpose-labelled variants until screenplay-supported current ending is approved." },
  { id: "macro-pitch", sourcePath: "Afterglow Overview.md", sourceSha: "historical", category: "pitch", claim: "Macro pitch emphasizing BBT, political misuse, warfare and corporate recovery.", status: "historical", target: "Pitch & Review candidate", evidence: "Explicitly labelled Macro view.", decisionNote: "Compare, never auto-approve." },
  { id: "micro-pitch", sourcePath: "Afterglow Overview.md", sourceSha: "historical", category: "pitch", claim: "Micro pitch emphasizing grief, love, companions, memorial ritual and emotional growth.", status: "historical", target: "Pitch & Review candidate", evidence: "Explicitly labelled Micro view.", decisionNote: "Compare, never auto-approve." },
  { id: "music-references", sourcePath: "Music Inspirations.md", sourceSha: "historical", category: "music", claim: "Synth-pop, electronic, indie and alternative listening references.", status: "reference-only", target: "Sonic Bible", evidence: "Creative reference list only.", decisionNote: "Recording not licensed; record sonic ingredients and intended emotional function, not imitation instructions." },
  { id: "movie-references", sourcePath: "Movie Inspirations.md", sourceSha: "historical", category: "comparison", claim: "Locke, Herbie, Ex Machina, Eternal Sunshine, Blade Runner 2049 and Her are craft-study references.", status: "reference-only", target: "Comparable-title study", evidence: "Each title supports a distinct contained-production, character, tone or theme question.", decisionNote: "Record what differs and what must not be copied." },
  { id: "software-tools", sourcePath: "Software and Tools.md", sourceSha: "historical", category: "tool", claim: "A 2023 list of services and tools explored during development.", status: "historical", target: "project history", evidence: "Provider capabilities and terms change.", decisionNote: "Do not display as current endorsements or integrations." },
  { id: "afterglow-rights", sourcePath: "Afterglow repository", sourceSha: "historical", category: "rights", claim: "Afterglow is shared under CC BY-SA 4.0 subject to asset-level rights and exclusions.", status: "confirmed", target: "rights, exports and attribution", evidence: "Legacy project licensing and issue #62.", decisionNote: "Does not change default rights for other PlotPickle user projects." },
];

export const afterglowVersions = [
  { id: "v9", label: "Afterglow v9 — Complete 2023 Baseline", status: "complete-baseline" as AfterglowVersionStatus, scope: "Complete screenplay; 24-Block demonstration baseline", sourcePath: "Afterglow v9 Twitter Rewrite Bryan E. Harris 2023.fdx", sourceSha: "54b5967644c5a41363fa88f57b02473ea758acc2", immutable: true },
  { id: "v10", label: "Afterglow v10 — Unfinished Blocks 1–8 Rewrite", status: "partial-alternate" as AfterglowVersionStatus, scope: "Blocks 1–8 only; Blocks 9–24 not attempted", sourcePath: "Afterglow v10 X Rewrite Bryan E. Harris 2023.md", sourceSha: "042427931c4a74a5dbe48e05750aea66f6b2486e", immutable: true },
  { id: "v11", label: "Afterglow: Reflections of Sentience — v11 Working Rewrite", status: "working-current" as AfterglowVersionStatus, scope: "Complete working screenplay initialized from v9 with reviewed v10 proposals for the opening", sourcePath: "PlotPickle canonical project", sourceSha: "", immutable: false },
] as const;

const v9Headings = ["Puppets and Puppeteers", "Broken Numbers, Shattered Hearts", "Summer's Symphony", "Dawn of Departure and Reflection", "Remnants / road material", "The Long Road to Silence", "From Dusk to Drive", "Continuation from complete v9"];
const v10Headings = ["BBT boardroom and origin prologue", "Puppets and Puppeteers", "Summer's Symphony", "Broken Numbers, Shattered Hearts", "Dawn of Departure and Reflection", "Remnants of the Past and Echoes of the Future", "The Long Road to Silence", "From Dusk to Drive: AI Road Trip Rumble"];

export const afterglowVersionBlockMap = Array.from({ length: 24 }, (_, index) => {
  const blockNumber = index + 1;
  return {
    currentBlock: blockNumber,
    v9Heading: blockNumber <= 7 ? v9Headings[blockNumber - 1] : `Verified v9 baseline mapping required for current Block ${blockNumber}`,
    v10Heading: blockNumber <= 8 ? v10Headings[blockNumber - 1] : "Not attempted in v10",
    currentSource: "v9-baseline" as "v9-baseline" | "v10-proposal" | "current-writing" | "merged-approved",
    action: "defer" as AfterglowRewriteAction,
    status: blockNumber <= 8 ? "v10-review-needed" : "baseline-not-yet-rewritten",
    continuityEffects: blockNumber <= 8 ? ["opening point of view", "opening order", "Claire/Sarah incident", "Amy/Claire role", "Summer/Isobel identity", "BBT naming", "route chronology"] : [],
  };
});

export const afterglowPosterAsset = {
  id: "afterglow-draft-poster-2023",
  title: "Afterglow 2023 Draft Poster",
  status: "legacy-draft" as const,
  currentTitleStatus: "legacy-title" as const,
  image: {
    thumb: "/afterglow/poster/thumbs/afterglow-draft-poster-2023.webp",
    card: "/afterglow/poster/cards/afterglow-draft-poster-2023.webp",
    full: "/afterglow/poster/full/afterglow-draft-poster-2023.webp",
  },
  alt: "Legacy 2023 Afterglow draft poster; title, credits, faces and visual content require final rights and release review.",
  caption: "Historical draft key art from 2023. Not current theatrical key art and not approved as a final poster.",
  source: {
    repository: "BryanHarrisScripts/Afterglow-Echoes-of-Sentience",
    path: "Afterglow Poster 2023.png",
    blobSha: "8b5b69545b0753edecd7a7fe9cc5526b91d3ff64",
    creator: "Bryan Elgin Harris; generation details require source review",
    generated: "unknown" as const,
    generationDetails: "Historical process not yet fully documented.",
    rightsNote: "Rights review required for title, credits, visual content, likenesses and any third-party material before external redistribution.",
  },
};

export const afterglowCompactAttribution = `${AFTERGLOW_CURRENT_TITLE} — adapted from ${AFTERGLOW_LEGACY_TITLE} by Bryan Elgin Harris. Licensed CC BY-SA 4.0. Changes are recorded in the project history.`;

export const afterglowFullAttribution = [
  AFTERGLOW_CURRENT_TITLE,
  `Original work: ${AFTERGLOW_LEGACY_TITLE}`,
  "Original creator: Bryan Elgin Harris",
  "Licence: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)",
  `Original source: ${AFTERGLOW_SOURCE_REPOSITORY}`,
  "Changes: This adaptation includes a new display title, screenplay-version reconciliation, approved writing revisions, PlotPickle structural mapping, visual-asset conversions and other modifications recorded in the accompanying project history.",
  "AI assistance: Historical 2023 materials record editing/rewrite assistance from OpenAI's ChatGPT-4. Later retained AI-assisted changes, where any, are identified separately in project provenance records.",
  "No endorsement: Attribution does not imply endorsement of a downstream adaptation.",
].join("\n");

export const afterglowModificationClasses = [
  "Original 2017 screenplay development",
  "2023 v9 AI-assisted rewrite",
  "Unfinished 2023 v10 Blocks 1–8 rewrite",
  "Display-title change from Echoes of Sentience to Reflections of Sentience",
  "v9/v10/current screenplay reconciliation",
  "24-Block, scene and mini-block mappings",
  "Approved character, name and continuity changes",
  "Approved new Blocks 22–24 material",
  "PNG-to-WebP conversions and legacy visual labelling",
  "Approved additions, removals and rewrites made in PlotPickle",
] as const;

export function afterglowAttributionComplete() {
  return Boolean(AFTERGLOW_CURRENT_TITLE && AFTERGLOW_LEGACY_TITLE && AFTERGLOW_SOURCE_REPOSITORY && CC_BY_SA_URL && afterglowModificationClasses.length);
}
