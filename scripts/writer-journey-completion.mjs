function controlsFromSnapshot(snapshot) {
  const controls = [];
  const pattern = /(?:^|\n)\s*-\s*(button|link|tab|textbox|searchbox|combobox|checkbox|radio)\s+(?:"([^"]*)")?[^\n]*?\[ref=([^\]]+)\]/gi;
  let match;
  while ((match = pattern.exec(String(snapshot)))) {
    const label = String(match[2] || "").trim();
    if (label) controls.push({ role: match[1].toLowerCase(), label, ref: match[3] });
  }
  return controls;
}

function topicSnapshot(snapshot, topic, nextTopics) {
  const text = String(snapshot || "");
  const startPattern = new RegExp(`button "${topic}"`, "i");
  const startMatch = startPattern.exec(text);
  if (!startMatch) return "";
  let end = text.length;
  for (const next of nextTopics) {
    const match = new RegExp(`button "${next}"`, "i").exec(text.slice(startMatch.index + 1));
    if (match) end = Math.min(end, startMatch.index + 1 + match.index);
  }
  return text.slice(startMatch.index, end);
}

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

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function snapshot(client, resultText) {
  return resultText(await client.call("browser_snapshot", {}));
}

async function navigate(client, baseUrl, route) {
  await client.call("browser_navigate", { url: new URL(route, baseUrl).toString() });
  await wait(750);
}

async function click(client, toolMap, control) {
  if (!control) throw new Error("A required visible control was not found.");
  await client.call("browser_click", toolArgs(toolMap.get("browser_click"), {
    ref: control.ref,
    element: control.label,
  }));
  await wait(450);
}

async function type(client, toolMap, control, text) {
  await client.call("browser_type", toolArgs(toolMap.get("browser_type"), {
    ref: control.ref,
    element: control.label,
    text,
  }));
  await wait(180);
}

function findControl(snapshotText, pattern, roles = null) {
  return controlsFromSnapshot(snapshotText).find((control) => (
    (!roles || roles.includes(control.role)) && pattern.test(control.label)
  )) || null;
}

function averyPlanAnswer(storySeed, fieldLabel, lessonNumber, fieldNumber, frontier = "Foundations") {
  const premise = String(storySeed?.premise || "Avery's current story").replace(/\s+/g, " ").trim();
  return `${storySeed?.title || "Avery's story"} · ${frontier} decision ${lessonNumber}.${fieldNumber}. ${fieldLabel} Avery's current working choice grows directly from this premise: ${premise} The answer should keep the protagonist's choices, consequences, uncertainty and audience experience connected rather than inventing unrelated story facts.`;
}

async function completeLearnTopic({ client, toolMap, resultText, topic, nextTopics, expectedCount }) {
  let current = await snapshot(client, resultText);
  for (let guard = 0; guard < expectedCount + 5; guard += 1) {
    const section = topicSnapshot(current, topic, nextTopics);
    const controls = controlsFromSnapshot(section);
    const lessonMarks = controls.filter((control) => control.role === "button" && /^Mark .+ (?:complete|incomplete)$/i.test(control.label));
    if (lessonMarks.length < expectedCount) {
      throw new Error(`Avery expected ${expectedCount} visible ${topic} completion controls, found ${lessonMarks.length}.`);
    }
    const next = lessonMarks.find((control) => / complete$/i.test(control.label));
    if (!next) return { lessonCount: lessonMarks.length, completed: lessonMarks.length };
    await click(client, toolMap, next);
    current = await snapshot(client, resultText);
  }
  throw new Error(`Avery could not finish the visible ${topic} LEARN completion controls within the bounded pass.`);
}

async function completeFoundationsPlan({ client, toolMap, resultText, storySeed }) {
  let current = await snapshot(client, resultText);
  const start = findControl(current, /^(?:Start lesson 01|Continue Foundations)$/i, ["button"]);
  if (start) {
    await click(client, toolMap, start);
    current = await snapshot(client, resultText);
  }

  let lessonsCompleted = 0;
  let answersWritten = 0;
  for (let lessonNumber = 1; lessonNumber <= 11; lessonNumber += 1) {
    current = await snapshot(client, resultText);
    const answerBoxes = controlsFromSnapshot(current).filter((control) => (
      control.role === "textbox"
      && !/editable brief|ask|message|search/i.test(control.label)
    ));
    if (answerBoxes.length < 3) {
      throw new Error(`Avery expected at least three visible PLAN answer boxes in lesson ${lessonNumber}, found ${answerBoxes.length}.`);
    }
    for (const [index, field] of answerBoxes.slice(0, 3).entries()) {
      await type(client, toolMap, field, averyPlanAnswer(storySeed, field.label, lessonNumber, index + 1));
      answersWritten += 1;
    }
    lessonsCompleted += 1;
    current = await snapshot(client, resultText);
    const next = controlsFromSnapshot(current).find((control) => (
      control.role === "button" && /→$/.test(control.label) && /^\d{2}\s/.test(control.label)
    ));
    if (lessonNumber < 11) {
      if (!next) throw new Error(`Avery could not find the next Foundations PLAN lesson after lesson ${lessonNumber}.`);
      await click(client, toolMap, next);
    }
  }

  current = await snapshot(client, resultText);
  const buildBrief = findControl(current, /^Build from saved answers$/i, ["button"]);
  if (!buildBrief) throw new Error("Avery could not find Build from saved answers after completing Foundations PLAN.");
  await click(client, toolMap, buildBrief);
  current = await snapshot(client, resultText);
  const saveBrief = findControl(current, /^Save Foundations Brief$/i, ["button"]);
  if (saveBrief) await click(client, toolMap, saveBrief);
  return { lessonsCompleted, answersWritten };
}

