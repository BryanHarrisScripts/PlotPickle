import { readFile, writeFile } from "node:fs/promises";

const pagePath = new URL("../app/page.tsx", import.meta.url);
let source = await readFile(pagePath, "utf8");

function replaceRequired(label, before, after) {
  if (source.includes(after)) return;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(before, after);
}

replaceRequired(
  "navigation imports",
  'import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";\nimport { createAfterglowProject } from "@/data/afterglow";\nimport EngineHub from "./engine-hub";',
  'import Link from "next/link";\nimport { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";\nimport { createAfterglowProject } from "@/data/afterglow";\nimport EngineHub from "./engine-hub";\nimport ProjectOverview from "./project-overview";\nimport StructureMapSummary from "./structure-map-summary";\nimport { projectSectionProgress, sectionHasAlert } from "@/lib/project-progress";',
);

replaceRequired(
  "story section types",
  'type StorySection = "storySetup" | "pitch" | "world" | "characters" | "ghost" | "catalyst" | "foundations" | "pickle" | "dialogue" | "blocks" | "storyboard" | "notes";',
  'type StorySection = "overview" | "storySetup" | "pitch" | "world" | "characters" | "ghost" | "catalyst" | "foundations" | "pickle" | "dialogue" | "structureMap" | "blocks" | "storyboard" | "notes";\ntype StorySectionGroup = "Project" | "Foundation" | "Structure" | "Production";',
);

replaceRequired(
  "grouped story sections",
  `const storySections: { id: StorySection; code: string; label: string }[] = [
  { id: "storySetup", code: "01", label: "Story Setup" },
  { id: "pitch", code: "PV", label: "Pitch & Vision" },
  { id: "world", code: "WD", label: "World" },
  { id: "characters", code: "CH", label: "Characters" },
  { id: "ghost", code: "GH", label: "Ghost" },
  { id: "catalyst", code: "CA", label: "Catalyst" },
  { id: "foundations", code: "FN", label: "Foundations" },
  { id: "pickle", code: "PK", label: "The Pickle" },
  { id: "dialogue", code: "DL", label: "Dialogue" },
  { id: "blocks", code: "24", label: "24 Blocks" },
  { id: "storyboard", code: "SB", label: "Storyboard" },
  { id: "notes", code: "NT", label: "Notes" },
];`,
  `const storySections: { id: StorySection; code: string; label: string; group: StorySectionGroup }[] = [
  { id: "overview", code: "OV", label: "Project Overview", group: "Project" },
  { id: "storySetup", code: "01", label: "Story Setup", group: "Foundation" },
  { id: "pitch", code: "PV", label: "Pitch & Vision", group: "Foundation" },
  { id: "world", code: "WD", label: "World", group: "Foundation" },
  { id: "characters", code: "CH", label: "Characters", group: "Foundation" },
  { id: "ghost", code: "GH", label: "Ghost", group: "Foundation" },
  { id: "catalyst", code: "CA", label: "Catalyst", group: "Foundation" },
  { id: "foundations", code: "FN", label: "Foundations", group: "Foundation" },
  { id: "pickle", code: "PK", label: "The Pickle", group: "Foundation" },
  { id: "dialogue", code: "DL", label: "Dialogue", group: "Foundation" },
  { id: "structureMap", code: "ST", label: "Structure Map", group: "Structure" },
  { id: "blocks", code: "24", label: "24 Blocks", group: "Structure" },
  { id: "storyboard", code: "SB", label: "Storyboard", group: "Production" },
  { id: "notes", code: "NT", label: "Notes", group: "Production" },
];`,
);

replaceRequired(
  "overview and structure guides",
  'const sectionGuides: Record<StorySection, { title: string; description: string; questions: string[]; deliverable: string; connection: string }> = {\n  storySetup:',
  'const sectionGuides: Record<StorySection, { title: string; description: string; questions: string[]; deliverable: string; connection: string }> = {\n  overview: {\n    title: "Re-enter the project through one clear dashboard.",\n    description: "See overall progress, the next useful task, structural coverage, open questions, and ownership information before choosing where to work.",\n    questions: ["What is the project asking for next?", "Which section is underdeveloped?", "What question or continuity issue should remain visible?"],\n    deliverable: "A current project snapshot and a deliberate next step.",\n    connection: "Every story column, engine, block, scene, and visual contributes to the same overview.",\n  },\n  storySetup:',
);

