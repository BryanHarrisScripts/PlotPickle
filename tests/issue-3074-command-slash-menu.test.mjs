import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CMD_SLASH_COMMANDS, findCmdSlashSuggestions } from "../app/_components/settings/cmd-slash-commands.mjs";
import { parsePlotPickleCreativeCommand } from "../app/_components/settings/plotpickle-creative-command.mjs";
import { parseAgentHealthCommand } from "../core/agents/health/command.mjs";
import { parseConnectionCommand } from "../app/_components/settings/connection-command.mjs";
import { parseCmdSourceProposal } from "../core/contracts/imported-screenplay-evidence/cmd-source-proposal.mjs";

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");

test("CMD typing / exposes actual accepted commands, including the ASSETS OpenPencil fix", async () => {
  const entries = findCmdSlashSuggestions("/");
  const names = entries.map(({ command }) => command);
  assert.equal(entries.length, CMD_SLASH_COMMANDS.length);
  assert.ok(entries.length >= 20);
  for (const name of ["OpenPencil open ASSETS", "OpenPencil review ASSETS", "OpenPencil open Timeline",
    "PlotPickle status", "PlotPickle library", "PlotPickle agents inventory",
    "PlotPickle connections status", "PlotPickle connections setup openai", "PlotPickle mind-map fields foundations"]) {
    assert.ok(names.includes(name), name);
  }
  const registry = JSON.parse(await read("designs/openpencil/surfaces.json"));
  for (const item of entries.filter((entry) => /^OpenPencil (?:open|review) /u.test(entry.command))) {
    const page = item.command.replace(/^OpenPencil (?:open|review) /u, "");
    assert.ok(registry.surfaces.some((surface) => surface.name === page), "unregistered design: " + page);
  }
});

test("Slash search filters by phrase and help/category; never hijacks free-form narration", () => {
  assert.deepEqual(findCmdSlashSuggestions(""), []);
  assert.deepEqual(findCmdSlashSuggestions("Can you inspect /Timeline?"), []);
  assert.deepEqual(findCmdSlashSuggestions("/status\nanything"), []);
  assert.deepEqual(findCmdSlashSuggestions("/openpencil assets").map(x => x.command), [
    "OpenPencil open ASSETS", "OpenPencil review ASSETS",
  ]);
  assert.ok(findCmdSlashSuggestions(" /AGENTS").every(x => x.category === "Agents"));
  assert.deepEqual(findCmdSlashSuggestions("/definitely-no-command"), []);
  assert.equal(findCmdSlashSuggestions("/", 3).length, 3);
  assert.equal(findCmdSlashSuggestions("/", -3).length, 0);
  assert.equal(new Set(CMD_SLASH_COMMANDS.map(x => x.command)).size, CMD_SLASH_COMMANDS.length);
});

test("Non-template slash suggestions have existing bounded command parsers", () => {
  for (const { command } of CMD_SLASH_COMMANDS) {
    if (command.includes("<")) continue; // requires the Human to supply an exact project identity
    if (command.startsWith("OpenPencil")) continue; // TS parser checked by the existing #2787 suite
    const message = "/" + command;
    const parser = command.startsWith("PlotPickle agents ")
      ? parseAgentHealthCommand
      : command.startsWith("PlotPickle connections ")
        ? parseConnectionCommand
        : /^PlotPickle (?:mind-map|world-map) /u.test(command)
          ? parseCmdSourceProposal
          : parsePlotPickleCreativeCommand;
    const parsed = parser(message);
    assert.ok(parsed && parsed.action !== "invalid", message);
  }
});

test("Slash menu is composer-only, accessible, and never auto-runs an operation", async () => {
  const [source, styles, parser] = await Promise.all([
    read("app/skin-v1/global-dsdd-conversation.tsx"),
    read("app/skin-v1/global-dsdd-conversation.module.css"),
    read("app/_components/settings/openpencil-command.ts"),
  ]);
  assert.match(source, /data-cmd-slash-menu="true"/u);
  assert.match(source, /role="listbox"/u);
  assert.match(source, /role="option"/u);
  assert.match(source, /aria-autocomplete=\{embedded \? "list" : undefined\}/u);
  assert.match(source, /event\.key === "ArrowDown"/u);
  assert.match(source, /event\.key === "ArrowUp"/u);
  assert.match(source, /event\.key === "Escape"/u);
  assert.match(source, /chooseSlashCommand\(slashSuggestions\[activeSlashIndex\]\.command\)/u);
  const select = source.slice(source.indexOf("  function chooseSlashCommand("), source.indexOf("  const latestHumanIndex"));
  assert.ok(select.includes('setDraft(`/${command}`)'));
  assert.doesNotMatch(select, /fetch\(|submit\(|runOpenPencilCommand|runCreative|publishBrief/u);
  assert.match(styles, /\.slashMenuOption\[aria-selected="true"\]/u);
  assert.match(parser, /const surfaceName = cleanRoot/u);
  assert.match(source, /if \(embedded && submitted\.startsWith\("\/"\)/u);
  assert.match(source, /setSlashOpen\(false\);\s*if \(await runCmdSourceProposal/u);
});
