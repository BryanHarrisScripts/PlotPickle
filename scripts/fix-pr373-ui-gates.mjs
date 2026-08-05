import { readFile, writeFile } from "node:fs/promises";

const storyboardPath = "app/visual-storyboard.tsx";
let storyboard = await readFile(storyboardPath, "utf8");
const oldNav = '<div className={styles.visualNavHead}><strong>Visual production</strong><span>{continuityWarnings + missingReferences} items to review</span></div>';
const newNav = '<header className={styles.visualNavHead}><strong>Visual production</strong><span>{continuityWarnings + missingReferences} items to review</span></header>';
if (!storyboard.includes(oldNav)) throw new Error("Storyboard navigation heading contract changed.");
storyboard = storyboard.replace(oldNav, newNav);

const oldVersion = `                      const current = version.kind === "image"\n                        ? version.id === frame.approvedImageVersionId\n                        : version.id === frame.approvedVideoVersionId;\n                      return <article className={styles.versionCard} data-status={version.status} key={version.id}>\n                        {version.kind === "image"\n                          ? <img src={version.src} alt={\`${version.status} image version for Block ${block.number}.${miniBlockNumber}\`} />\n                          : <video src={version.src} controls preload="metadata" playsInline aria-label={\`${version.status} video version for Block ${block.number}.${miniBlockNumber}\`} />}\n                        <div><strong>{version.kind === "image" ? "Image" : "Video"} version</strong><span>{current ? "Current approved" : version.status === "candidate" ? "Ready for review" : "Previous version"} · {version.createdAt ? new Date(version.createdAt).toLocaleString() : "Saved locally"}</span></div>`;
const newVersion = `                      const current = version.kind === "image"\n                        ? version.id === frame.approvedImageVersionId\n                        : version.id === frame.approvedVideoVersionId;\n                      const versionLabelId = \`storyboard-version-${version.id}-label\`;\n                      return <article className={styles.versionCard} data-status={version.status} key={version.id}>\n                        {version.kind === "image"\n                          ? <img src={version.src} alt={\`${version.status} image version for Block ${block.number}.${miniBlockNumber}\`} />\n                          : <video src={version.src} controls preload="metadata" playsInline aria-labelledby={versionLabelId} />}\n                        <div><strong id={versionLabelId}>{version.kind === "image" ? "Image" : "Video"} version</strong><span>{current ? "Current approved" : version.status === "candidate" ? "Ready for review" : "Previous version"} · {version.createdAt ? new Date(version.createdAt).toLocaleString() : "Saved locally"}</span></div>`;
if (!storyboard.includes(oldVersion)) throw new Error("Storyboard version-card contract changed.");
storyboard = storyboard.replace(oldVersion, newVersion);
await writeFile(storyboardPath, storyboard, "utf8");

const inventoryPath = "config/overlay-confirmation-inventory.json";
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const before = inventory.entries.length;
inventory.entries = inventory.entries.filter((entry) => entry.path !== "app/visual-storyboard.tsx");
if (inventory.entries.length !== before - 1) throw new Error("Storyboard confirmation inventory entry was not found exactly once.");
await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");

// Synchronization trigger: the focused fixer workflow now exists on this branch.
