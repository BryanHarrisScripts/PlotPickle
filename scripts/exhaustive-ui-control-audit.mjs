import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { delay, isMcpToolArgumentError, resultText, toolArguments } from "./creative-uat/mcp-runtime.mjs";
import { parseRenderedEvaluateText } from "./writer-visual-observer.mjs";

const interactiveSourcePatterns = {
  buttons: /<button\b/gi,
  inputs: /<input\b/gi,
  selects: /<select\b/gi,
  textareas: /<textarea\b/gi,
  summaries: /<summary\b/gi,
  links: /<a\b/gi,
  onClick: /\bonClick\s*=/g,
  onChange: /\bonChange\s*=/g,
  onSubmit: /\bonSubmit\s*=/g,
};

const disclosurePattern = /advanced setup|advanced runtime details|cloud and legacy provider overrides|details|options/i;
const navigationPattern = /community|learn|plan|game|settings|back to|return to|advanced ai routing/i;
const formRole = new Set(["textbox", "searchbox", "spinbutton", "combobox", "checkbox", "radio", "switch"]);
const accessibilityStopWords = new Set(["a", "an", "the", "to", "of", "for", "in", "on", "at", "by", "with", "and", "or"]);

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeAccessibilityLabel(value) {
  return normalize(String(value || "").replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " "));
}

function accessibilityTokens(value) {
  return normalizeAccessibilityLabel(value)
    .split(" ")
    .filter((token) => token.length > 1 && !accessibilityStopWords.has(token));
}

function tokenSubset(left, right) {
  const target = new Set(right);
  return left.every((token) => target.has(token));
}

function hash(value) {
  return createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

export function sourceInteractionCounts(source) {
  const counts = {};
  for (const [key, pattern] of Object.entries(interactiveSourcePatterns)) {
    counts[key] = [...String(source || "").matchAll(new RegExp(pattern.source, pattern.flags))].length;
  }
  counts.totalMarkupControls = counts.buttons + counts.inputs + counts.selects + counts.textareas + counts.summaries + counts.links;
  counts.totalHandlers = counts.onClick + counts.onChange + counts.onSubmit;
  return counts;
}

export function snapshotControlRefs(snapshot) {
  const output = [];
  const seen = new Map();
  const pattern = /(?:^|\n)\s*-\s*(button|link|tab|textbox|searchbox|combobox|checkbox|radio|switch|spinbutton)\s+(?:"([^"]*)")?[^\n]*?\[ref=([^\]]+)\]/gi;
  let match;
  while ((match = pattern.exec(String(snapshot || "")))) {
    const role = match[1].toLowerCase();
    const label = String(match[2] || "").trim();
    if (!label) continue;
    const base = `${role}|${normalize(label)}`;
    const occurrence = seen.get(base) || 0;
    seen.set(base, occurrence + 1);
    output.push({ role, label, ref: match[3], occurrence });
  }
  return output;
}

function finding(kind, severity, summary, expectation, impact, evidence = "") {
  return { kind, severity, actionable: severity !== "low", summary, expectation, impact, evidence };
}

export function controlKey(control, duplicates) {
  const base = `${control.role}|${normalize(control.label)}|${control.type || ""}|${control.name || ""}`;
  return duplicates ? `${base}|${control.occurrence || 0}` : base;
}

function unsafeReason(control, config) {
  const text = normalize(`${control.label} ${control.name} ${control.placeholder} ${control.href}`);
  if (control.disabled) return "disabled in the current rendered state";
  if ((config.credentialPatterns || []).some((value) => text.includes(normalize(value)))) return "credential or secret field";
  if ((config.unsafeControlLabels || []).some((value) => text.includes(normalize(value)))) return "destructive, external-account, paid, or cloud-changing action";
  if (control.type === "file") return "file picker requires a real user-selected file";
  return "";
}

