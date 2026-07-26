import { readFileSync, writeFileSync } from "node:fs";

const path = "lib/consolidated-reports.ts";
let source = readFileSync(path, "utf8");
const needle = 'import type { PlotPickleProject, ReviewPriority, ScreenplayDraftElement } from "./project";';
if (!source.includes(needle)) throw new Error("Expected reports-model import was not found.");
source = source.replace(needle, 'import type { PlotPickleProject, ReviewPriority } from "./project";');
if (source.includes("ScreenplayDraftElement")) throw new Error("Unused ScreenplayDraftElement reference remains.");
writeFileSync(path, source, "utf8");
console.log("Removed the unused reports-model type import.");