replaceRequired(
  "structure map guide",
  '  blocks: {\n    title: "Turn the story into twenty-four causal movements.",',
  '  structureMap: {\n    title: "See the complete hierarchy without leaving the story columns.",\n    description: "Review the four acts, twelve sequences, twenty-four blocks, forty-eight scenes, ninety-six mini-blocks, and Story Clock before entering the full Structure Engine.",\n    questions: ["Does every sequence turn the story?", "Where does the runtime concentrate?", "Which block, scene, or mini-block still lacks a clear function?"],\n    deliverable: "A readable map from act to mini-block with direct block access.",\n    connection: "The summary reads the same structure edited by the Structure Engine and used by every screenplay and visual workspace.",\n  },\n  blocks: {\n    title: "Turn the story into twenty-four causal movements.",',
);

replaceRequired(
  "local landing prop",
  'function LandingPage({ onOpenOnline }: { onOpenOnline: () => void }) {',
  'function LandingPage({ onEnter }: { onEnter: () => void }) {',
);

source = source.replaceAll('onClick={onOpenOnline}', 'onClick={onEnter}');
source = source.replaceAll('Open online', 'Open local workspace');
source = source.replaceAll('Explore PlotPickle Online', 'Open local workspace');
source = source.replaceAll('Or open PlotPickle Online', 'Open the installed workspace');
source = source.replaceAll('Open PlotPickle Online →', 'Open local workspace →');
source = source.replaceAll('PlotPickle brings the method, the writing plan, and the visual board into one connected workspace—ready to run on your Windows computer.', 'PlotPickle brings the method, writing plan, visual board, and specialist engines into one downloadable local-server workspace for your computer.');

replaceRequired(
  "landing entry",
  'return <LandingPage onOpenOnline={() => setShowLanding(false)} />;',
  'return <LandingPage onEnter={() => setShowLanding(false)} />;',
);

replaceRequired(
  "overview default section",
  'const [activeSection, setActiveSection] = useState<StorySection>("storySetup");',
  'const [activeSection, setActiveSection] = useState<StorySection>("overview");',
);

source = source.replaceAll('setActiveSection("storySetup");', 'setActiveSection("overview");');

replaceRequired(
  "instructions project prop",
  '<Instructions\n            activeSection={activeSection}',
  '<Instructions\n            project={project}\n            activeSection={activeSection}',
);

replaceRequired(
  "planner rail project prop",
  '<StoryRail workspace="Story Planner" activeSection={activeSection} selectSection={setActiveSection} />',
  '<StoryRail project={project} workspace="Story Planner" activeSection={activeSection} selectSection={setActiveSection} />',
);

replaceRequired(
  "visual rail project prop",
  '<StoryRail workspace="Visual Board" activeSection={activeSection} selectSection={setActiveSection} />',
  '<StoryRail project={project} workspace="Visual Board" activeSection={activeSection} selectSection={setActiveSection} />',
);

replaceRequired(
  "planner overview screens",
  '            <section className="planner-content">\n              {activeSection === "storySetup" ? (',
  '            <section className="planner-content">\n              {activeSection === "overview" ? (\n                <ProjectOverview\n                  project={project}\n                  onOpenSection={(section) => setActiveSection(section as StorySection)}\n                  onOpenEngines={() => setActiveTab("engines")}\n                  onOpenBlock={(number) => openBlock(number, "planner")}\n                />\n              ) : null}\n              {activeSection === "structureMap" ? (\n                <StructureMapSummary project={project} onOpenBlock={(number) => openBlock(number, "planner")} />\n              ) : null}\n              {activeSection === "storySetup" ? (',
);