function priority(control) {
  if (disclosurePattern.test(control.label)) return 0;
  if (formRole.has(control.role)) return 1;
  if (control.role === "button") return 2;
  if (control.role === "tab") return 3;
  if (control.role === "link" || navigationPattern.test(control.label)) return 4;
  return 2;
}

async function inspectRenderedControls(client) {
  const result = await client.call("browser_evaluate", { function: `() => {
    const hiddenByClosedDetails = (node) => {
      const details = node?.closest?.('details:not([open])');
      if (!details) return false;
      const summary = details.querySelector(':scope > summary');
      return !summary || (node !== summary && !summary.contains(node));
    };
    const visible = (node) => {
      if (!node || !(node instanceof Element) || hiddenByClosedDetails(node)) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.02 && rect.width > 1 && rect.height > 1;
    };
    const associatedLabel = (node) => {
      const aria = node.getAttribute('aria-label');
      if (aria) return aria;
      if (node.id) {
        const label = document.querySelector('label[for="' + CSS.escape(node.id) + '"]');
        if (label?.textContent) return label.textContent;
      }
      const parentLabel = node.closest('label');
      if (parentLabel?.textContent) return parentLabel.textContent;
      return node.textContent || node.getAttribute('placeholder') || node.getAttribute('title') || node.getAttribute('name') || '';
    };
    const role = (node) => {
      const explicit = node.getAttribute('role');
      if (explicit) return explicit;
      const tag = node.tagName.toLowerCase();
      if (tag === 'a') return 'link';
      if (tag === 'button' || tag === 'summary') return 'button';
      if (tag === 'select') return 'combobox';
      if (tag === 'textarea') return 'textbox';
      if (tag === 'input') {
        const type = (node.getAttribute('type') || 'text').toLowerCase();
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';
        if (type === 'number' || type === 'range') return 'spinbutton';
        if (type === 'search') return 'searchbox';
        return 'textbox';
      }
      return tag;
    };
    const nodes = [...document.querySelectorAll('button, a, input, textarea, select, summary, [role="button"], [role="tab"], [role="switch"], [role="radio"], [role="checkbox"]')]
      .filter(visible);
    const occurrences = new Map();
    const controls = nodes.map((node) => {
      const controlRole = role(node);
      const label = String(associatedLabel(node)).replace(/\\s+/g, ' ').trim().slice(0, 180) || '<unnamed control>';
      const base = controlRole + '|' + label.toLowerCase();
      const occurrence = occurrences.get(base) || 0;
      occurrences.set(base, occurrence + 1);
      const options = node instanceof HTMLSelectElement ? [...node.options].map((option) => ({ value: option.value, label: option.textContent || option.label || option.value, selected: option.selected, disabled: option.disabled })) : [];
      const details = node.tagName.toLowerCase() === 'summary' ? node.parentElement : node.closest('details');
      return {
        role: controlRole,
        tag: node.tagName.toLowerCase(),
        type: (node.getAttribute('type') || '').toLowerCase(),
        name: node.getAttribute('name') || '',
        label,
        placeholder: node.getAttribute('placeholder') || '',
        value: 'value' in node ? String(node.value ?? '') : '',
        checked: 'checked' in node ? Boolean(node.checked) : null,
        disabled: Boolean(node.disabled || node.getAttribute('aria-disabled') === 'true'),
        href: node instanceof HTMLAnchorElement ? node.href : '',
        min: node.getAttribute('min') || '',
        max: node.getAttribute('max') || '',
        options,
        detailsOpen: details instanceof HTMLDetailsElement ? details.open : null,
        ariaSelected: node.getAttribute('aria-selected') || '',
        ariaExpanded: node.getAttribute('aria-expanded') || '',
        ariaPressed: node.getAttribute('aria-pressed') || '',
        ariaCurrent: node.getAttribute('aria-current') || '',
        dataState: node.getAttribute('data-state') || '',
        insideNavigation: Boolean(node.closest('header, nav, [role="navigation"]')),
        occurrence
      };
    });
    const headings = [...document.querySelectorAll('h1, h2, h3, [role="heading"]')]
      .filter(visible)
      .map((node) => String(node.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 240))
      .filter(Boolean);
    const statusText = [...document.querySelectorAll('[role="status"], [role="alert"]')]
      .filter(visible)
      .map((node) => String(node.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 300))
      .filter(Boolean);
    return JSON.stringify({ url: location.href, controls, headings, statusText });
  }` });
  return parseRenderedEvaluateText(resultText(result));
}

