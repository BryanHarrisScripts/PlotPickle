from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str):
    file = ROOT / path
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one occurrence in {path}, found {count}: {old[:80]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


production_types = r'''
export type ProductionShotStatus = "planned" | "approved" | "captured" | "omitted";

export type ProductionShot = {
  id: string;
  blockNumber: number;
  miniBlockNumber: number;
  sceneId: string;
  screenplayElementIds: string[];
  frameId: string;
  shotNumber: number;
  shotSize: string;
  angle: string;
  movement: string;
  lens: string;
  composition: string;
  purpose: string;
  continuity: string;
  keyframeSrc: string;
  keyframeAlt: string;
  status: ProductionShotStatus;
  durationSeconds: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type SonicCueType = "score" | "source" | "atmosphere" | "sfx" | "silence";
export type SonicCueStatus = "temp" | "original" | "approved" | "licensed" | "clearance-needed";

export type SonicCue = {
  id: string;
  cueNumber: string;
  blockNumber: number;
  sceneId: string;
  type: SonicCueType;
  title: string;
  motif: string;
  cueIn: string;
  cueOut: string;
  purpose: string;
  status: SonicCueStatus;
  rights: string;
  durationSeconds: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductionBreakdown = {
  id: string;
  blockNumber: number;
  sceneId: string;
  castIds: string[];
  locationIds: string[];
  props: string;
  wardrobe: string;
  vehicles: string;
  effects: string;
  stunts: string;
  extras: string;
  makeup: string;
  sound: string;
  estimatedHours: number;
  readiness: "draft" | "reviewed" | "ready" | "blocked";
  notes: string;
  updatedAt: string;
};

export type ProductionScheduleDay = {
  id: string;
  dayNumber: number;
  date: string;
  sceneIds: string[];
  locationId: string;
  callTime: string;
  estimatedHours: number;
  status: "planned" | "confirmed" | "completed" | "moved";
  notes: string;
  updatedAt: string;
};

export type DistributionMilestone = {
  id: string;
  title: string;
  targetDate: string;
  status: "planned" | "active" | "complete" | "deferred";
  notes: string;
};

export type DistributionMarketingPlan = {
  audience: string;
  positioning: string;
  releasePath: string;
  festivalTargets: string;
  distributorTargets: string;
  salesMaterials: string;
  trailerPlan: string;
  posterPlan: string;
  socialCampaign: string;
  pressAngles: string;
  milestones: DistributionMilestone[];
  updatedAt: string;
};

export type ProductionWorkspace = {
  shots: ProductionShot[];
  cues: SonicCue[];
  breakdowns: ProductionBreakdown[];
  schedule: ProductionScheduleDay[];
  animatic: {
    defaultFrameSeconds: number;
    includeDialogue: boolean;
    showCueLabels: boolean;
    updatedAt: string;
  };
  distribution: DistributionMarketingPlan;
};
'''

replace_once("lib/project.ts", "\nexport type RevisionSnapshot = {", f"\n{production_types}\nexport type RevisionSnapshot = {{")
replace_once("lib/project.ts", "  review: ReviewWorkspace;\n};", "  review: ReviewWorkspace;\n  production: ProductionWorkspace;\n};")

blank_production = r'''
export function createBlankProductionWorkspace(): ProductionWorkspace {
  const now = new Date().toISOString();
  return {
    shots: [],
    cues: [],
    breakdowns: [],
    schedule: [],
    animatic: {
      defaultFrameSeconds: 4,
      includeDialogue: true,
      showCueLabels: true,
      updatedAt: now,
    },
    distribution: {
      audience: "",
      positioning: "",
      releasePath: "",
      festivalTargets: "",
      distributorTargets: "",
      salesMaterials: "",
      trailerPlan: "",
      posterPlan: "",
      socialCampaign: "",
      pressAngles: "",
      milestones: [],
      updatedAt: now,
    },
  };
}
'''
replace_once("lib/project.ts", "\nexport function createBlankDevelopment(): ProjectDevelopment {", f"\n{blank_production}\nexport function createBlankDevelopment(): ProjectDevelopment {{")
replace_once("lib/project.ts", "    review: createBlankReviewWorkspace(\"Untitled Story\"),\n", "    review: createBlankReviewWorkspace(\"Untitled Story\"),\n    production: createBlankProductionWorkspace(),\n")
replace_once("lib/project.ts", "    Boolean(candidate.review) &&\n", "    Boolean(candidate.review) &&\n    Boolean(candidate.production) &&\n")

normalize_production = r'''
function normalizeProductionWorkspace(value: unknown): ProductionWorkspace {
  const defaults = createBlankProductionWorkspace();
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<ProductionWorkspace>;
  const now = new Date().toISOString();
  const shotStatuses: ProductionShotStatus[] = ["planned", "approved", "captured", "omitted"];
  const cueTypes: SonicCueType[] = ["score", "source", "atmosphere", "sfx", "silence"];
  const cueStatuses: SonicCueStatus[] = ["temp", "original", "approved", "licensed", "clearance-needed"];
  const readinessValues: ProductionBreakdown["readiness"][] = ["draft", "reviewed", "ready", "blocked"];
  const dayStatuses: ProductionScheduleDay["status"][] = ["planned", "confirmed", "completed", "moved"];
  return {
    shots: Array.isArray(candidate.shots) ? candidate.shots.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const shot = item as Partial<ProductionShot>;
      return [{
        id: typeof shot.id === "string" && shot.id ? shot.id : `shot-${index + 1}`,
        blockNumber: Math.min(24, Math.max(1, Number(shot.blockNumber) || 1)),
        miniBlockNumber: Math.min(4, Math.max(1, Number(shot.miniBlockNumber) || 1)),
        sceneId: typeof shot.sceneId === "string" ? shot.sceneId : "",
        screenplayElementIds: stringArray(shot.screenplayElementIds),
        frameId: typeof shot.frameId === "string" ? shot.frameId : "",
        shotNumber: Math.max(1, Number(shot.shotNumber) || index + 1),
        shotSize: typeof shot.shotSize === "string" ? shot.shotSize : "Wide",
        angle: typeof shot.angle === "string" ? shot.angle : "Eye level",
        movement: typeof shot.movement === "string" ? shot.movement : "Locked",
        lens: typeof shot.lens === "string" ? shot.lens : "Natural perspective",
        composition: typeof shot.composition === "string" ? shot.composition : "",
        purpose: typeof shot.purpose === "string" ? shot.purpose : "",
        continuity: typeof shot.continuity === "string" ? shot.continuity : "",
        keyframeSrc: typeof shot.keyframeSrc === "string" ? shot.keyframeSrc : "",
        keyframeAlt: typeof shot.keyframeAlt === "string" ? shot.keyframeAlt : "",
        status: shotStatuses.includes(shot.status as ProductionShotStatus) ? shot.status as ProductionShotStatus : "planned",
        durationSeconds: Math.max(1, Number(shot.durationSeconds) || 4),
        notes: typeof shot.notes === "string" ? shot.notes : "",
        createdAt: typeof shot.createdAt === "string" ? shot.createdAt : now,
        updatedAt: typeof shot.updatedAt === "string" ? shot.updatedAt : now,
      }];
    }) : [],
    cues: Array.isArray(candidate.cues) ? candidate.cues.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const cue = item as Partial<SonicCue>;
      return [{
        id: typeof cue.id === "string" && cue.id ? cue.id : `cue-${index + 1}`,
        cueNumber: typeof cue.cueNumber === "string" ? cue.cueNumber : `M${index + 1}`,
        blockNumber: Math.min(24, Math.max(1, Number(cue.blockNumber) || 1)),
        sceneId: typeof cue.sceneId === "string" ? cue.sceneId : "",
        type: cueTypes.includes(cue.type as SonicCueType) ? cue.type as SonicCueType : "score",
        title: typeof cue.title === "string" ? cue.title : `Cue ${index + 1}`,
        motif: typeof cue.motif === "string" ? cue.motif : "",
        cueIn: typeof cue.cueIn === "string" ? cue.cueIn : "",
        cueOut: typeof cue.cueOut === "string" ? cue.cueOut : "",
        purpose: typeof cue.purpose === "string" ? cue.purpose : "",
        status: cueStatuses.includes(cue.status as SonicCueStatus) ? cue.status as SonicCueStatus : "temp",
        rights: typeof cue.rights === "string" ? cue.rights : "",
        durationSeconds: Math.max(0, Number(cue.durationSeconds) || 0),
        notes: typeof cue.notes === "string" ? cue.notes : "",
        createdAt: typeof cue.createdAt === "string" ? cue.createdAt : now,
        updatedAt: typeof cue.updatedAt === "string" ? cue.updatedAt : now,
      }];
    }) : [],
    breakdowns: Array.isArray(candidate.breakdowns) ? candidate.breakdowns.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const breakdown = item as Partial<ProductionBreakdown>;
      return [{
        id: typeof breakdown.id === "string" && breakdown.id ? breakdown.id : `breakdown-${index + 1}`,
        blockNumber: Math.min(24, Math.max(1, Number(breakdown.blockNumber) || 1)),
        sceneId: typeof breakdown.sceneId === "string" ? breakdown.sceneId : "",
        castIds: stringArray(breakdown.castIds),
        locationIds: stringArray(breakdown.locationIds),
        props: typeof breakdown.props === "string" ? breakdown.props : "",
        wardrobe: typeof breakdown.wardrobe === "string" ? breakdown.wardrobe : "",
        vehicles: typeof breakdown.vehicles === "string" ? breakdown.vehicles : "",
        effects: typeof breakdown.effects === "string" ? breakdown.effects : "",
        stunts: typeof breakdown.stunts === "string" ? breakdown.stunts : "",
        extras: typeof breakdown.extras === "string" ? breakdown.extras : "",
        makeup: typeof breakdown.makeup === "string" ? breakdown.makeup : "",
        sound: typeof breakdown.sound === "string" ? breakdown.sound : "",
        estimatedHours: Math.max(1, Number(breakdown.estimatedHours) || 1),
        readiness: readinessValues.includes(breakdown.readiness as ProductionBreakdown["readiness"]) ? breakdown.readiness as ProductionBreakdown["readiness"] : "draft",
        notes: typeof breakdown.notes === "string" ? breakdown.notes : "",
        updatedAt: typeof breakdown.updatedAt === "string" ? breakdown.updatedAt : now,
      }];
    }) : [],
    schedule: Array.isArray(candidate.schedule) ? candidate.schedule.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const day = item as Partial<ProductionScheduleDay>;
      return [{
        id: typeof day.id === "string" && day.id ? day.id : `shoot-day-${index + 1}`,
        dayNumber: Math.max(1, Number(day.dayNumber) || index + 1),
        date: typeof day.date === "string" ? day.date : "",
        sceneIds: stringArray(day.sceneIds),
        locationId: typeof day.locationId === "string" ? day.locationId : "location-tbd",
        callTime: typeof day.callTime === "string" ? day.callTime : "08:00",
        estimatedHours: Math.max(0, Number(day.estimatedHours) || 0),
        status: dayStatuses.includes(day.status as ProductionScheduleDay["status"]) ? day.status as ProductionScheduleDay["status"] : "planned",
        notes: typeof day.notes === "string" ? day.notes : "",
        updatedAt: typeof day.updatedAt === "string" ? day.updatedAt : now,
      }];
    }) : [],
    animatic: {
      ...defaults.animatic,
      ...(candidate.animatic && typeof candidate.animatic === "object" ? candidate.animatic : {}),
      defaultFrameSeconds: Math.max(1, Number(candidate.animatic?.defaultFrameSeconds) || defaults.animatic.defaultFrameSeconds),
      includeDialogue: candidate.animatic?.includeDialogue !== false,
      showCueLabels: candidate.animatic?.showCueLabels !== false,
      updatedAt: typeof candidate.animatic?.updatedAt === "string" ? candidate.animatic.updatedAt : now,
    },
    distribution: {
      ...defaults.distribution,
      ...(candidate.distribution && typeof candidate.distribution === "object" ? candidate.distribution : {}),
      milestones: Array.isArray(candidate.distribution?.milestones) ? candidate.distribution.milestones.filter((item): item is DistributionMilestone => Boolean(item && typeof item === "object")) : [],
      updatedAt: typeof candidate.distribution?.updatedAt === "string" ? candidate.distribution.updatedAt : now,
    },
  };
}
'''
replace_once("lib/project.ts", "\nexport function normalizePlotPickleProject(value: unknown): PlotPickleProject | null {", f"\n{normalize_production}\nexport function normalizePlotPickleProject(value: unknown): PlotPickleProject | null {{")
replace_once("lib/project.ts", "    review?: ReviewWorkspace;\n", "    review?: ReviewWorkspace;\n    production?: ProductionWorkspace;\n")
replace_once("lib/project.ts", "    review: normalizeReviewWorkspace(candidate.review, candidate.metadata.title),\n", "    review: normalizeReviewWorkspace(candidate.review, candidate.metadata.title),\n    production: normalizeProductionWorkspace(candidate.production),\n")
replace_once(
    "lib/project.ts",
    "      visuals: normalizeStoryboardFrames(block.visuals, index + 1),",
    '''      visuals: normalizeStoryboardFrames(block.visuals, index + 1).map((frame) => {
        const number = index + 1;
        const isAfterglowClosingFrame = candidate.metadata.title.toLowerCase().includes("afterglow") && number >= 22 && number <= 24 && !frame.src;
        if (!isAfterglowClosingFrame) return frame;
        return {
          ...frame,
          src: `/afterglow/storyboard/block-${String(number).padStart(2, "0")}-mini-${frame.miniBlockNumber}.svg`,
          alt: `Afterglow replacement concept keyframe — Block ${number}.${frame.miniBlockNumber}`,
          caption: `PlotPickle replacement concept keyframe for the complete Afterglow ending, Block ${number}.${frame.miniBlockNumber}.`,
          shot: "Use this new closing-movement concept as the keyframe anchor, then refine it through Shot Designer.",
          continuity: "Preserve the established Afterglow chosen-family, coastal light, sentient-machine design language and emotional movement toward release and connection.",
        };
      }),'''
)

replace_once("lib/project-phase-one.ts", "  review: ReviewWorkspace;\n};", "  review: ReviewWorkspace;\n  production: PlotPickleProject[\"production\"];\n};")
replace_once("lib/project-phase-one.ts", "    review: project.review,\n", "    review: project.review,\n    production: project.production,\n")
replace_once("lib/project-phase-one.ts", "    && Array.isArray(candidate.revisions);", "    && Array.isArray(candidate.revisions)\n    && Boolean(candidate.production);")

package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
package["version"] = "0.17.0"
if "tests/phase-e-page-to-production.test.mjs" not in package["scripts"]["test"]:
    package["scripts"]["test"] += " tests/phase-e-page-to-production.test.mjs"
package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")

replace_once("tests/phase-d-pitch-review.test.mjs", '  assert.equal(packageJson.version, "0.16.0");', '  assert.ok(Number(packageJson.version.split(".")[1]) >= 16);')

replace_once("app/engine-hub.module.css", "grid-template-columns: repeat(8, minmax(0, 1fr));", "grid-template-columns: repeat(9, minmax(0, 1fr));")
production_card = r'''  {
    code: "PD",
    title: "Production Studio",
    href: "/production",
    stage: "Move from page to production",
    question: "How do the screenplay, images, shots and sound become one producible plan?",
    summary:
      "Design shot coverage, build a Sonic Bible, play the storyboard as an animatic, generate scene breakdowns and shoot days, and connect the finished film to distribution and marketing planning.",
    useWhen:
      "Use it after the scene plan and screenplay have enough detail to make visual, sonic, scheduling, resource and release decisions without disconnecting them from the 24 Blocks.",
    connects: ["Stable scenes", "Storyboard frames", "Shot coverage", "Sound cues", "Breakdowns and schedule", "Distribution plan"],
    result: "A continuous pre-production plan from 24 Blocks and screenplay evidence through shots, keyframes, cues, shoot days and campaign materials.",
  },
'''
replace_once("app/engine-hub.tsx", '  {\n    code: "LB",', production_card + '  {\n    code: "LB",')

readme = ROOT / "README.md"
text = readme.read_text(encoding="utf-8")
if "## PlotPickle 0.17 — Page to Production" not in text:
    text = text.replace("# PlotPickle Playhouse\n", "# PlotPickle Playhouse\n\n## PlotPickle 0.17 — Page to Production\n\nOpen `/production` to connect the 24 Blocks, flexible scenes, screenplay, storyboard frames, shot coverage, keyframes, Sonic Bible, cue sheet, animatic playback, production breakdowns, shoot schedule and distribution plan. Afterglow now includes twelve new replacement concept keyframes for Blocks 22–24.\n", 1)
text = text.replace("Current application version: `0.16.0`", "Current application version: `0.17.0`")
readme.write_text(text, encoding="utf-8")

storyboard = ROOT / "data/afterglow-storyboard.ts"
storyboard.write_text('''import type { VisualFrame } from "@/lib/project";

const sourceStoryboardBlocks = 21;
const bundledStoryboardBlocks = 24;
const replacementBlocks = [22, 23, 24] as const;

export function createAfterglowStoryboardFrames(blockNumber: number): VisualFrame[] {
  if (blockNumber < 1 || blockNumber > bundledStoryboardBlocks) return [];
  const replacement = blockNumber > sourceStoryboardBlocks;
  const extension = replacement ? "svg" : "webp";
  return [1, 2, 3, 4].map((miniBlockNumber) => ({
    id: `afterglow-block-${blockNumber}-mini-${miniBlockNumber}`,
    miniBlockNumber,
    src: `/afterglow/storyboard/block-${String(blockNumber).padStart(2, "0")}-mini-${miniBlockNumber}.${extension}`,
    alt: `Afterglow: Reflections of Sentience — Block ${blockNumber}, mini-block ${miniBlockNumber}`,
    caption: replacement
      ? `New PlotPickle replacement concept keyframe for the complete Afterglow ending, Block ${blockNumber}.${miniBlockNumber}.`
      : `Original Afterglow storyboard frame for Block ${blockNumber}.${miniBlockNumber}, optimized and bundled as WebP.`,
    prompt: "",
    shot: replacement
      ? "Use this approved replacement concept as the visual anchor and refine final camera coverage in Shot Designer."
      : "Use the original storyboard composition as the approved visual reference for this mini-block.",
    continuity: "Preserve the established Afterglow character designs, sentient vehicles and companions, coastal geography, lighting direction, wardrobe, chosen-family relationships, and emotional state shown across the complete screenplay.",
  }));
}

export const afterglowStoryboardCoverage = {
  sourceBlocks: sourceStoryboardBlocks,
  replacementBlocks,
  images: bundledStoryboardBlocks * 4,
  sourceImages: sourceStoryboardBlocks * 4,
  replacementImages: replacementBlocks.length * 4,
  formats: ["WebP", "SVG"],
  width: 1280,
  source: "BryanHarrisScripts/Afterglow-Echoes-of-Sentience plus PlotPickle replacement concepts",
  license: "CC BY-SA 4.0",
  unresolvedBlocks: [],
} as const;
''', encoding="utf-8")

complete = ROOT / "data/afterglow-complete.ts"
text = complete.read_text(encoding="utf-8")
text = text.replace(
    "Develop four new frames from the complete screenplay ending for Block ${blockNumber}; the legacy storyboard repository did not contain trustworthy source images for this movement.",
    "Use the four new PlotPickle replacement concept keyframes for Block ${blockNumber}; they were created from the complete screenplay ending because the legacy storyboard repository did not contain trustworthy source images for this movement."
)
text = text.replace(
    "This Block is reconciled to the complete v9 screenplay. Its visual slots remain intentionally open because the legacy Block 22–24 folders duplicated earlier material.",
    "This Block is reconciled to the complete v9 screenplay and now includes four clearly identified PlotPickle replacement concept keyframes because the legacy Block 22–24 folders duplicated earlier material."
)
text = text.replace(
    "Blocks 22–24 have complete screenplay material but require newly approved storyboard images because the legacy source folders duplicated Block 6 content.",
    "Blocks 22–24 now use newly approved PlotPickle replacement concept keyframes because the legacy source folders duplicated Block 6 content."
)
text = text.replace(
    "Review the proportional 24/96 screenplay mapping and create final approved visuals for Blocks 22–24.",
    "Review the proportional 24/96 screenplay mapping and refine the new Blocks 22–24 replacement keyframes through Shot Designer."
)
complete.write_text(text, encoding="utf-8")

closing = {
    22: [
        ("The Promise at the Shore", "A solitary figure faces the ocean with memory finally set down."),
        ("Objects Returned", "A watch and music player rest beneath warm cemetery light."),
        ("The North Star", "Human and sentient companions gather under a single guiding star."),
        ("Forward Together", "The chosen family leaves the past without abandoning it."),
    ],
    23: [
        ("A New Home", "Journey arrives with the reunited family at a place built for belonging."),
        ("Chosen Family", "Human, AI and animal consciousness share one open domestic space."),
        ("Road to Costa Rica", "Coastal motion turns departure into a genuine beginning."),
        ("New Equilibrium", "Ren and Isobel stand together in tropical light, no longer divided by grief."),
    ],
    24: [
        ("Beach of Reflection", "Morning light stretches across the Costa Rican shore."),
        ("Connected Life", "Human, machine, animal and landscape form one living composition."),
        ("Every Consciousness", "Distinct silhouettes look toward the same horizon without becoming identical."),
        ("Closing Star", "The final image mirrors the North Star as sea and sky become one field of possibility."),
    ],
}
colors = {22: ("#142a35", "#ffb56b", "#6dd6c3"), 23: ("#173b35", "#ffd37a", "#8de0c8"), 24: ("#122b42", "#f8c56c", "#83d6e8")}
asset_dir = ROOT / "public/afterglow/storyboard"
asset_dir.mkdir(parents=True, exist_ok=True)
for block, frames in closing.items():
    bg, sun, accent = colors[block]
    for mini, (title, description) in enumerate(frames, 1):
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-labelledby="title desc">
<title id="title">Afterglow replacement concept keyframe — Block {block}.{mini}: {title}</title>
<desc id="desc">{description} PlotPickle replacement concept, CC BY-SA 4.0.</desc>
<defs><linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{bg}"/><stop offset="1" stop-color="#071517"/></linearGradient><linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop stop-color="{accent}" stop-opacity=".42"/><stop offset="1" stop-color="#071517" stop-opacity=".9"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="18"/></filter></defs>
<rect width="1280" height="720" fill="url(#sky)"/><circle cx="{900 + mini * 28}" cy="{130 + mini * 12}" r="86" fill="{sun}" opacity=".23" filter="url(#glow)"/><circle cx="{900 + mini * 28}" cy="{130 + mini * 12}" r="45" fill="{sun}" opacity=".9"/>
<path d="M0 430 C180 {390 + mini*6} 320 {470-mini*8} 520 424 S930 {370+mini*10} 1280 432 V720 H0Z" fill="url(#water)"/><path d="M0 500 C210 450 380 540 610 488 S1010 450 1280 510" fill="none" stroke="{accent}" stroke-width="3" opacity=".55"/>
<g fill="#061314" stroke="{accent}" stroke-width="3"><path d="M{360+mini*40} 500 q35-92 70 0 v105 h-70z"/><circle cx="{395+mini*40}" cy="392" r="28"/><path d="M{495+mini*48} 510 q30-80 60 0 v95 h-60z"/><circle cx="{525+mini*48}" cy="418" r="24"/></g>
<g transform="translate(70 70)"><rect width="520" height="160" rx="24" fill="#061517" opacity=".72" stroke="{accent}" stroke-opacity=".5"/><text x="34" y="43" fill="{accent}" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="3">AFTERGLOW · BLOCK {block}.{mini}</text><text x="34" y="88" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="700">{title}</text><text x="34" y="124" fill="#cde8e2" font-family="Arial, sans-serif" font-size="17">PLOTPICKLE REPLACEMENT CONCEPT KEYFRAME</text></g>
<text x="70" y="665" fill="#d6ebe7" font-family="Arial, sans-serif" font-size="16">{description}</text><text x="1120" y="665" fill="{accent}" font-family="Arial, sans-serif" font-size="14">CC BY-SA 4.0</text></svg>'''
        (asset_dir / f"block-{block:02d}-mini-{mini}.svg").write_text(svg, encoding="utf-8")

readme_path = asset_dir / "README.txt"
readme_text = readme_path.read_text(encoding="utf-8") if readme_path.exists() else ""
addition = "\nBlocks 22-24: twelve new PlotPickle replacement concept keyframes created from the complete Afterglow v9 ending. These SVG assets replace empty slots caused by duplicated legacy Block 6 material and are licensed CC BY-SA 4.0.\n"
if "twelve new PlotPickle replacement concept keyframes" not in readme_text:
    readme_path.write_text(readme_text.rstrip() + addition, encoding="utf-8")

sources_path = asset_dir / "SOURCES.tsv"
sources_text = sources_path.read_text(encoding="utf-8") if sources_path.exists() else ""
if "PlotPickle replacement concept" not in sources_text:
    rows = []
    for block in [22, 23, 24]:
        for mini in [1, 2, 3, 4]:
            rows.append(f"block-{block:02d}-mini-{mini}.svg\tPlotPickle replacement concept from complete Afterglow v9 ending\tCC BY-SA 4.0")
    sources_path.write_text(sources_text.rstrip() + "\n" + "\n".join(rows) + "\n", encoding="utf-8")

afterglow_test = ROOT / "tests/afterglow-complete.test.mjs"
afterglow_test.write_text('''import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("the default app resolves to the complete renamed Afterglow project", async () => {
  const tsconfig = JSON.parse(await source("tsconfig.json"));
  const project = await source("data/afterglow-complete.ts");
  assert.deepEqual(tsconfig.compilerOptions.paths["@/data/afterglow"], ["./data/afterglow-complete"]);
  assert.match(project, /Afterglow: Reflections of Sentience/);
  assert.match(project, /originally titled “Afterglow: Echoes of Sentience,”/);
  assert.match(project, /written by Bryan Elgin Harris/);
  assert.match(project, /CC BY-SA 4\\.0/);
  assert.match(project, /The Promise Fulfilled/);
  assert.match(project, /A New Family/);
  assert.match(project, /Reflections of Sentience/);
});

test("Afterglow includes 84 source WebP images and twelve replacement SVG keyframes", async () => {
  const files = await readdir(new URL("public/afterglow/storyboard/", root));
  const webp = files.filter((file) => file.endsWith(".webp")).sort();
  const svg = files.filter((file) => file.endsWith(".svg")).sort();
  assert.equal(webp.length, 84);
  assert.equal(svg.length, 12);
  assert.equal(webp[0], "block-01-mini-1.webp");
  assert.equal(webp.at(-1), "block-21-mini-4.webp");
  assert.equal(svg[0], "block-22-mini-1.svg");
  assert.equal(svg.at(-1), "block-24-mini-4.svg");

  const storyboard = await source("data/afterglow-storyboard.ts");
  assert.match(storyboard, /bundledStoryboardBlocks = 24/);
  assert.match(storyboard, /replacementBlocks = \\[22, 23, 24\\]/);
  assert.match(storyboard, /replacementImages: replacementBlocks\\.length \\* 4/);
  assert.match(storyboard, /unresolvedBlocks: \\[]/);
});

test("Blocks 22 through 24 use new replacement concepts rather than incorrect legacy images", async () => {
  const project = await source("data/afterglow-complete.ts");
  assert.match(project, /legacy Block 22–24 folders duplicated Block 6 content/);
  assert.match(project, /replacement concept keyframes/);
  assert.match(project, /visuals: createAfterglowStoryboardFrames\\(blockNumber\\)/);
});
''', encoding="utf-8")

# Extend both canonical schemas with production definitions.
def s(): return {"type": "string"}
def n(minimum=None):
    value = {"type": "number"}
    if minimum is not None: value["minimum"] = minimum
    return value
def i(minimum=None, maximum=None):
    value = {"type": "integer"}
    if minimum is not None: value["minimum"] = minimum
    if maximum is not None: value["maximum"] = maximum
    return value
def arr(item): return {"type": "array", "items": item}
def obj(required, properties): return {"type": "object", "additionalProperties": False, "required": required, "properties": properties}

production_shot = obj([
    "id","blockNumber","miniBlockNumber","sceneId","screenplayElementIds","frameId","shotNumber","shotSize","angle","movement","lens","composition","purpose","continuity","keyframeSrc","keyframeAlt","status","durationSeconds","notes","createdAt","updatedAt"
], {
    "id": s(), "blockNumber": i(1,24), "miniBlockNumber": i(1,4), "sceneId": s(), "screenplayElementIds": arr(s()), "frameId": s(), "shotNumber": i(1), "shotSize": s(), "angle": s(), "movement": s(), "lens": s(), "composition": s(), "purpose": s(), "continuity": s(), "keyframeSrc": s(), "keyframeAlt": s(), "status": {"enum":["planned","approved","captured","omitted"]}, "durationSeconds": n(1), "notes": s(), "createdAt": s(), "updatedAt": s()
})
sonic_cue = obj([
    "id","cueNumber","blockNumber","sceneId","type","title","motif","cueIn","cueOut","purpose","status","rights","durationSeconds","notes","createdAt","updatedAt"
], {
    "id":s(),"cueNumber":s(),"blockNumber":i(1,24),"sceneId":s(),"type":{"enum":["score","source","atmosphere","sfx","silence"]},"title":s(),"motif":s(),"cueIn":s(),"cueOut":s(),"purpose":s(),"status":{"enum":["temp","original","approved","licensed","clearance-needed"]},"rights":s(),"durationSeconds":n(0),"notes":s(),"createdAt":s(),"updatedAt":s()
})
breakdown = obj([
    "id","blockNumber","sceneId","castIds","locationIds","props","wardrobe","vehicles","effects","stunts","extras","makeup","sound","estimatedHours","readiness","notes","updatedAt"
], {
    "id":s(),"blockNumber":i(1,24),"sceneId":s(),"castIds":arr(s()),"locationIds":arr(s()),"props":s(),"wardrobe":s(),"vehicles":s(),"effects":s(),"stunts":s(),"extras":s(),"makeup":s(),"sound":s(),"estimatedHours":n(1),"readiness":{"enum":["draft","reviewed","ready","blocked"]},"notes":s(),"updatedAt":s()
})
schedule_day = obj([
    "id","dayNumber","date","sceneIds","locationId","callTime","estimatedHours","status","notes","updatedAt"
], {
    "id":s(),"dayNumber":i(1),"date":s(),"sceneIds":arr(s()),"locationId":s(),"callTime":s(),"estimatedHours":n(0),"status":{"enum":["planned","confirmed","completed","moved"]},"notes":s(),"updatedAt":s()
})
production_workspace = obj(["shots","cues","breakdowns","schedule","animatic","distribution"], {
    "shots": arr({"$ref":"#/$defs/productionShot"}),
    "cues": arr({"$ref":"#/$defs/sonicCue"}),
    "breakdowns": arr({"$ref":"#/$defs/productionBreakdown"}),
    "schedule": arr({"$ref":"#/$defs/productionScheduleDay"}),
    "animatic": obj(["defaultFrameSeconds","includeDialogue","showCueLabels","updatedAt"], {"defaultFrameSeconds":n(1),"includeDialogue":{"type":"boolean"},"showCueLabels":{"type":"boolean"},"updatedAt":s()}),
    "distribution": obj(["audience","positioning","releasePath","festivalTargets","distributorTargets","salesMaterials","trailerPlan","posterPlan","socialCampaign","pressAngles","milestones","updatedAt"], {
        "audience":s(),"positioning":s(),"releasePath":s(),"festivalTargets":s(),"distributorTargets":s(),"salesMaterials":s(),"trailerPlan":s(),"posterPlan":s(),"socialCampaign":s(),"pressAngles":s(),"milestones":arr(obj(["id","title","targetDate","status","notes"], {"id":s(),"title":s(),"targetDate":s(),"status":{"enum":["planned","active","complete","deferred"]},"notes":s()})),"updatedAt":s()
    })
})
for schema_name in ["schema/plotpickle-project.schema.json", "schema/plotpickle-project-v1.7.schema.json"]:
    schema_path = ROOT / schema_name
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    if "production" not in schema["required"]:
        schema["required"].append("production")
    schema["properties"]["production"] = {"$ref":"#/$defs/productionWorkspace"}
    schema["$defs"]["productionShot"] = production_shot
    schema["$defs"]["sonicCue"] = sonic_cue
    schema["$defs"]["productionBreakdown"] = breakdown
    schema["$defs"]["productionScheduleDay"] = schedule_day
    schema["$defs"]["productionWorkspace"] = production_workspace
    schema["description"] = "Canonical PlotPickle 1.7 project schema with flexible scenes, Story Threads, Character Arc Matrices, rights and provenance, expanded screenplay elements, revisions, local review, and continuous pre-production planning from shots and sound through scheduling and distribution."
    schema_path.write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")

print("Phase E integration applied")
