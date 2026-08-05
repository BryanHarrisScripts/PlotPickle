import { readFile, writeFile } from "node:fs/promises";

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label} contract was not found.`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label} contract was not unique.`);
  return source.replace(before, after);
}

const storyboardPath = "app/visual-storyboard.tsx";
let storyboard = await readFile(storyboardPath, "utf8");
storyboard = replaceOnce(
  storyboard,
  '<div className={styles.visualNavHead}><strong>Visual production</strong><span>{continuityWarnings + missingReferences} items to review</span></div>',
  '<header className={styles.visualNavHead}><strong>Visual production</strong><span>{continuityWarnings + missingReferences} items to review</span></header>',
  "Storyboard navigation heading",
);
storyboard = replaceOnce(
  storyboard,
  '                        : version.id === frame.approvedVideoVersionId;\n                      return <article className={styles.versionCard}',
  '                        : version.id === frame.approvedVideoVersionId;\n                      const versionLabelId = `storyboard-version-${version.id}-label`;\n                      return <article className={styles.versionCard}',
  "Storyboard version label identifier",
);
storyboard = replaceOnce(
  storyboard,
  '<video src={version.src} controls preload="metadata" playsInline aria-label={`${version.status} video version for Block ${block.number}.${miniBlockNumber}`} />',
  '<video src={version.src} controls preload="metadata" playsInline aria-labelledby={versionLabelId} />',
  "Storyboard video accessible name",
);
storyboard = replaceOnce(
  storyboard,
  '<div><strong>{version.kind === "image" ? "Image" : "Video"} version</strong>',
  '<div><strong id={versionLabelId}>{version.kind === "image" ? "Image" : "Video"} version</strong>',
  "Storyboard visible version label",
);
await writeFile(storyboardPath, storyboard, "utf8");

const inventoryPath = "config/overlay-confirmation-inventory.json";
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const before = inventory.entries.length;
inventory.entries = inventory.entries.filter((entry) => entry.path !== "app/visual-storyboard.tsx");
if (inventory.entries.length !== before - 1) throw new Error("Storyboard confirmation inventory entry was not found exactly once.");
await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