replaceRequired(
  "grouped rail component",
  `function StoryRail({ workspace, activeSection, selectSection }: { workspace: string; activeSection: StorySection; selectSection: (section: StorySection) => void }) {
  return (
    <aside className="story-rail">
      <div className="story-rail-heading">
        <p className="eyebrow">{workspace}</p>
        <strong>Story columns</strong>
        <span>One structure. Three connected views.</span>
      </div>
      <nav aria-label={\`${'${workspace}'} story sections\`}>
        {storySections.map((section) => (
          <button type="button" className={activeSection === section.id ? "active" : ""} key={section.id} onClick={() => selectSection(section.id)}>
            <span>{section.code}</span>
            <strong>{section.label}</strong>
          </button>
        ))}
      </nav>
      <div className="method-note">
        <span>24 Blocks</span>
        <strong>4 acts × 6 blocks</strong>
        <p>Each block carries story text, notes, storyboard direction, and visual frames.</p>
      </div>
    </aside>
  );
}`,
  `function StoryRail({ project, workspace, activeSection, selectSection }: { project: PlotPickleProject; workspace: string; activeSection: StorySection; selectSection: (section: StorySection) => void }) {
  const progress = projectSectionProgress(project);
  const groups: StorySectionGroup[] = ["Project", "Foundation", "Structure", "Production"];
  return (
    <aside className="story-rail">
      <div className="story-rail-heading">
        <p className="eyebrow">{workspace}</p>
        <strong>Story columns</strong>
        <span>One story. Four connected workspaces.</span>
      </div>
      <nav aria-label={\`${'${workspace}'} story sections\`}>
        {groups.map((group) => (
          <div className="story-rail-group" key={group}>
            <p className="story-rail-group-label">{group}</p>
            {storySections.filter((section) => section.group === group).map((section) => {
              const sectionProgress = progress[section.id];
              const alert = sectionHasAlert(project, section.id);
              const symbol = alert ? "!" : sectionProgress >= 70 ? "✓" : sectionProgress > 0 ? "◐" : "○";
              const status = alert ? "Open question or continuity item" : sectionProgress >= 70 ? "Substantially complete" : sectionProgress > 0 ? "In progress" : "Not started";
              return (
                <button type="button" className={activeSection === section.id ? "active" : ""} key={section.id} onClick={() => selectSection(section.id)}>
                  <span>{section.code}</span>
                  <strong>{section.label}</strong>
                  <i className={alert ? "rail-progress alert" : "rail-progress"} aria-label={\`${'${status}: ${sectionProgress}%'}\`}>{symbol}</i>
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="method-note">
        <span>Complete hierarchy</span>
        <strong>4 → 12 → 24 → 48 → 96</strong>
        <p>Acts, sequences, blocks, scenes, and mini-blocks share one project.</p>
      </div>
    </aside>
  );
}`,
);

replaceRequired(
  "instructions signature",
  'function Instructions({ activeSection, selectSection, onStart, onLoadAfterglow }: { activeSection: StorySection; selectSection: (section: StorySection) => void; onStart: () => void; onLoadAfterglow: () => void }) {',
  'function Instructions({ project, activeSection, selectSection, onStart, onLoadAfterglow }: { project: PlotPickleProject; activeSection: StorySection; selectSection: (section: StorySection) => void; onStart: () => void; onLoadAfterglow: () => void }) {',
);

replaceRequired(
  "instructions rail project",
  '<StoryRail workspace="Instructions" activeSection={activeSection} selectSection={selectSection} />',
  '<StoryRail project={project} workspace="Instructions" activeSection={activeSection} selectSection={selectSection} />',
);

replaceRequired(
  "four workspace connection",
  '<div><span>Instructions</span><i>→</i><span>Story Planner</span><i>→</i><span>Visual Board</span></div>',
  '<div><span>Instructions</span><i>→</i><span>Story Planner</span><i>→</i><span>Visual Board</span><i>→</i><span>Engines</span></div>',
);

replaceRequired(
  "visual overview contexts",
  '  const contexts: Record<StorySection, { title: string; values: string[] }> = {\n    storySetup:',
  '  const contexts: Record<StorySection, { title: string; values: string[] }> = {\n    overview: { title: "Project snapshot", values: [project.metadata.format, `${project.metadata.targetMinutes} minutes`, project.metadata.status] },\n    storySetup:',
);

replaceRequired(
  "visual structure context",
  '    blocks: { title: `Block ${selectedBlock.number} story motion`, values: [selectedBlock.goal, selectedBlock.choice, selectedBlock.consequence] },',
  '    structureMap: { title: "Structure hierarchy", values: ["4 acts · 12 sequences · 24 blocks", "48 scenes · 96 mini-blocks", `${project.structure.pacingProfile.replaceAll("-", " ")} pacing`] },\n    blocks: { title: `Block ${selectedBlock.number} story motion`, values: [selectedBlock.goal, selectedBlock.choice, selectedBlock.consequence] },',
);

replaceRequired(
  "footer legal navigation",
  '<button type="button" onClick={onEnter}>Open local workspace →</button>',
  '<div className="marketing-footer-actions"><button type="button" onClick={onEnter}>Open local workspace →</button><Link href="/legal">Copyright & licensing</Link><a href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Source</a></div>',
);

await writeFile(pagePath, source, "utf8");
console.log("Applied grouped story rail, overview, structure map, and local-only product wording");
