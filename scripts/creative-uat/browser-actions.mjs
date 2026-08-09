import { consoleHasErrors, delay, extractPageState, extractRef, resultText, slug, toolArguments } from "./mcp-runtime.mjs";

export function createCreativeBrowser(client, tools, { baseUrl, runnerFindings, evidence }) {
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  const has = (name) => toolMap.has(name);
  for (const required of ["browser_navigate", "browser_snapshot", "browser_click", "browser_evaluate", "browser_take_screenshot"]) {
    if (!has(required)) throw new Error(`Playwright MCP is missing required tool ${required}.`);
  }

  const navigate = async (url) => client.call("browser_navigate", { url });
  const snapshot = async () => resultText(await client.call("browser_snapshot", {}));
  const evaluate = async (fn) => extractPageState(resultText(await client.call("browser_evaluate", { function: fn })));
  const currentState = async () => evaluate(`() => {
    let project = null;
    try { project = JSON.parse(localStorage.getItem('plotpickle.project.v1') || 'null'); } catch {}
    const active = document.querySelector('[data-workspace-active="true"]');
    const dashboardVisible = Boolean(document.querySelector('main[aria-label="PlotPickle Studio Dashboard"]'));
    const activeStoryLabel = document.querySelector('.story-rail button[aria-current="page"] strong');
    const visibleLocationCount = document.querySelectorAll('.location-card').length;
    return {
      url: location.href,
      activeId: active?.getAttribute('data-workspace-id') || (dashboardVisible ? 'dashboard' : ''),
      activeStorySection: (activeStoryLabel?.textContent || '').trim(),
      title: project?.metadata?.title || '',
      updatedAt: project?.metadata?.updatedAt || '',
      characterCount: project?.characters?.length || 0,
      locationCount: project?.world?.locations?.length || 0,
      visibleLocationCount,
      blockTitle: project?.blocks?.[0]?.title || '',
      blockSummary: project?.blocks?.[0]?.summary || '',
      screenplayCount: project?.screenplay?.draftElements?.length || 0,
      graphicNovelPanels: project?.review?.pitchPackage?.comicDeck?.panels?.length || 0,
      reviewThreads: project?.review?.threads?.length || 0,
      dashboardVisible,
      bodyText: (document.body.innerText || '').slice(0, 10000)
    };
  }`);

  async function waitForCurrentState(predicate, attempts = 8) {
    let state = {};
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      state = await currentState();
      if (predicate(state)) return state;
      await delay(350);
    }
    return state;
  }

  const consoleMessages = async () => {
    if (!has("browser_console_messages")) return "";
    try {
      return resultText(await client.call("browser_console_messages", toolArguments(toolMap.get("browser_console_messages"), { level: "error", all: false })));
    } catch {
      return "";
    }
  };

  const screenshot = async (name) => client.call(
    "browser_take_screenshot",
    toolArguments(toolMap.get("browser_take_screenshot"), { type: "png", filename: `creative-writer/${name}.png`, fullPage: true }),
  );

  async function visibleControlState(label) {
    const encoded = JSON.stringify(String(label));
    return evaluate(`() => {
      const wanted = ${encoded}.trim().toLowerCase();
      const controls = [...document.querySelectorAll('button, a, [role="button"], [role="tab"]')];
      const control = controls.find((node) => {
        const name = (node.getAttribute('aria-label') || node.textContent || '').trim().toLowerCase();
        const style = getComputedStyle(node);
        return name === wanted && style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
      });
      if (!control) return { found: false, disabled: false };
      const disabled = control instanceof HTMLButtonElement ? control.disabled : control.getAttribute('aria-disabled') === 'true';
      return { found: true, disabled };
    }`);
  }

  async function clickExactDomControl(label) {
    const encoded = JSON.stringify(String(label));
    return evaluate(`() => {
      const wanted = ${encoded}.trim().toLowerCase();
      const controls = [...document.querySelectorAll('button, a, [role="button"], [role="tab"]')];
      const control = controls.find((node) => {
        const name = (node.getAttribute('aria-label') || node.textContent || '').trim().toLowerCase();
        if (name !== wanted) return false;
        const style = getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
      });
      if (!control) return { clicked: false, disabled: false };
      const disabled = control instanceof HTMLButtonElement ? control.disabled : control.getAttribute('aria-disabled') === 'true';
      if (disabled) return { clicked: false, disabled: true };
      control.click();
      return { clicked: true, disabled: false, tag: control.tagName.toLowerCase() };
    }`);
  }

  async function clickExactStorySection(label) {
    const encoded = JSON.stringify(String(label));
    return evaluate(`() => {
      const wanted = ${encoded}.trim().toLowerCase();
      const buttons = [...document.querySelectorAll('.story-rail button')];
      const control = buttons.find((node) => {
        const strong = node.querySelector('strong');
        const text = (strong?.textContent || '').trim().toLowerCase();
        if (text !== wanted) return false;
        const style = getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
      });
      if (!control) return { clicked: false };
      control.click();
      return { clicked: true };
    }`);
  }

  async function clickVisible(label, roles = ["button", "link", "tab"]) {
    const availability = await visibleControlState(label);
    if (availability.found && availability.disabled) {
      runnerFindings.push(`Skipped disabled visible control: ${label}.`);
      return false;
    }

    const snap = await snapshot();
    const ref = extractRef(snap, label, roles);
    if (ref) {
      const tool = toolMap.get("browser_click");
      const props = tool?.inputSchema?.properties || {};
      const values = { element: `${label} visible control` };
      if ("ref" in props) values.ref = ref;
      else if ("target" in props) values.target = ref;
      else return false;
      try {
        await client.call("browser_click", toolArguments(tool, values));
        await delay(350);

        if (label === "Create the first location" || label === "Add location") {
          const state = await currentState();
          if ((state.locationCount || 0) < 1 && (state.visibleLocationCount || 0) < 1) {
            const retry = await clickExactDomControl(label);
            if (retry.clicked) {
              runnerFindings.push(`Retried visible ${label} control through the DOM because Playwright reported success without creating a location.`);
              await delay(650);
            }
          }
        }
        return true;
      } catch (error) {
        runnerFindings.push(`browser_click failed for ${label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const fallback = await clickExactDomControl(label);
    if (fallback.disabled) {
      runnerFindings.push(`Skipped disabled visible control: ${label}.`);
      return false;
    }
    if (fallback.clicked) {
      runnerFindings.push(`Used exact visible DOM click fallback for ${label} because Playwright did not expose a usable control ref.`);
      await delay(350);
      return true;
    }
    return false;
  }

  async function fillByLabel(label, value) {
    const snap = await snapshot();
    const ref = extractRef(snap, label, ["textbox", "searchbox", "combobox", "spinbutton"]);
    if (ref && has("browser_type")) {
      const tool = toolMap.get("browser_type");
      const props = tool?.inputSchema?.properties || {};
      const values = { element: `${label} field`, text: String(value), slowly: false, submit: false };
      if ("ref" in props) values.ref = ref;
      else if ("target" in props) values.target = ref;
      try {
        await client.call("browser_type", toolArguments(tool, values));
        await delay(380);
        return { ok: true, method: "visible Playwright typing" };
      } catch (error) {
        runnerFindings.push(`browser_type failed for ${label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const encodedLabel = JSON.stringify(String(label));
    const encodedValue = JSON.stringify(String(value));
    const result = await evaluate(`() => {
      const wanted = ${encodedLabel};
      const value = ${encodedValue};
      const generatedId = 'field-' + wanted.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      let control = document.getElementById(generatedId);
      if (!control) control = [...document.querySelectorAll('input, textarea, select')].find((node) => (node.getAttribute('aria-label') || '').trim() === wanted);
      if (!control) {
        const labels = [...document.querySelectorAll('label')];
        const labelNode = labels.find((node) => (node.textContent || '').trim() === wanted);
        if (labelNode?.htmlFor) control = document.getElementById(labelNode.htmlFor);
        if (!control && labelNode) control = labelNode.querySelector('input, textarea, select');
      }
      if (!control || !control.matches('input, textarea, select')) return { ok: false };
      const proto = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(control, value); else control.value = value;
      control.focus();
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, id: control.id || '' };
    }`);
    await delay(420);
    if (result.ok) {
      runnerFindings.push(`Used exact labelled DOM input fallback for ${label}${result.id ? ` (${result.id})` : ""} because Playwright did not expose a compatible field ref.`);
      return { ok: true, method: "exact labelled DOM input fallback" };
    }
    return { ok: false, method: "unavailable" };
  }

  async function fillDraft(value) {
    const encodedValue = JSON.stringify(value);
    const result = await evaluate(`() => {
      const controls = [...document.querySelectorAll('textarea[id^="draft-"]')];
      const control = controls.at(-1);
      if (!control) return { ok: false };
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(control, ${encodedValue}); else control.value = ${encodedValue};
      control.focus();
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    }`);
    await delay(450);
    if (result.ok) runnerFindings.push("Used DOM input fallback for the dynamic screenplay textarea; all surrounding actions still use visible controls.");
    return Boolean(result.ok);
  }

  async function record(stage, label, status = "PASS", note = "") {
    const state = await currentState();
    const consoleText = await consoleMessages();
    let finalStatus = status;
    let finalNote = note;
    if (consoleHasErrors(consoleText) && finalStatus === "PASS") {
      finalStatus = "WARN";
      finalNote = `${finalNote ? `${finalNote} ` : ""}Browser console reported errors.`;
    }
    try { await screenshot(`${String(stage).padStart(2, "0")}-${slug(label)}`); }
    catch (error) {
      if (finalStatus === "PASS") finalStatus = "WARN";
      finalNote = `${finalNote ? `${finalNote} ` : ""}Screenshot failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    evidence.push({ stage, label, status: finalStatus, note: finalNote, state, consoleText });
    return state;
  }

  async function gotoWorkspace(label, expectedId, query, pathName = "") {
    const matchesExpected = (state) => pathName ? String(state.url || "").includes(pathName) : state.activeId === expectedId;
    let clicked = false;
    try { clicked = await clickVisible(label); } catch {}
    let state = clicked ? await waitForCurrentState(matchesExpected) : {};
    if (clicked && matchesExpected(state)) return { ok: true, method: "visible workspace control", state };
    const url = pathName ? new URL(pathName, baseUrl).toString() : new URL(`/?workspace=${query}`, baseUrl).toString();
    await navigate(url);
    state = await waitForCurrentState(matchesExpected);
    const recovered = matchesExpected(state);
    return { ok: recovered, method: "direct recovery navigation", state };
  }

  async function gotoStorySection(label) {
    const wanted = String(label).trim().toLowerCase();
    let clicked = await clickVisible(label);
    await delay(450);
    let state = await currentState();
    if (clicked && String(state.activeStorySection || "").trim().toLowerCase() === wanted) return true;

    const recovered = await clickExactStorySection(label);
    if (recovered.clicked) {
      runnerFindings.push(`Used exact Story Rail control for ${label} because the first visible-control click did not activate that section.`);
      clicked = true;
      await delay(500);
      state = await currentState();
    }
    return clicked && String(state.activeStorySection || "").trim().toLowerCase() === wanted;
  }

  return { clickVisible, currentState, fillByLabel, fillDraft, gotoStorySection, gotoWorkspace, navigate, record, screenshot, snapshot };
}
