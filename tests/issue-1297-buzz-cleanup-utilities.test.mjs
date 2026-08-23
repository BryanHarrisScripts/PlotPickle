import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ARCHIVE_CONFIRMATION,
  executeCleanup,
  resetConfirmation,
  retainedRoomIds,
  retiredRoomIds,
  validateCleanupConfiguration,
} from "../scripts/clean-buzz-community.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = (path) => read(path).then(JSON.parse);

function fakeBuzz() {
  let serial = 1;
  const byName = new Map([...retainedRoomIds, ...retiredRoomIds].map((name) => [name, [{
    channel_id: `00000000-0000-0000-0000-${String(serial++).padStart(12, "0")}`,
    name,
    archived: false,
  }]]));
  const members = new Map();
  const messages = new Map();
  const greatHallId = byName.get("great-hall")[0].channel_id;
  members.set(greatHallId, [
    { pubkey: "a".repeat(64), role: "owner" },
    { pubkey: "b".repeat(64), role: "bot" },
  ]);
  messages.set(greatHallId, [{ id: "old-1" }, { id: "old-2" }]);

  const run = async (args) => {
    const command = args.slice(2);
    if (command[0] === "channels" && command[1] === "search") {
      const name = command[command.indexOf("--query") + 1];
      return JSON.stringify(byName.get(name) ?? []);
    }
    if (command[0] === "messages" && command[1] === "get") {
      return JSON.stringify(messages.get(command[command.indexOf("--channel") + 1]) ?? []);
    }
    if (command[0] === "channels" && command[1] === "members") {
      return JSON.stringify(members.get(command[command.indexOf("--channel") + 1]) ?? []);
    }
    if (command[0] === "channels" && command[1] === "archive") {
      const id = command[command.indexOf("--channel") + 1];
      for (const rooms of byName.values()) for (const room of rooms) if (room.channel_id === id) room.archived = true;
      return JSON.stringify({ accepted: true, event_id: "archive-event" });
    }
    if (command[0] === "channels" && command[1] === "delete") {
      const id = command[command.indexOf("--channel") + 1];
      for (const [name, rooms] of byName) byName.set(name, rooms.filter((room) => room.channel_id !== id));
      return JSON.stringify({ accepted: true, event_id: "delete-event" });
    }
    if (command[0] === "channels" && command[1] === "create") {
      const name = command[command.indexOf("--name") + 1];
      const channel_id = `00000000-0000-0000-0001-${String(serial++).padStart(12, "0")}`;
      byName.set(name, [{ channel_id, name, archived: false }]);
      members.set(channel_id, [{ pubkey: "a".repeat(64), role: "owner" }]);
      messages.set(channel_id, []);
      return JSON.stringify({ accepted: true, channel_id });
    }
    if (command[0] === "channels" && command[1] === "add-member") {
      const id = command[command.indexOf("--channel") + 1];
      members.get(id).push({
        pubkey: command[command.indexOf("--pubkey") + 1],
        role: command[command.indexOf("--role") + 1],
      });
      return JSON.stringify({ accepted: true, event_id: "member-event" });
    }
    throw new Error(`Unexpected fake BUZZ command: ${command.join(" ")}`);
  };
  return { run, byName, members };
}

test("#1297 keeps one four-room Human Community contract and nine explicit retirement targets", async () => {
  const [guildhall, cleanup, plugin] = await Promise.all([
    readJson("config/buzz-guildhall.json"),
    readJson("config/buzz-community-cleanup.json"),
    readJson("plugins/plotpickle-playhouse/community.json"),
  ]);
  validateCleanupConfiguration(guildhall, cleanup);
  assert.deepEqual(cleanup.retainedRooms.map((room) => room.id), retainedRoomIds);
  assert.deepEqual(plugin.rooms.map((room) => room.id), retainedRoomIds);
  assert.deepEqual(cleanup.retiredRooms.map((room) => room.id), retiredRoomIds);
  assert.ok(cleanup.retainedRooms.every((room) => room.visibility === "open"));
});

