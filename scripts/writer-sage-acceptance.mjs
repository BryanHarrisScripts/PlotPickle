import { writerVisibleControls } from "./writer-visible-controls.mjs";

function toolArgs(tool, values) {
  const properties = tool?.inputSchema?.properties || {};
  const output = { element: values.element || "visible control" };
  if ("ref" in properties) output.ref = values.ref;
  else if ("target" in properties) output.target = values.ref;
  if (values.text !== undefined) {
    output.text = String(values.text || "");
    if ("slowly" in properties) output.slowly = false;
    if ("submit" in properties) output.submit = false;
  }
  return output;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function snapshot(client, resultText) {
  return resultText(await client.call("browser_snapshot", {}));
}

function findControl(snapshotText, pattern, roles) {
  return writerVisibleControls(snapshotText).find((control) => roles.includes(control.role) && pattern.test(control.label)) || null;
}

function visibleSageFailure(snapshotText) {
  const text = String(snapshotText || "");
  const match = text.match(/(?:Curriculum Guide could not answer|provider returned no text|selected text provider returned no text|no usable text|request failed|timed out)[^\n]*/i);
  return match ? match[0].trim() : "";
}

export async function runSageAcceptance({
  client,
  toolMap,
  resultText,
  baseUrl,
  questions,
  maxAttempts = 2,
  onStatus = () => {},
}) {
  const required = (Array.isArray(questions) ? questions : []).map((value) => String(value || "").trim()).filter(Boolean);
  await client.call("browser_navigate", { url: new URL("/?workspace=learn", baseUrl).toString() });
  await delay(750);

  const failures = [];
  let completed = 0;
  for (let index = 0; index < required.length; index += 1) {
    const question = required[index];
    let passed = false;
    let lastDetail = "";

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let current = await snapshot(client, resultText);
      const textbox = findControl(current, /ask in your own words|creative room|question/i, ["textbox"])
        || writerVisibleControls(current).find((control) => control.role === "textbox");
      if (!textbox) {
        lastDetail = "Visible Sage textbox was not found.";
        break;
      }

      await client.call("browser_type", toolArgs(toolMap.get("browser_type"), {
        ref: textbox.ref,
        element: textbox.label,
        text: question,
      }));
      await delay(250);
      current = await snapshot(client, resultText);
      const ask = findControl(current, /^Ask the Guide$/i, ["button"]);
      if (!ask) {
        lastDetail = "Ask the Guide button was not visible after typing.";
        break;
      }

      await client.call("browser_click", toolArgs(toolMap.get("browser_click"), {
        ref: ask.ref,
        element: ask.label,
      }));

      for (let poll = 0; poll < 55; poll += 1) {
        await delay(700);
        current = await snapshot(client, resultText);
        const failure = visibleSageFailure(current);
        if (failure) {
          lastDetail = failure;
          break;
        }
        if (current.includes(question) && !/Thinking about your question/i.test(current)) {
          passed = true;
          lastDetail = `Sage completed required conversation message ${index + 1} on attempt ${attempt}.`;
          break;
        }
      }

      if (passed) break;
      if (!lastDetail) lastDetail = `Sage did not visibly finish message ${index + 1} within the bounded reply window.`;
      onStatus(index + 1, "RETRY", `${lastDetail} Attempt ${attempt}/${maxAttempts}.`);
    }

    if (!passed) {
      failures.push({ index: index + 1, question, detail: lastDetail || "Sage acceptance failed." });
      onStatus(index + 1, "FAIL", failures.at(-1).detail);
      break;
    }
    completed += 1;
    onStatus(index + 1, "PASS", lastDetail);
  }

  return {
    schemaVersion: 1,
    authority: "synthetic-writer-visible-ui-only",
    requested: required.length,
    completed,
    passed: required.length > 0 && completed === required.length,
    failures,
  };
}