export function pageStateSignature(payload) {
  const controls = Array.isArray(payload?.controls) ? payload.controls : [];
  return hash(JSON.stringify({
    url: payload?.url || "",
    headings: Array.isArray(payload?.headings) ? payload.headings : [],
    statusText: Array.isArray(payload?.statusText) ? payload.statusText : [],
    controls: controls.map((control) => ({
      role: control.role,
      label: control.label,
      value: control.value,
      checked: control.checked,
      disabled: control.disabled,
      detailsOpen: control.detailsOpen,
      ariaSelected: control.ariaSelected,
      ariaExpanded: control.ariaExpanded,
      ariaPressed: control.ariaPressed,
      ariaCurrent: control.ariaCurrent,
      dataState: control.dataState,
      selected: (control.options || []).filter((option) => option.selected).map((option) => option.value),
    })),
  }));
}

async function snapshot(client) {
  return resultText(await client.call("browser_snapshot", {}));
}

export function refFor(control, snapshotText) {
  const sameRole = snapshotControlRefs(snapshotText).filter((item) => item.role === control.role);
  const exact = sameRole.filter((item) => normalize(item.label) === normalize(control.label));
  if (exact.length) return exact[control.occurrence || 0] || exact[0] || null;

  const canonical = sameRole.filter((item) => normalizeAccessibilityLabel(item.label) === normalizeAccessibilityLabel(control.label));
  if (canonical.length) return canonical[control.occurrence || 0] || canonical[0] || null;

  const wantedTokens = accessibilityTokens(control.label);
  if (wantedTokens.length < 2) return null;
  const relaxed = sameRole.filter((item) => {
    const candidateTokens = accessibilityTokens(item.label);
    if (candidateTokens.length < 2) return false;
    return tokenSubset(wantedTokens, candidateTokens) || tokenSubset(candidateTokens, wantedTokens);
  });
  return relaxed.length === 1 ? relaxed[0] : null;
}

export function clickArgs(tool, controlRef, label) {
  return toolArguments(tool, { element: label, ref: controlRef });
}

export function typeArgs(tool, controlRef, label, text) {
  return toolArguments(tool, { element: label, ref: controlRef, text, slowly: false, submit: false });
}

export function selectArgs(tool, controlRef, label, value) {
  const properties = tool?.inputSchema?.properties || {};
  const args = { element: label, ref: controlRef };
  if ("values" in properties) args.values = [value];
  else if ("value" in properties) args.value = value;
  return toolArguments(tool, args);
}

async function waitForSettledControlState(client, beforeSignature, longRunning) {
  const attempts = longRunning ? 32 : 8;
  let last = await inspectRenderedControls(client);
  let changed = pageStateSignature(last) !== beforeSignature;
  let stable = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await delay(longRunning ? 500 : 250);
    const current = await inspectRenderedControls(client);
    const signature = pageStateSignature(current);
    changed ||= signature !== beforeSignature;
    if (signature === pageStateSignature(last)) stable += 1;
    else stable = 0;
    last = current;
    if (changed && stable >= 2) break;
  }
  return { payload: last, changed };
}

async function restoreByNavigate(client, baseUrl, route) {
  await client.call("browser_navigate", { url: new URL(route, baseUrl).toString() });
  await delay(450);
}

