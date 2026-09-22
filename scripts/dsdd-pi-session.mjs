#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { ensureManagedPiInstalled } from "./pi-managed-install.mjs";

async function readStdin() {
  let value = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) value += chunk;
  return JSON.parse(value || "{}");
}

function clean(value, max = 12000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function piModule(root) {
  const entry = path.join(root, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "index.js");
  return import(pathToFileURL(entry).href);
}

function openSession(SessionManager, input) {
  const cwd = path.resolve(clean(input.cwd, 4096) || process.cwd());
  const sessionDir = path.resolve(clean(input.sessionDir, 4096));
  if (!sessionDir) throw new Error("DSDD Pi session directory is required.");
  if (input.sessionFile) return SessionManager.open(path.resolve(input.sessionFile), sessionDir, cwd);
  const sessionId = clean(input.sessionId, 180);
  if (!sessionId) throw new Error("DSDD Pi session id is required.");
  return SessionManager.create(cwd, sessionDir, { id: sessionId });
}

function userMessage(text) {
  return { role: "user", content: text, timestamp: Date.now() };
}

function assistantMessage(text) {
  return { role: "assistant", content: text, timestamp: Date.now() };
}

async function main() {
  const input = await readStdin();
  const managed = await ensureManagedPiInstalled({ allowInstall: input.allowInstall !== false });
  if (managed.version !== "0.87.0") throw new Error(`DSDD persistent sessions require Pi 0.87.0; resolved ${managed.version || "unknown"}.`);
  const { SessionManager } = await piModule(managed.root);
  await mkdir(path.resolve(input.sessionDir), { recursive: true });
  const session = openSession(SessionManager, input);
  let entryId = "";

  if (input.action === "append-human") {
    const text = clean(input.text);
    if (!text) throw new Error("Human narration is required.");
    entryId = session.appendMessage(userMessage(text));
    session.appendCustomEntry("plotpickle-dsdd-human-context", {
      messageEntryId: entryId,
      context: input.context || null,
      recordedAt: new Date().toISOString(),
    });
    const persistenceCheckpointId = session.appendMessage(assistantMessage("DSDD interpretation pending."));
    session.appendContextEdit(persistenceCheckpointId, null);
    session.appendCustomEntry("plotpickle-dsdd-persistence-checkpoint", {
      humanMessageEntryId: entryId,
      hiddenAssistantEntryId: persistenceCheckpointId,
      recordedAt: new Date().toISOString(),
    });
  } else if (input.action === "append-interpretation") {
    const text = clean(input.text);
    if (!text) throw new Error("DSDD interpretation is required.");
    entryId = session.appendMessage(assistantMessage(text));
    session.appendCustomEntry("plotpickle-dsdd-interpretation", {
      messageEntryId: entryId,
      context: input.context || null,
      recordedAt: new Date().toISOString(),
    });
  } else if (input.action === "lock-intent") {
    const intent = input.intent && typeof input.intent === "object" ? input.intent : null;
    if (!intent) throw new Error("Locked DSDD intent is required.");
    const targetEntryId = clean(input.targetEntryId, 180);
    const lockedText = clean(input.lockedText);
    if (!lockedText) throw new Error("Locked DSDD intent text is required.");
    if (targetEntryId) session.appendContextEdit(targetEntryId, { content: lockedText });
    entryId = session.appendCustomMessageEntry(
      "plotpickle-dsdd-locked-intent",
      lockedText,
      false,
      { intentVersion: intent.version, locked: true },
    );
    session.appendCustomEntry("plotpickle-dsdd-intent-lock", {
      intent,
      lockedMessageEntryId: entryId,
      recordedAt: new Date().toISOString(),
    });
  } else if (input.action === "append-developer-brief") {
    const text = clean(input.text, 12000);
    if (!text) throw new Error("DSDD Pi developer brief is required.");
    entryId = session.appendCustomMessageEntry(
      "plotpickle-dsdd-developer-brief",
      text,
      false,
      { intentVersion: input.intentVersion, readOnly: true },
    );
    session.appendCustomEntry("plotpickle-dsdd-developer-brief-provenance", {
      briefEntryId: entryId,
      intentVersion: input.intentVersion,
      tools: ["read", "grep", "find", "ls"],
      repositoryMutation: false,
      recordedAt: new Date().toISOString(),
    });
  } else if (input.action === "record-publication") {
    entryId = session.appendCustomEntry("plotpickle-dsdd-github-issue-publication", {
      intentVersion: input.intentVersion,
      publication: input.publication || null,
      recordedAt: new Date().toISOString(),
    });
  } else if (input.action === "record-evidence") {
    entryId = session.appendCustomEntry("plotpickle-dsdd-evidence", {
      intentVersion: input.intentVersion,
      requirements: Array.isArray(input.requirements) ? input.requirements : [],
      recordedAt: new Date().toISOString(),
    });
  } else {
    throw new Error("Unsupported DSDD Pi session action.");
  }

  const projection = session.buildSessionProjection();
  process.stdout.write(JSON.stringify({
    ok: true,
    piVersion: managed.version,
    sessionId: session.getSessionId(),
    sessionFile: session.getSessionFile() || "",
    entryId,
    rawEntryCount: session.getEntries().length,
    projectedMessageCount: projection.messages.length,
  }));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
