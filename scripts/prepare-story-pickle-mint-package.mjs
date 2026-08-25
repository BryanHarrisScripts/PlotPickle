import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStoryPickleMintPreparation } from "../lib/buzz/story-pickle-agents-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="))?.slice("--output=".length);
const outputRoot = path.resolve(root, outputArgument || ".artifacts/story-pickle-mint-preparation");
const publicRoot = path.resolve(root, "public");

if (outputRoot === publicRoot || outputRoot.startsWith(`${publicRoot}${path.sep}`)) {
  throw new Error("Owner mint preparation must not be written into the public application tree.");
}

async function json(relativePath) {
  return JSON.parse(await readFile(path.resolve(root, relativePath), "utf8"));
}

const [portableConfig, profiles, presentations, community] = await Promise.all([
  json("config/agent-profile-extensions/portable-story-pickles.json"),
  json("config/agent-profiles.json"),
  json("config/agent-profile-extensions/public.json"),
  json("plugins/plotpickle-playhouse/community.json"),
]);

const preparation = buildStoryPickleMintPreparation({
  portableConfig,
  agentProfiles: profiles.profiles,
  publicProfiles: presentations.profiles,
  communityAgents: community.agents,
});

const readme = [
  "PlotPickle Story Pickles — owner mint preparation",
  "",
  "This owner-only preparation is not a minted or importable BUZZ Agent card.",
  "It contains exactly Knot Pickle, Thread Pickle and Heart Pickle.",
  "Review each canonical prompt and portrait in story-pickle-mint-preparation.json, create the Agent in BUZZ, then mint the genuine unlocked card.",
  "Do not add a signer, API key, provider credential, private memory, previous conversation or local path.",
  "After minting, supply the three canonical .agent.png filenames and record each SHA-256 checksum in the portable Story Pickles configuration.",
  "",
].join("\n");

await mkdir(outputRoot, { recursive: true });
await Promise.all([
  writeFile(path.join(outputRoot, "story-pickle-mint-preparation.json"), JSON.stringify(preparation, null, 2) + "\n", "utf8"),
  writeFile(path.join(outputRoot, "README.txt"), readme, "utf8"),
]);

process.stdout.write(`Prepared ${preparation.profiles.length} owner-only Story Pickle mint contracts in ${path.relative(root, outputRoot)}.\n`);
