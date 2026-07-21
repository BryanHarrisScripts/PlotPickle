import { readFile, writeFile } from "node:fs/promises";

const pagePath = new URL("../app/page.tsx", import.meta.url);
let source = await readFile(pagePath, "utf8");

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected one match, found ${count}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  "EngineHub import",
  'import { createAfterglowProject } from "@/data/afterglow";',
  'import { createAfterglowProject } from "@/data/afterglow";\nimport EngineHub from "./engine-hub";',
);

replaceOnce(
  "MainTab engines value",
  'type MainTab = "instructions" | "planner" | "visuals";',
  'type MainTab = "instructions" | "planner" | "visuals" | "engines";',
);

replaceOnce(
  "Engines top tab",
  '  { id: "visuals", label: "Visual Board", description: "See the film" },\n];',
  '  { id: "visuals", label: "Visual Board", description: "See the film" },\n  { id: "engines", label: "Engines", description: "Refine the story" },\n];',
);

replaceOnce(
  "Product preview tab",
  '<div className="product-tabs"><span>Instructions</span><span className="active">Story Planner</span><span>Visual Board</span></div>',
  '<div className="product-tabs"><span>Instructions</span><span className="active">Story Planner</span><span>Visual Board</span><span>Engines</span></div>',
);

replaceOnce(
  "Four connected rooms heading",
  '<p className="marketing-kicker">One playhouse. Three connected rooms.</p>',
  '<p className="marketing-kicker">One playhouse. Four connected workspaces.</p>',
);

replaceOnce(
  "Four workspace description",
  '<p>Move from learning to planning to visualization without copying information between separate tools.</p>',
  '<p>Move from learning to planning, visualization, and focused specialist engines without copying information between separate tools.</p>',
);

replaceOnce(
  "Engines marketing card",
  `            <article>\n              <span className="feature-code">03</span>\n              <p className="feature-label">Visualize</p>\n              <h3>Visual Board</h3>\n              <p>Carry every block into storyboard directions, frame prompts, shot notes, locations, characters, and visual continuity.</p>\n            </article>`,
  `            <article>\n              <span className="feature-code">03</span>\n              <p className="feature-label">Visualize</p>\n              <h3>Visual Board</h3>\n              <p>Carry every block into storyboard directions, frame prompts, shot notes, locations, characters, and visual continuity.</p>\n            </article>\n            <article>\n              <span className="feature-code">04</span>\n              <p className="feature-label">Refine</p>\n              <h3>Engines</h3>\n              <p>Choose a guided specialist pass for structure, meaning, voice, screenplay action, draft diagnosis, or deliberate practice.</p>\n            </article>`,
);

replaceOnce(
  "Import workspace message",
  'setToast("Project imported and connected to all three workspaces.");',
  'setToast("Project imported and connected to all PlotPickle workspaces.");',
);

replaceOnce(
  "Engines workspace render",
  `        {activeTab === "visuals" ? (\n          <div className="studio-layout visual-studio-layout">\n            <StoryRail workspace="Visual Board" activeSection={activeSection} selectSection={setActiveSection} />\n            <VisualBoard\n              project={project}\n              activeSection={activeSection}\n              selectedBlock={selectedBlock}\n              selectedFrame={selectedFrame}\n              visualAct={visualAct}\n              setVisualAct={setVisualAct}\n              openBlock={(number) => openBlock(number, "visuals")}\n              selectFrame={setSelectedFrameId}\n              addFrame={addFrame}\n              updateFrame={updateFrame}\n              updateBlock={updateBlock}\n            />\n          </div>\n        ) : null}\n      </main>`,
  `        {activeTab === "visuals" ? (\n          <div className="studio-layout visual-studio-layout">\n            <StoryRail workspace="Visual Board" activeSection={activeSection} selectSection={setActiveSection} />\n            <VisualBoard\n              project={project}\n              activeSection={activeSection}\n              selectedBlock={selectedBlock}\n              selectedFrame={selectedFrame}\n              visualAct={visualAct}\n              setVisualAct={setVisualAct}\n              openBlock={(number) => openBlock(number, "visuals")}\n              selectFrame={setSelectedFrameId}\n              addFrame={addFrame}\n              updateFrame={updateFrame}\n              updateBlock={updateBlock}\n            />\n          </div>\n        ) : null}\n\n        {activeTab === "engines" ? <EngineHub /> : null}\n      </main>`,
);

await writeFile(pagePath, source, "utf8");
console.log("Applied the guided Engines workspace to app/page.tsx");
