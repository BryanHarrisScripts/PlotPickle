import { readFile, writeFile } from "node:fs/promises";

function replaceIfNeeded(source, label, before, after) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected one source match, found ${count}`);
  }
  return source.replace(before, after);
}

const pagePath = new URL("../app/page.tsx", import.meta.url);
let page = await readFile(pagePath, "utf8");

page = replaceIfNeeded(
  page,
  "EngineHub import",
  'import { createAfterglowProject } from "@/data/afterglow";',
  'import { createAfterglowProject } from "@/data/afterglow";\nimport EngineHub from "./engine-hub";',
);

page = replaceIfNeeded(
  page,
  "MainTab engines value",
  'type MainTab = "instructions" | "planner" | "visuals";',
  'type MainTab = "instructions" | "planner" | "visuals" | "engines";',
);

page = replaceIfNeeded(
  page,
  "Engines top tab",
  '  { id: "visuals", label: "Visual Board", description: "See the film" },\n];',
  '  { id: "visuals", label: "Visual Board", description: "See the film" },\n  { id: "engines", label: "Engines", description: "Refine the story" },\n];',
);

page = replaceIfNeeded(
  page,
  "Product preview tab",
  '<div className="product-tabs"><span>Instructions</span><span className="active">Story Planner</span><span>Visual Board</span></div>',
  '<div className="product-tabs"><span>Instructions</span><span className="active">Story Planner</span><span>Visual Board</span><span>Engines</span></div>',
);

page = replaceIfNeeded(
  page,
  "Four connected workspaces heading",
  '<p className="marketing-kicker">One playhouse. Three connected rooms.</p>',
  '<p className="marketing-kicker">One playhouse. Four connected workspaces.</p>',
);

page = replaceIfNeeded(
  page,
  "Four workspace description",
  '<p>Move from learning to planning to visualization without copying information between separate tools.</p>',
  '<p>Move from learning to planning, visualization, and focused specialist engines without copying information between separate tools.</p>',
);

page = replaceIfNeeded(
  page,
  "Engines marketing card",
  `            <article>\n              <span className="feature-code">03</span>\n              <p className="feature-label">Visualize</p>\n              <h3>Visual Board</h3>\n              <p>Carry every block into storyboard directions, frame prompts, shot notes, locations, characters, and visual continuity.</p>\n            </article>`,
  `            <article>\n              <span className="feature-code">03</span>\n              <p className="feature-label">Visualize</p>\n              <h3>Visual Board</h3>\n              <p>Carry every block into storyboard directions, frame prompts, shot notes, locations, characters, and visual continuity.</p>\n            </article>\n            <article>\n              <span className="feature-code">04</span>\n              <p className="feature-label">Refine</p>\n              <h3>Engines</h3>\n              <p>Choose a guided specialist pass for structure, meaning, voice, screenplay action, draft diagnosis, or deliberate practice.</p>\n            </article>`,
);

page = replaceIfNeeded(
  page,
  "Import workspace message",
  'setToast("Project imported and connected to all three workspaces.");',
  'setToast("Project imported and connected to all PlotPickle workspaces.");',
);

page = replaceIfNeeded(
  page,
  "Engines workspace render",
  `        {activeTab === "visuals" ? (\n          <div className="studio-layout visual-studio-layout">\n            <StoryRail workspace="Visual Board" activeSection={activeSection} selectSection={setActiveSection} />\n            <VisualBoard\n              project={project}\n              activeSection={activeSection}\n              selectedBlock={selectedBlock}\n              selectedFrame={selectedFrame}\n              visualAct={visualAct}\n              setVisualAct={setVisualAct}\n              openBlock={(number) => openBlock(number, "visuals")}\n              selectFrame={setSelectedFrameId}\n              addFrame={addFrame}\n              updateFrame={updateFrame}\n              updateBlock={updateBlock}\n            />\n          </div>\n        ) : null}\n      </main>`,
  `        {activeTab === "visuals" ? (\n          <div className="studio-layout visual-studio-layout">\n            <StoryRail workspace="Visual Board" activeSection={activeSection} selectSection={setActiveSection} />\n            <VisualBoard\n              project={project}\n              activeSection={activeSection}\n              selectedBlock={selectedBlock}\n              selectedFrame={selectedFrame}\n              visualAct={visualAct}\n              setVisualAct={setVisualAct}\n              openBlock={(number) => openBlock(number, "visuals")}\n              selectFrame={setSelectedFrameId}\n              addFrame={addFrame}\n              updateFrame={updateFrame}\n              updateBlock={updateBlock}\n            />\n          </div>\n        ) : null}\n\n        {activeTab === "engines" ? <EngineHub /> : null}\n      </main>`,
);

await writeFile(pagePath, page, "utf8");

const readmePath = new URL("../README.md", import.meta.url);
let readme = await readFile(readmePath, "utf8");
readme = readme.replace("Current application version: `0.7.2`", "Current application version: `0.7.3`");
readme = replaceIfNeeded(
  readme,
  "Engines workspace documentation",
  "Every workspace reads and writes the same locally saved project.\n\n## Structure Engine",
  `Every workspace reads and writes the same locally saved project.\n\n## Engines workspace\n\n**Engines** is the fourth top-level menu item beside Instructions, Story Planner, and Visual Board. It replaces the former floating button stack with a guided overview of all six specialist engines.\n\nBefore entering a specialist screen, each engine card explains:\n\n- the story problem the engine is designed to solve;\n- the best time to use it;\n- the canonical project information it works with;\n- the expected result of the pass;\n- where it belongs in the recommended development sequence.\n\nThe suggested path is **Structure → Resonance → Voiceprint → PageFlow → DraftLens → CraftLoop**, but writers may enter whichever engine addresses the current problem.\n\n## Structure Engine`,
);
await writeFile(readmePath, readme, "utf8");

console.log("Engines workspace and documentation are current.");