async function exerciseControl({ client, toolMap, baseUrl, screen, control, config }) {
  const beforePayload = await inspectRenderedControls(client);
  const beforeSignature = pageStateSignature(beforePayload);
  const snapshotText = await snapshot(client);
  const target = refFor(control, snapshotText);
  if (!target) return { status: "accessibility", detail: "Visible rendered control had no matching accessibility ref in the current snapshot.", discovered: [] };
  const transactional = screen.id === "settings" || screen.id === "advanced-ai-routing";

  if (control.role === "combobox") {
    const tool = toolMap.get("browser_select_option");
    if (!tool) return { status: "harness", detail: "Playwright MCP did not expose browser_select_option.", discovered: [] };
    const current = (control.options || []).find((option) => option.selected);
    const alternative = (control.options || []).find((option) => !option.disabled && !option.selected);
    if (!alternative) return { status: "blocked", detail: "Selector has no alternative enabled option in this state.", discovered: [] };
    await client.call("browser_select_option", selectArgs(tool, target.ref, control.label, alternative.value));
    await delay(350);
    const changedPayload = await inspectRenderedControls(client);
    const changed = pageStateSignature(changedPayload) !== beforeSignature;
    if (transactional && current) {
      const freshTarget = refFor(control, await snapshot(client));
      if (freshTarget) await client.call("browser_select_option", selectArgs(tool, freshTarget.ref, control.label, current.value));
      await delay(250);
    }
    return { status: changed ? "pass" : "dead", detail: changed ? `Selector changed to ${alternative.label} and ${transactional ? "was restored" : "remained selected for the synthetic session"}.` : "Selector accepted an interaction but produced no observable state change.", discovered: changedPayload.controls || [] };
  }

  if (["checkbox", "switch"].includes(control.role)) {
    const tool = toolMap.get("browser_click");
    await client.call("browser_click", clickArgs(tool, target.ref, control.label));
    await delay(300);
    const changedPayload = await inspectRenderedControls(client);
    const changedControl = (changedPayload.controls || []).find((item) => item.role === control.role && normalize(item.label) === normalize(control.label) && item.occurrence === control.occurrence);
    const changed = changedControl ? changedControl.checked !== control.checked : pageStateSignature(changedPayload) !== beforeSignature;
    if (transactional) {
      const freshTarget = refFor(control, await snapshot(client));
      if (freshTarget) await client.call("browser_click", clickArgs(tool, freshTarget.ref, control.label));
      await delay(250);
    }
    return { status: changed ? "pass" : "dead", detail: changed ? `Toggle changed state and ${transactional ? "was restored" : "remained in the synthetic session"}.` : "Toggle did not visibly change state.", discovered: changedPayload.controls || [] };
  }

  if (control.role === "radio") {
    const siblings = (beforePayload.controls || []).filter((item) => item.role === "radio" && item.name && item.name === control.name);
    const original = siblings.find((item) => item.checked);
    if (control.checked) return { status: "pass", detail: "Radio option is already the active selection; its sibling options exercise the group transition.", discovered: [] };
    await client.call("browser_click", clickArgs(toolMap.get("browser_click"), target.ref, control.label));
    await delay(300);
    const changedPayload = await inspectRenderedControls(client);
    const changed = pageStateSignature(changedPayload) !== beforeSignature;
    if (transactional && original) {
      const originalRef = refFor(original, await snapshot(client));
      if (originalRef) await client.call("browser_click", clickArgs(toolMap.get("browser_click"), originalRef.ref, original.label));
      await delay(250);
    }
    return { status: changed ? "pass" : "dead", detail: changed ? `Radio selection changed and ${transactional && original ? "the original selection was restored" : "the synthetic session retained the new choice"}.` : "Radio option produced no observable selection change.", discovered: [] };
  }

  if (["textbox", "searchbox", "spinbutton"].includes(control.role)) {
    const original = control.value || "";
    let testValue = `PlotPickle synthetic UAT — ${screen.id}`;
    if (control.role === "spinbutton") {
      const numeric = Number(original || 0);
      const min = control.min === "" ? -999999 : Number(control.min);
      const max = control.max === "" ? 999999 : Number(control.max);
      testValue = String(Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric + 1 : 1)));
    }
    await client.call("browser_type", typeArgs(toolMap.get("browser_type"), target.ref, control.label, testValue));
    await delay(300);
    const changedPayload = await inspectRenderedControls(client);
    const changedControl = (changedPayload.controls || []).find((item) => item.role === control.role && normalize(item.label) === normalize(control.label) && item.occurrence === control.occurrence);
    const changed = changedControl ? changedControl.value !== original : pageStateSignature(changedPayload) !== beforeSignature;
    if (transactional) {
      const freshTarget = refFor(control, await snapshot(client));
      if (freshTarget) await client.call("browser_type", typeArgs(toolMap.get("browser_type"), freshTarget.ref, control.label, original));
      await delay(250);
    }
    return { status: changed ? "pass" : "dead", detail: changed ? `Input accepted a synthetic value and ${transactional ? "was restored before any save action" : "remained populated so dependent buttons can be exercised"}.` : "Input did not retain the typed value.", discovered: changedPayload.controls || [] };
  }

  const clickTool = toolMap.get("browser_click");
  await client.call("browser_click", clickArgs(clickTool, target.ref, control.label));
  const immediate = await inspectRenderedControls(client);
  const longRunning = (config.longRunningActionPatterns || []).some((pattern) => normalize(control.label).includes(normalize(pattern)));
  const settled = await waitForSettledControlState(client, beforeSignature, longRunning);
  const changed = pageStateSignature(immediate) !== beforeSignature || settled.changed;
  const navigated = String(settled.payload?.url || "") !== String(beforePayload?.url || "");
  const discovered = [...(immediate.controls || []), ...(settled.payload.controls || [])];

  if (navigated) await restoreByNavigate(client, baseUrl, screen.route);
  return {
    status: changed ? "pass" : "dead",
    detail: changed ? `${control.role} produced an observable ${navigated ? "navigation" : "UI/state response"}${longRunning ? " and reached a settled state" : ""}.` : `${control.role} was activated but the route, rendered controls, values, semantic state, headings and visible status did not change.`,
    discovered,
  };
}

