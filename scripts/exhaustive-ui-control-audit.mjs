import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { delay, resultText, toolArguments } from "./creative-uat/mcp-runtime.mjs";
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

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
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

function controlKey(control, duplicates) {
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
        insideNavigation: Boolean(node.closest('header, nav, [role="navigation"]')),
        occurrence
      };
    });
    return JSON.stringify({ url: location.href, controls });
  }` });
  return parseRenderedEvaluateText(resultText(result));
}

function pageStateSignature(payload) {
  const controls = Array.isArray(payload?.controls) ? payload.controls : [];
  return hash(JSON.stringify({
    url: payload?.url || "",
    controls: controls.map((control) => ({
      role: control.role,
      label: control.label,
      value: control.value,
      checked: control.checked,
      disabled: control.disabled,
      detailsOpen: control.detailsOpen,
      selected: (control.options || []).filter((option) => option.selected).map((option) => option.value),
    })),
  }));
}

async function snapshot(client) {
  return resultText(await client.call("browser_snapshot", {}));
}

function refFor(control, snapshotText) {
  const candidates = snapshotControlRefs(snapshotText).filter((item) => item.role === control.role && normalize(item.label) === normalize(control.label));
  return candidates[control.occurrence || 0] || candidates[0] || null;
}

function clickArgs(tool, controlRef, label) {
  return toolArguments(tool, { element: label, ref: controlRef });
}

function typeArgs(tool, controlRef, label, text) {
  return toolArguments(tool, { element: label, ref: controlRef, text, slowly: false, submit: false });
}

function selectArgs(tool, controlRef, label, value) {
  const properties = tool?.inputSchema?.properties || {};
  const args = { element: label, ref: controlRef };
  if ("values" in properties) args.values = [value];
  else if ("value" in properties) args.value = value;
  return toolArguments(tool, args);
}

async function waitForSettledControlState(client, beforeSignature, longRunning) {
  const attempts = longRunning ? 90 : 8;
  let last = await inspectRenderedControls(client);
  let changed = pageStateSignature(last) !== beforeSignature;
  let stable = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await delay(longRunning ? 700 : 250);
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
  if (!target) return { status: "untested", detail: "Visible rendered control had no matching accessibility ref.", discovered: [] };
  const transactional = screen.id === "settings" || screen.id === "advanced-ai-routing";

  if (control.role === "combobox") {
    const tool = toolMap.get("browser_select_option");
    if (!tool) return { status: "untested", detail: "Playwright MCP did not expose browser_select_option.", discovered: [] };
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
    return { status: changed ? "pass" : "dead", detail: changed ? `Radio selection changed and ${transactional && original ? "the original selection was restored" : "the synthetic session retained the new choice"}.` : "Radio option produced no observable selection change.", discovered: changedPayload.controls || [] };
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
    detail: changed ? `${control.role} produced an observable ${navigated ? "navigation" : "UI/state response"}${longRunning ? " and reached a settled state" : ""}.` : `${control.role} was activated but the route, rendered controls, values and visible state did not change.`,
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

export async function runExhaustiveUiControlAudit({ client, toolMap, baseUrl, repoRoot, status = () => {} }) {
  const config = JSON.parse(await readFile(path.join(repoRoot, "config", "exhaustive-ui-uat.json"), "utf8"));
  const screens = [];
  const findings = [];
  let totalSafe = 0;
  let totalPassed = 0;
  let totalBlocked = 0;
  let totalDead = 0;
  let totalUntested = 0;

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
    let interactions = 0;

    while (queue.length && interactions < Number(screen.maxInteractions || 80)) {
      const item = queue.shift();
      const { control, blocked } = item;
      if (blocked) {
        records.push({ key: item.key, label: control.label, role: control.role, status: "blocked", detail: blocked });
        totalBlocked += 1;
        continue;
      }

      totalSafe += 1;
      interactions += 1;
      try {
        const result = await exerciseControl({ client, toolMap, baseUrl, screen, control, config });
        records.push({ key: item.key, label: control.label, role: control.role, status: result.status, detail: result.detail });
        if (result.status === "pass") totalPassed += 1;
        else if (result.status === "dead") {
          totalDead += 1;
          findings.push(finding("bug", "high", `${screen.label}: ${control.role} “${control.label}” can be activated but produces no observable result.`, "Every enabled pill, selector, field, button and navigation control should visibly change state, navigate, accept input, or return a result.", "A user can get trapped clicking controls without knowing whether anything happened.", `${screen.route} · ${control.role} · ${control.label}`));
        } else if (result.status === "untested") {
          totalUntested += 1;
          findings.push(finding("friction", "high", `${screen.label}: enabled ${control.role} “${control.label}” could not be exercised by the synthetic UAT runner.`, "Every enabled safe control should have a deterministic browser interaction path.", result.detail, `${screen.route} · ${control.role} · ${control.label}`));
        } else if (result.status === "blocked") totalBlocked += 1;
        queueControls(queue, known, result.discovered || [], screen, config);
      } catch (error) {
        totalUntested += 1;
        const detail = error instanceof Error ? error.message : String(error);
        records.push({ key: item.key, label: control.label, role: control.role, status: "untested", detail });
        findings.push(finding("bug", "high", `${screen.label}: ${control.role} “${control.label}” threw or stalled during synthetic UAT.`, "A safe visible control should complete without trapping the user or breaking the UAT session.", detail, `${screen.route} · ${control.role} · ${control.label}`));
        try { await restoreByNavigate(client, baseUrl, screen.route); } catch {}
      }
    }

    if (queue.length) {
      const remainingSafe = queue.filter((item) => !item.blocked);
      totalUntested += remainingSafe.length;
      if (remainingSafe.length) findings.push(finding("friction", "high", `${screen.label}: exhaustive UAT hit its interaction ceiling with ${remainingSafe.length} safe control(s) still untested.`, "The tester should reach a deterministic completion state instead of cycling through controls.", `Interaction ceiling ${screen.maxInteractions}; remaining: ${remainingSafe.slice(0, 8).map((item) => item.control.label).join(", ")}.`, screen.route));
      for (const item of queue) records.push({ key: item.key, label: item.control.label, role: item.control.role, status: item.blocked ? "blocked" : "untested", detail: item.blocked || "interaction ceiling reached" });
    }

    const roleSet = new Set(records.filter((item) => item.status === "pass").map((item) => item.role));
    for (const requiredRole of screen.requireRoles || []) {
      if (!roleSet.has(requiredRole)) findings.push(finding("friction", "high", `${screen.label}: exhaustive UAT did not complete any ${requiredRole} interaction.`, `The ${screen.label} acceptance path requires at least one working ${requiredRole}.`, "Required Settings control family was not proven.", screen.route));
    }

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
      safe: safeRecords.length,
      passed: records.filter((item) => item.status === "pass").length,
      blocked: records.filter((item) => item.status === "blocked").length,
      dead: records.filter((item) => item.status === "dead").length,
      untested: records.filter((item) => item.status === "untested").length,
      interactions,
      controls: records,
    });
    status(`Exhaustive UAT · ${screen.label}`, complete ? "PASS" : "FAIL", `${safeRecords.filter((item) => item.status === "pass").length}/${safeRecords.length} safe controls completed; ${records.filter((item) => item.status === "blocked").length} intentionally blocked`);
  }

  const complete = screens.every((screen) => screen.complete) && totalDead === 0 && totalUntested === 0;
  const result = {
    schemaVersion: 1,
    complete,
    screens,
    totals: { safe: totalSafe, passed: totalPassed, blocked: totalBlocked, dead: totalDead, untested: totalUntested },
    findings,
    noLoopPolicy: "Each distinct rendered control is attempted at most once per screen; newly revealed controls enter the queue once; interaction ceilings turn remaining safe controls into failures instead of loops.",
    settingsPolicy: "Settings selectors, toggles and inputs are exercised transactionally and restored before save actions; destructive, credential, cloud/account and paid controls are classified rather than changed.",
  };
  status("Phase 5 · exhaustive code/UI/UX UAT", complete ? "PASS" : "FAIL", `${totalPassed}/${totalSafe} safe control interactions passed; dead=${totalDead}; untested=${totalUntested}`);
  return result;
}