async function completeWorldPlan({ client, toolMap, resultText, storySeed }) {
  let lessonsCompleted = 0;
  let answersWritten = 0;
  let expectedFieldCount = 0;

  for (let lessonIndex = 0; lessonIndex < 5; lessonIndex += 1) {
    let current = await snapshot(client, resultText);
    const lessonButtons = controlsFromSnapshot(current).filter((control) => (
      control.role === "button" && /^\d{2}\s*·\s*/.test(control.label)
    ));
    if (lessonButtons.length < 5) {
      throw new Error(`Avery expected five visible World PLAN lesson controls, found ${lessonButtons.length}.`);
    }
    await click(client, toolMap, lessonButtons[lessonIndex]);
    current = await snapshot(client, resultText);
    const answerBoxes = controlsFromSnapshot(current).filter((control) => (
      control.role === "textbox"
      && !/world brief|ask|message|search/i.test(control.label)
    ));
    if (!answerBoxes.length) {
      throw new Error(`Avery found no visible World PLAN answer boxes in World lesson ${lessonIndex + 1}.`);
    }
    expectedFieldCount += answerBoxes.length;
    for (const [fieldIndex, field] of answerBoxes.entries()) {
      await type(client, toolMap, field, averyPlanAnswer(storySeed, field.label, lessonIndex + 1, fieldIndex + 1, "World"));
      answersWritten += 1;
    }
    lessonsCompleted += 1;
  }

  let current = await snapshot(client, resultText);
  const buildBrief = findControl(current, /^Build World Brief$/i, ["button"]);
  if (!buildBrief) throw new Error("Avery could not find Build World Brief after completing World PLAN.");
  await click(client, toolMap, buildBrief);
  current = await snapshot(client, resultText);
  const saveBrief = findControl(current, /^Save World Brief$/i, ["button"]);
  if (saveBrief) await click(client, toolMap, saveBrief);
  return { lessonsCompleted, answersWritten, expectedFieldCount };
}

async function generateAndAcceptFoundationsWireframe({ client, toolMap, resultText }) {
  let current = await snapshot(client, resultText);
  const consent = findControl(current, /^I understand this wireframe/i, ["checkbox"]);
  if (consent) await click(client, toolMap, consent);
  current = await snapshot(client, resultText);
  const generate = findControl(current, /^(?:Generate|Regenerate) wireframe \(\d+\)$/i, ["button"]);
  if (!generate) throw new Error("Foundations BUILD is not offering a usable wireframe generation control. Check image-route readiness.");
  await click(client, toolMap, generate);

  let completed = false;
  for (let attempt = 0; attempt < 160; attempt += 1) {
    await wait(1_500);
    current = await snapshot(client, resultText);
    if (/Regenerate wireframe \(\d+\)/i.test(current) && /button "Accept"/i.test(current)) {
      completed = true;
      break;
    }
    if (/could not continue|returned no usable visual|not ready|manual image mode/i.test(current)) break;
  }
  if (!completed) throw new Error("Foundations wireframe generation did not reach a reviewable completed state.");
  const accept = findControl(current, /^Accept$/i, ["button"]);
  if (!accept) throw new Error("A generated Foundations frame was visible but no Accept control was available.");
  await click(client, toolMap, accept);
  return { generated: true, accepted: true };
}

async function generateAndAcceptWorldWireframe({ client, toolMap, resultText }) {
  let current = await snapshot(client, resultText);
  const consent = findControl(current, /^I understand this can make up to/i, ["checkbox"]);
  if (consent) await click(client, toolMap, consent);
  current = await snapshot(client, resultText);
  const generate = findControl(current, /^(?:Generate|Regenerate) World pass \(\d+\)$/i, ["button"]);
  if (!generate) throw new Error("World BUILD is not offering a usable World wireframe pass. Check image-route readiness and World PLAN completion.");
  await click(client, toolMap, generate);

  let completed = false;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    await wait(1_500);
    current = await snapshot(client, resultText);
    const finished = /(?:Generate|Regenerate) World pass \(\d+\)/i.test(current)
      && !/Generating World changes/i.test(current);
    if (finished && /button "Accept change"/i.test(current)) {
      completed = true;
      break;
    }
    if (/could not continue|returned no usable visual|not ready|manual image mode/i.test(current)) break;
  }
  if (!completed) throw new Error("World wireframe generation did not reach a reviewable completed state.");
  const accept = findControl(current, /^Accept change$/i, ["button"]);
  if (!accept) throw new Error("World BUILD produced a visible change but no Accept change control was available.");
  await click(client, toolMap, accept);
  return { generated: true, accepted: true };
}