async function sourceInventory(repoRoot, screen) {
  const files = [];
  for (const relative of screen.sourceFiles || []) {
    const file = path.join(repoRoot, relative);
    try {
      const source = await readFile(file, "utf8");
      files.push({ path: relative, sha: hash(source), bytes: Buffer.byteLength(source), counts: sourceInteractionCounts(source), missing: false });
    } catch (error) {
      files.push({ path: relative, sha: "", bytes: 0, counts: sourceInteractionCounts(""), missing: true, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return files;
}

function queueControls(queue, known, controls, screen, config) {
  const candidates = [];
  for (const control of controls || []) {
    if (!control?.label) continue;
    const key = controlKey(control, screen.testDuplicateInstances === true);
    if (known.has(key)) continue;
    known.add(key);
    const blocked = unsafeReason(control, config);
    candidates.push({ key, control, blocked, priority: priority(control) });
  }
  candidates.sort((a, b) => a.priority - b.priority);
  queue.unshift(...candidates);
}

function findCurrentControl(controls, item, screen) {
  return (controls || []).find((control) => controlKey(control, screen.testDuplicateInstances === true) === item.key) || null;
}

function screenCounts(records) {
  const count = (status) => records.filter((item) => item.status === status).length;
  const blocked = count("blocked");
  const harness = count("harness");
  const accessibility = count("accessibility");
  const unreached = count("unreached");
  return {
    safe: records.length - blocked,
    passed: count("pass"),
    blocked,
    dead: count("dead"),
    harness,
    accessibility,
    unreached,
    untested: harness + accessibility + unreached,
  };
}

export async function runExhaustiveUiControlAudit({ client, toolMap, baseUrl, repoRoot, status = () => {} }) {
  const config = JSON.parse(await readFile(path.join(repoRoot, "config", "exhaustive-ui-uat.json"), "utf8"));
  const screens = [];
  const findings = [];

  status("Phase 5 · exhaustive code/UI/UX UAT", "START", `${config.screens.length} active screen(s)`);
  for (const screen of config.screens) {
    status(`Exhaustive UAT · ${screen.label}`, "START");
    const sourceFiles = await sourceInventory(repoRoot, screen);
    for (const source of sourceFiles.filter((item) => item.missing)) {
      findings.push(finding("bug", "high", `${screen.label}: code-aware UAT could not read ${source.path}.`, "Every active screen should have auditable implementation source attached to its UAT contract.", source.error || "Source file missing.", source.path));
    }

    await restoreByNavigate(client, baseUrl, screen.route);
    let payload = await inspectRenderedControls(client);
    const queue = [];
    const known = new Set();
    const records = [];
    queueControls(queue, known, payload.controls || [], screen, config);
    const initialSafeControls = queue.filter((item) => !item.blocked).length;
    const interactionLimit = Math.max(Number(screen.maxInteractions || 80), initialSafeControls);
    let interactions = 0;

    while (queue.length && interactions < interactionLimit) {
      const item = queue.shift();
      const { blocked } = item;
      if (blocked) {
        records.push({ key: item.key, label: item.control.label, role: item.control.role, status: "blocked", detail: blocked });
        continue;
      }

      let currentPayload = await inspectRenderedControls(client);
      let control = findCurrentControl(currentPayload.controls, item, screen);
      if (!control) {
        try {
          await restoreByNavigate(client, baseUrl, screen.route);
          currentPayload = await inspectRenderedControls(client);
          control = findCurrentControl(currentPayload.controls, item, screen);
        } catch {}
      }
      if (!control) {
        records.push({ key: item.key, label: item.control.label, role: item.control.role, status: "unreached", detail: "Control was discovered earlier but is not reachable in the current or restored screen state." });
        findings.push(finding("unreached", "high", `${screen.label}: enabled ${item.control.role} “${item.control.label}” was discovered but could not be reached again.`, "A discovered safe control should have a reproducible state path before it is judged as product behavior.", "The control disappeared after another interaction and was not present after restoring the screen route.", `${screen.route} · ${item.control.role} · ${item.control.label}`));
        continue;
      }

      interactions += 1;
      try {
        const result = await exerciseControl({ client, toolMap, baseUrl, screen, control, config });
        records.push({ key: item.key, label: control.label, role: control.role, status: result.status, detail: result.detail });
        if (result.status === "dead") {
          findings.push(finding("bug", "high", `${screen.label}: ${control.role} “${control.label}” can be activated but produces no observable result.`, "Every enabled pill, selector, field, button and navigation control should visibly change state, navigate, accept input, or return a result.", "The Playwright interaction completed successfully, but PlotPickle produced no observable route, control, semantic, heading or status change.", `${screen.route} · ${control.role} · ${control.label}`));
        } else if (result.status === "accessibility") {
          findings.push(finding("accessibility", "high", `${screen.label}: enabled ${control.role} “${control.label}” has no current accessibility target.`, "Every visible safe control should be represented by a deterministic accessibility snapshot target.", result.detail, `${screen.route} · ${control.role} · ${control.label}`));
        } else if (result.status === "harness") {
          findings.push(finding("harness", "high", `${screen.label}: ${control.role} “${control.label}” could not be exercised because the browser harness lacks a required tool.`, "The exhaustive runner should distinguish browser-harness capability from product behavior.", result.detail, `${screen.route} · ${control.role} · ${control.label}`));
        }
        queueControls(queue, known, result.discovered || [], screen, config);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        records.push({ key: item.key, label: control.label, role: control.role, status: "harness", detail });
        findings.push(finding("harness", "high", `${screen.label}: ${control.role} “${control.label}” could not be completed by the synthetic browser harness.`, "Browser-tool failures must be separated from product dead-control findings.", `${isMcpToolArgumentError(error) ? "MCP argument validation: " : "Browser harness: "}${detail}`, `${screen.route} · ${control.role} · ${control.label}`));
        try { await restoreByNavigate(client, baseUrl, screen.route); } catch {}
      }
    }

    if (queue.length) {
      const remainingSafe = queue.filter((item) => !item.blocked);
      if (remainingSafe.length) findings.push(finding("unreached", "high", `${screen.label}: exhaustive UAT reached its bounded follow-up ceiling with ${remainingSafe.length} newly discovered safe control(s) still unreached.`, "All controls visible at screen entry are budgeted automatically; the configured ceiling only bounds additional state expansion.", `Effective interaction ceiling ${interactionLimit}; remaining: ${remainingSafe.slice(0, 8).map((item) => item.control.label).join(", ")}.`, screen.route));
      for (const item of queue) records.push({ key: item.key, label: item.control.label, role: item.control.role, status: item.blocked ? "blocked" : "unreached", detail: item.blocked || "bounded follow-up ceiling reached" });
    }

    const roleSet = new Set(records.filter((item) => item.status === "pass").map((item) => item.role));
    for (const requiredRole of screen.requireRoles || []) {
      if (!roleSet.has(requiredRole)) findings.push(finding("harness", "high", `${screen.label}: exhaustive UAT did not complete any ${requiredRole} interaction.`, `The ${screen.label} acceptance path requires at least one working ${requiredRole}.`, "Required Settings control family was not proven.", screen.route));
    }

    const counts = screenCounts(records);
    const safeRecords = records.filter((item) => item.status !== "blocked");
    const complete = sourceFiles.every((item) => !item.missing)
      && safeRecords.every((item) => item.status === "pass")
      && !queue.some((item) => !item.blocked);
    screens.push({
      id: screen.id,
      label: screen.label,
      route: screen.route,
      complete,
      sourceFiles,
      discovered: records.length,
      ...counts,
      interactions,
      interactionLimit,
      initialSafeControls,
      controls: records,
    });
    status(`Exhaustive UAT · ${screen.label}`, complete ? "PASS" : "FAIL", `${counts.passed}/${counts.safe} safe controls passed; blocked=${counts.blocked}; dead=${counts.dead}; harness=${counts.harness}; accessibility=${counts.accessibility}; unreached=${counts.unreached}`);
  }

  const totals = screens.reduce((acc, screen) => {
    for (const key of ["safe", "passed", "blocked", "dead", "harness", "accessibility", "unreached", "untested"]) acc[key] += Number(screen[key] || 0);
    return acc;
  }, { safe: 0, passed: 0, blocked: 0, dead: 0, harness: 0, accessibility: 0, unreached: 0, untested: 0 });
  const complete = screens.every((screen) => screen.complete)
    && totals.dead === 0
    && totals.harness === 0
    && totals.accessibility === 0
    && totals.unreached === 0;
  const result = {
    schemaVersion: 2,
    complete,
    screens,
    totals,
    findings,
    noLoopPolicy: "Each distinct rendered control is attempted at most once per screen. All safe controls visible at screen entry are automatically budgeted; newly revealed controls enter the queue once and remain bounded. Stale controls are restored before being classified as unreachable.",
    settingsPolicy: "Settings selectors, toggles and inputs are exercised transactionally and restored before save actions; destructive, credential, cloud/account and paid controls are classified rather than changed.",
  };
  status("Phase 5 · exhaustive code/UI/UX UAT", complete ? "PASS" : "FAIL", `${totals.passed}/${totals.safe} safe control interactions passed; dead=${totals.dead}; harness=${totals.harness}; accessibility=${totals.accessibility}; unreached=${totals.unreached}`);
  return result;
}
