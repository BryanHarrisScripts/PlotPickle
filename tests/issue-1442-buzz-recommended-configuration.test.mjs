import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildPlotPickleBuzzAgentInstructions,
  validatePlotPickleRecommendedBuzzConfig,
} from "../lib/buzz/plotpickle-agent-configuration-core.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await read(path));
const SECRET_FIELD = /^(?:nsec|privateKey|private_key|secret|signingKey|signing_key|credential|token|authTag|auth_tag)$/i;

function hasSecretField(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasSecretField);
  return Object.entries(value).some(([key, child]) => SECRET_FIELD.test(key) || hasSecretField(child));
}

test("#1442 defines one validated, credential-free PlotPickle Recommended configuration", async () => {
  const configuration = validatePlotPickleRecommendedBuzzConfig(await json("config/buzz-agent-recommended.json"));
  assert.equal(configuration.configurationVersion, "PlotPickle Recommended v1");
  assert.deepEqual(configuration.globalDefaults, {
    runtime: { id: "buzz-agent", label: "Buzz Agent" },
    provider: { id: "openai", label: "OpenAI" },
    model: "gpt-5.6-luna",
    reasoningEffort: null,
    reasoningLabel: "Model default",
    memory: "none",
    memoryLabel: "PlotPickle Context Only",
    autoRestartOnConfigChange: true,
  });
  assert.equal(configuration.agentDefaults.parallelism, 1);
  assert.equal(configuration.agentDefaults.activation, "explicit-mentions");
  assert.equal(configuration.agentDefaults.startOnBuzzLaunch, true);
  assert.equal(configuration.agentDefaults.autoRestartOnConfigChange, true);
  assert.equal(configuration.authority.privateKeyCustody, "BUZZ");
  assert.equal(hasSecretField(configuration), false);
});

test("#1442 keeps official Helper instructions PlotPickle-owned and authority bounded", async () => {
  const configuration = validatePlotPickleRecommendedBuzzConfig(await json("config/buzz-agent-recommended.json"));
  assert.deepEqual(configuration.commonInstructions, [
    "Human remains creative authority.",
    "PPF is canonical.",
    "BUZZ conversation is not canon.",
    "Return proposals and evidence; never silently rewrite accepted material.",
    "Respond only to assigned work or explicit mentions.",
    "Never impersonate another Agent or the Human.",
    "Never expose credentials or hidden reasoning.",
  ]);
  const prompt = buildPlotPickleBuzzAgentInstructions({
    configuration,
    profile: {
      displayName: "Tamsin Hearthquill",
      title: "Keeper of Foundations",
      responsibility: "Turns Foundations into reviewable proposals.",
      creativeAuthority: "proposal-only",
      verificationContract: "Human approval is required.",
    },
    publicBio: "A planning guide.",
  });
  for (const rule of configuration.commonInstructions) assert.match(prompt, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const provisioner = await read("scripts/provision-community-agents.mjs");
  assert.match(provisioner, /buildPlotPickleBuzzAgentInstructions/);
  assert.match(provisioner, /buzz-agent-recommended\.json/);
  assert.doesNotMatch(provisioner, /function profilePrompt/);
});

test("#1442 derives explicit Helper rooms from the canonical Playhouse roster and never grants all channels", async () => {
  const community = await json("plugins/plotpickle-playhouse/community.json");
  assert.ok(community.agents.length > 0);
  for (const agent of community.agents) {
    assert.ok(agent.roomIds.length > 0, `${agent.profileId} needs at least one explicit room`);
    assert.equal(new Set(agent.roomIds).size, agent.roomIds.length, `${agent.profileId} has duplicate rooms`);
    assert.ok(!agent.roomIds.some((roomId) => /^(?:all|all-channels|\*)$/i.test(roomId)), `${agent.profileId} must not receive all channels`);
  }
});

test("#1442 Help shows global defaults and compact capability-aware per-Agent BUZZ cards", async () => {
  const [directory, styles] = await Promise.all([
    read("app/settings-helper-directory.tsx"),
    read("app/settings-helper-directory.module.css"),
  ]);
  assert.match(directory, /PlotPickle Agent Defaults/);
  assert.match(directory, /BUZZ Configuration/);
  assert.match(directory, /PlotPickle Context Only|globalDefaults\.memoryLabel/);
  assert.match(directory, /Private Story Rooms:/);
  assert.match(directory, /READ FROM BUZZ/);
  assert.match(directory, /SYNC TO BUZZ/);
  assert.match(directory, /data-sync-capability="unavailable" disabled/);
  assert.match(directory, /\/api\/local-buzz\/agent-roster/);
  assert.match(directory, /private effective settings unavailable/);
  assert.match(directory, /No Agent private key or auth tag will be imported into PlotPickle/);
  assert.match(styles, /\.buzzConfiguration/);
  assert.match(styles, /\.defaults/);
});

test("#1442 refuses to claim complete read-back or sync before BUZZ exposes a no-secret contract", async () => {
  const configuration = validatePlotPickleRecommendedBuzzConfig(await json("config/buzz-agent-recommended.json"));
  assert.equal(configuration.syncSupport.noSecretOwnerReviewedSyncAvailable, false);
  assert.ok(configuration.syncSupport.readableFromBuzz.includes("public-identity"));
  for (const field of ["effective-private-configuration", "parallelism", "memory", "start-on-launch", "auto-restart", "avatar", "channel-memberships"]) {
    assert.ok(configuration.syncSupport.unavailableFields.includes(field), `${field} must remain explicitly unavailable`);
  }
  assert.match(configuration.syncSupport.unavailableReason, /does not yet expose a supported no-secret owner-reviewed API/);
});
