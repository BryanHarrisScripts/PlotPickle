import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { trustedAgentSkillIndex } from "./agent-skill-trust.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const CONFIG_PATH = path.join(ROOT_DIR, "config", "resident-writer-specialists.json");
const EXPECTED_PACKAGE_URI = "skill://plotpickle/writer-in-residence";
const MAX_REFERENCE_BYTES = 64 * 1024;

function text(value, maximum = 1_000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function strings(value, maximum = 64, itemMaximum = 240) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === "string").map((item) => text(item, itemMaximum)).filter(Boolean))].slice(0, maximum)
    : [];
}

async function loadConfig() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  if (config.schemaVersion !== 1) throw new Error(`Unsupported Resident Writer specialist schema ${config.schemaVersion}.`);
  if (config.packageUri !== EXPECTED_PACKAGE_URI) throw new Error("Resident Writer specialists must bind to the trusted writer-in-residence Skill package.");
  if (!/^\d+\.\d+\.\d+$/.test(String(config.packageVersion || ""))) throw new Error("Resident Writer specialist package requires a semantic version.");
  if (config.selection?.mode !== "on-demand") throw new Error("Resident Writer specialists must use on-demand selection.");
  if (Number(config.selection?.maxSpecialistsPerTurn) !== 2) throw new Error("Resident Writer specialist fan-in is capped at two procedures per turn.");
  if (!Array.isArray(config.specialists) || config.specialists.length === 0) throw new Error("Resident Writer specialist manifest is empty.");
  return config;
}

async function trustedPackage() {
  const index = await trustedAgentSkillIndex();
  const pkg = index.find((item) => item.uri === EXPECTED_PACKAGE_URI);
  if (!pkg) throw new Error("Resident Writer specialist procedures are unavailable because their Agent Skill package is not trusted.");
  if (pkg.trustState !== "trusted-built-in" && pkg.trustState !== "approved-external") throw new Error(`Resident Writer Skill package trust state ${pkg.trustState} is not production-approved.`);
  if (!/^[a-f0-9]{64}$/.test(pkg.contentSha256)) throw new Error("Resident Writer Skill package has no valid trusted content hash.");
  return pkg;
}

function safeReferencePath(value) {
  const relative = text(value, 300).replaceAll("\\", "/");
  const prefix = ".agents/skills/writer-in-residence/references/specialists/";
  if (!relative.startsWith(prefix) || relative.includes("../") || !relative.endsWith(".md")) throw new Error(`Unsafe Resident Writer specialist reference: ${relative}`);
  return relative;
}

async function specialistPacket(config, trusted, specialist) {
  const reference = safeReferencePath(specialist.reference);
  const absolute = path.join(ROOT_DIR, reference);
  const bytes = await readFile(absolute);
  if (bytes.length > MAX_REFERENCE_BYTES) throw new Error(`Resident Writer specialist ${specialist.id} exceeds the reference byte cap.`);
  const procedure = bytes.toString("utf8").trim();
  if (!procedure.startsWith("# ")) throw new Error(`Resident Writer specialist ${specialist.id} is missing a Markdown heading.`);
  return {
    id: text(specialist.id, 120),
    displayName: text(specialist.displayName, 180),
    purpose: text(specialist.purpose, 600),
    outputContract: strings(specialist.outputContract, 16, 180),
    packageUri: config.packageUri,
    packageVersion: config.packageVersion,
    packageTrustState: trusted.trustState,
    packageReviewStatus: trusted.reviewStatus,
    packagePinnedRevision: trusted.pinnedRevision,
    packageContentSha256: trusted.contentSha256,
    procedure,
    procedureReference: reference,
    authority: {
      grantsTools: false,
      grantsNetwork: false,
      grantsProviderSelection: false,
      grantsDeveloperAuthority: false,
      grantsPpfMutation: false,
      grantsFinalCreativeAuthority: false,
    },
  };
}

export async function residentWriterSpecialistIndex() {
  const [config, trusted] = await Promise.all([loadConfig(), trustedPackage()]);
  const seen = new Set();
  const index = [];
  for (const specialist of config.specialists) {
    const id = text(specialist.id, 120);
    if (!id || seen.has(id)) throw new Error(`Resident Writer specialist ID is missing or duplicated: ${id || "(empty)"}`);
    seen.add(id);
    index.push({
      id,
      displayName: text(specialist.displayName, 180),
      purpose: text(specialist.purpose, 600),
      keywords: strings(specialist.keywords, 32, 80),
      outputContract: strings(specialist.outputContract, 16, 180),
      packageUri: config.packageUri,
      packageVersion: config.packageVersion,
      packageTrustState: trusted.trustState,
      packagePinnedRevision: trusted.pinnedRevision,
      packageContentSha256: trusted.contentSha256,
      capabilitiesGranted: false,
    });
  }
  return index;
}

export async function loadResidentWriterSpecialist(specialistId) {
  const [config, trusted] = await Promise.all([loadConfig(), trustedPackage()]);
  const specialist = config.specialists.find((item) => item.id === specialistId);
  if (!specialist) throw new Error(`Unknown Resident Writer specialist ${specialistId}.`);
  return specialistPacket(config, trusted, specialist);
}

export async function selectResidentWriterSpecialists(task) {
  const query = text(task, 4_000).toLowerCase();
  if (!query) return [];
  const index = await residentWriterSpecialistIndex();
  return index
    .map((item) => ({
      ...item,
      score: item.keywords.reduce((score, keyword) => score + (query.includes(keyword.toLowerCase()) ? 1 : 0), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, 2)
    .map(({ score: _score, ...item }) => item);
}

export async function loadResidentWriterSpecialistsForTask(task) {
  const selected = await selectResidentWriterSpecialists(task);
  return Promise.all(selected.map((item) => loadResidentWriterSpecialist(item.id)));
}

export async function selfTestResidentWriterSpecialists() {
  const index = await residentWriterSpecialistIndex();
  if (index.length !== 5) throw new Error(`Expected 5 Resident Writer specialists, found ${index.length}.`);
  for (const item of index) {
    if (item.capabilitiesGranted !== false) throw new Error(`${item.id} must not grant capabilities.`);
    const packet = await loadResidentWriterSpecialist(item.id);
    if (!packet.procedure || packet.authority.grantsPpfMutation) throw new Error(`${item.id} failed its procedure/authority contract.`);
  }
  const selected = await selectResidentWriterSpecialists("Review the character voice and continuity in this revised scene.");
  if (selected.length === 0 || selected.length > 2) throw new Error("Resident Writer on-demand selection did not respect the 1-2 specialist cap.");
  return { ok: true, count: index.length, selected: selected.map((item) => item.id) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await selfTestResidentWriterSpecialists();
  console.log(`Resident Writer specialist Skills PASS · ${result.count} procedures · selected ${result.selected.join(", ")}`);
}