async function generateMarqueePoster({ client, toolMap, resultText }) {
  let current = await snapshot(client, resultText);
  const marquee = findControl(current, /^Marquee(?:\s|$)/i, ["button"]);
  if (!marquee) throw new Error("Marquee is not visible in the Creative Room after Foundations completion.");
  if (/locked/i.test(marquee.label)) throw new Error("Marquee remains visibly locked after Foundations completion.");
  await click(client, toolMap, marquee);
  current = await snapshot(client, resultText);
  if (/PPF Marketing Reference/i.test(current)) return { generated: false, alreadyPresent: true };
  const consent = findControl(current, /^I understand this sends one paid image request/i, ["checkbox"]);
  if (consent) await click(client, toolMap, consent);
  current = await snapshot(client, resultText);
  const generate = findControl(current, /^Create first poster$/i, ["button"]);
  if (!generate) throw new Error("Marquee is unlocked but the first-poster control is unavailable. Check image-route readiness.");
  await click(client, toolMap, generate);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await wait(1_500);
    current = await snapshot(client, resultText);
    if (/PPF Marketing Reference/i.test(current)) return { generated: true, alreadyPresent: false };
    if (/could not be generated|not ready|manual image mode|returned no usable poster/i.test(current)) break;
  }
  throw new Error("Marquee did not produce a visible PPF Marketing Reference within the bounded generation pass.");
}

export async function runWriterAcceptanceCompletion({
  client,
  toolMap,
  resultText,
  baseUrl,
  storySeed,
  onStatus = () => {},
}) {
  const steps = [];
  const record = (id, detail) => {
    const entry = { id, detail, completedAt: new Date().toISOString() };
    steps.push(entry);
    onStatus(id, detail);
    return entry;
  };

  await navigate(client, baseUrl, "/?workspace=learn");
  const learn = await completeLearnTopic({
    client,
    toolMap,
    resultText,
    topic: "Foundations",
    nextTopics: ["World", "Character", "Theme", "Structure"],
    expectedCount: 11,
  });
  record("learn", `${learn.completed} of ${learn.lessonCount} Foundations lessons visibly complete.`);

  await navigate(client, baseUrl, "/?workspace=plan&section=foundations");
  const plan = await completeFoundationsPlan({ client, toolMap, resultText, storySeed });
  record("plan", `${plan.lessonsCompleted} Foundations PLAN lessons completed with ${plan.answersWritten} visible writer answers.`);

  await navigate(client, baseUrl, "/?workspace=build&section=foundations");
  const build = await generateAndAcceptFoundationsWireframe({ client, toolMap, resultText });
  record("build", "Foundations rough wireframe generated through the visible image route and at least one frame accepted.");

  await navigate(client, baseUrl, "/?workspace=learn");
  const marquee = await generateMarqueePoster({ client, toolMap, resultText });
  record("marquee", marquee.alreadyPresent
    ? "Existing PPF Marketing Reference reopened through Marquee."
    : "Marquee created the first poster through the visible UI and the Marketing Reference became visible.");

  await navigate(client, baseUrl, "/?workspace=learn");
  const worldLearn = await completeLearnTopic({
    client,
    toolMap,
    resultText,
    topic: "World",
    nextTopics: ["Character", "Theme", "Structure", "Visual Storytelling"],
    expectedCount: 5,
  });
  record("world-learn", `${worldLearn.completed} of ${worldLearn.lessonCount} World lessons visibly complete.`);

  await navigate(client, baseUrl, "/?workspace=plan&section=world");
  const worldPlan = await completeWorldPlan({ client, toolMap, resultText, storySeed });
  record("world-plan", `${worldPlan.lessonsCompleted} World PLAN lessons completed with ${worldPlan.answersWritten} visible writer answers.`);

  await navigate(client, baseUrl, "/?workspace=build&section=world");
  const worldBuild = await generateAndAcceptWorldWireframe({ client, toolMap, resultText });
  record("world-build", "World BUILD generated the Foundations + World pass and at least one World-driven change was accepted.");

  return {
    schemaVersion: 2,
    completed: true,
    frontier: "Foundations + World",
    authority: "synthetic-writer-visible-ui-only",
    directStorageMutation: false,
    steps,
    learn,
    plan,
    build,
    marquee,
    worldLearn,
    worldPlan,
    worldBuild,
  };
}
