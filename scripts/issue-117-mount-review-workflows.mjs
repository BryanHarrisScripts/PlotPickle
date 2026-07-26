import { readFileSync, writeFileSync } from "node:fs";

const componentPath = "app/feedback-workspace.tsx";
let component = readFileSync(componentPath, "utf8");

const importNeedle = 'import styles from "./feedback-workspace.module.css";\n';
const importReplacement = `${importNeedle}import ReviewWorkflowsPanel from "./review-workflows-panel";\n`;
if (!component.includes(importNeedle) || component.includes('import ReviewWorkflowsPanel from "./review-workflows-panel"')) throw new Error("Feedback workflow import anchor is missing or already patched.");
component = component.replace(importNeedle, importReplacement);

const cardNeedle = 'className={`${styles.recordCard} ${selected ? styles.selectedRecord : ""}`}';
const cardReplacement = 'className={`${styles.recordCard} ${record.source === "ai" || record.source === "diagnostic" ? styles.aiRecord : styles.humanRecord} ${selected ? styles.selectedRecord : ""}`}';
if (!component.includes(cardNeedle)) throw new Error("Feedback record card anchor is missing.");
component = component.replace(cardNeedle, cardReplacement);

const mountNeedle = `        </section>\n\n        {createOpen ? (`;
const mountReplacement = `        </section>\n\n        {section === "ai-review" ? <ReviewWorkflowsPanel project={project} mode="ai" onProjectChange={onProjectChange} /> : null}\n        {section === "human-review" ? <ReviewWorkflowsPanel project={project} mode="human" onProjectChange={onProjectChange} /> : null}\n\n        {createOpen ? (`;
if (!component.includes(mountNeedle)) throw new Error("Feedback workflow mount anchor is missing.");
component = component.replace(mountNeedle, mountReplacement);
writeFileSync(componentPath, component, "utf8");

const cssPath = "app/feedback-workspace.module.css";
let css = readFileSync(cssPath, "utf8");
const cssAddition = ".aiRecord{border-left:4px solid #7d72c6;background:linear-gradient(90deg,#faf8ff,#fff 28%)}.humanRecord{border-left:4px solid #4d9b86;background:linear-gradient(90deg,#f3fbf8,#fff 28%)}";
if (css.includes(".aiRecord{")) throw new Error("Feedback record source styles are already present.");
css += cssAddition;
writeFileSync(cssPath, css, "utf8");

console.log("Mounted issue #117 workflows and source-specific record styling.");