test("#1297 plan mode inventories all targets and performs no writes", async () => {
  const [guildhall, cleanup] = await Promise.all([readJson("config/buzz-guildhall.json"), readJson("config/buzz-community-cleanup.json")]);
  const fake = fakeBuzz();
  const report = await executeCleanup({ mode: "plan", guildhall, cleanup, run: fake.run });
  assert.equal(report.retained.length, 4);
  assert.equal(report.retired.length, 9);
  assert.deepEqual(report.changes, []);
  assert.equal(report.retained.find((room) => room.id === "great-hall").recentMessageWindow, 2);
  assert.ok(report.retired.every((room) => room.status === "active"));
});

test("#1297 archive mode requires exact confirmation and verifies all nine rooms", async () => {
  const [guildhall, cleanup] = await Promise.all([readJson("config/buzz-guildhall.json"), readJson("config/buzz-community-cleanup.json")]);
  await assert.rejects(() => executeCleanup({ mode: "archive", confirmation: "yes", guildhall, cleanup, run: fakeBuzz().run }), /exact confirmation/u);
  const fake = fakeBuzz();
  const report = await executeCleanup({ mode: "archive", confirmation: ARCHIVE_CONFIRMATION, guildhall, cleanup, run: fake.run });
  assert.equal(report.changes.length, 9);
  assert.ok(report.changes.every((change) => change.status === "archived"));
  assert.ok(retainedRoomIds.every((name) => fake.byName.get(name)[0].archived === false));
});

test("#1297 reset mode is room-scoped, restores membership and verifies an empty replacement", async () => {
  const [guildhall, cleanup] = await Promise.all([readJson("config/buzz-guildhall.json"), readJson("config/buzz-community-cleanup.json")]);
  const fake = fakeBuzz();
  const oldId = fake.byName.get("great-hall")[0].channel_id;
  const report = await executeCleanup({ mode: "reset", roomId: "great-hall", confirmation: resetConfirmation("great-hall"), guildhall, cleanup, run: fake.run });
  const change = report.changes[0];
  assert.equal(change.status, "reset-clean");
  assert.equal(change.oldChannelId, oldId);
  assert.notEqual(change.newChannelId, oldId);
  assert.equal(change.restoredMembers, 1);
  assert.equal(fake.members.get(change.newChannelId).some((member) => member.role === "bot"), true);
});

test("#1297 Utilities is a packaged, documented front door with hidden credentials and guarded writes", async () => {
  const [docs, launcher, powershell, bootstrap, provisioner, packager] = await Promise.all([
    read("Utilities/README.md"),
    read("Utilities/Clean-PlotPickle-BUZZ.cmd"),
    read("Utilities/Clean-PlotPickle-BUZZ.ps1"),
    read("scripts/bootstrap-buzz-guildhall.mjs"),
    read("scripts/provision-community-agents.mjs"),
    read("scripts/package-platform.mjs"),
  ]);
  for (const utility of ["Start-PlotPickle.cmd", "Update-PlotPickle.cmd", "Repair-PlotPickle.cmd", "Verify-PlotPickle.cmd", "Check-ComfyUI.cmd", "Sync-PlotPickle-BUZZ.cmd", "Clean-PlotPickle-BUZZ.cmd"]) {
    assert.match(docs, new RegExp(utility.replaceAll(".", "\\."), "u"));
  }
  assert.match(launcher, /Clean-PlotPickle-BUZZ\.ps1/u);
  assert.match(powershell, /BUZZ private key" -AsSecureString/u);
  assert.match(powershell, /ARCHIVE 9 LEGACY ROOMS/u);
  assert.match(powershell, /Type RESET \$room/u);
  assert.match(powershell, /SetEnvironmentVariable\(\$name, \$null, "Process"\)/u);
  assert.doesNotMatch(powershell, /--(?:private-key|secret|token|auth-tag)/iu);
  assert.match(bootstrap, /const provisionedChannels = cleanup\.retainedRooms/u);
  assert.match(provisioner, /primaryChannel && contributedRoomIds\.has\(primaryChannel\)/u);
  assert.match(packager, /"Utilities"/u);
});
