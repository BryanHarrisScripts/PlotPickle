import aiSystemsData from "@/data/production-ai-systems.json";
import type {
  PlotPickleProject,
  ProductionBreakdown,
  ProductionShootGroupDecision,
  ProductionShootGroupDecisionStatus,
} from "@/lib/project";

export const PRODUCTION_REPORT_GUIDANCE =
  "Planning guidance only. Confirm assumptions with the producer, department heads, cast, locations and safety leads before committing a schedule.";

export const PRODUCTION_REPORT_SECTIONS = [
  { id: "overview", label: "Overview", description: "Readiness, schedule and production load." },
  { id: "locations", label: "Locations", description: "Story places, real locations and logistical needs." },
  { id: "shot-types", label: "Shot Types", description: "Camera, movement and effects coverage." },
  { id: "shoot-groups", label: "Shoot Groups", description: "Explainable scene and shot combinations." },
  { id: "actor-schedule", label: "Actor Schedule", description: "Cast days, calls, sides and conflicts." },
  { id: "shooting-timeline", label: "Shooting Timeline", description: "Optimistic, realistic and contingency plans." },
  { id: "requirements", label: "Production Requirements", description: "One cross-department requirements ledger." },
  { id: "ai-systems", label: "AI Systems", description: "Dated, sourced and replaceable system reviews." },
] as const;

export type ProductionReportSection = (typeof PRODUCTION_REPORT_SECTIONS)[number]["id"];

export type AiSystemCategory = "video" | "image" | "aggregator";

export type AiSystemOption = {
  id: string;
  displayOrder: number;
  name: string;
  provider: string;
  modelOrService: string;
  summary: string;
  costModel: string;
  apiStatus: "available" | "limited" | "deprecated" | "unknown";
  pluginStatus: "integrated" | "not-integrated" | "unknown";
  deployment: "cloud" | "local" | "hybrid";
  licensingPrivacy: string;
  recommendedUse: string;
  sources: string[];
};

export type AiSystemsCatalog = {
  reviewedAt: string;
  nextReviewDue: string;
  editorialNote: string;
  categories: Record<AiSystemCategory, AiSystemOption[]>;
};

type SceneRecord = {
  id: string;
  number: number;
  title: string;
  heading: string;
  blockId: string;
  blockNumber: number;
  pageEstimate: number;
  estimatedSeconds: number;
  characterIds: string[];
  locationIds: string[];
  interiorExterior: string;
  dayNight: string;
  breakdown?: ProductionBreakdown;
  shotIds: string[];
  frameIds: string[];
};

const SHOT_TYPE_DEFINITIONS = [
  { id: "establishing", label: "Establishing", pattern: /\bestablish(?:ing|er)?\b|\bmaster\b/i },
  { id: "wide", label: "Wide", pattern: /\bwide\b|\bws\b/i },
  { id: "full", label: "Full", pattern: /\bfull(?: shot)?\b|\bfs\b/i },
  { id: "medium", label: "Medium", pattern: /\bmedium\b|\bms\b/i },
  { id: "close-up", label: "Close-up", pattern: /\bclose[ -]?up\b|\bcu\b/i },
  { id: "extreme-close-up", label: "Extreme close-up", pattern: /\bextreme close[ -]?up\b|\becu\b/i },
  { id: "over-the-shoulder", label: "Over the shoulder", pattern: /\bover[ -]?the[ -]?shoulder\b|\bots\b/i },
  { id: "two-shot", label: "Two-shot", pattern: /\btwo[ -]?shot\b|\b2[ -]?shot\b/i },
  { id: "group", label: "Group", pattern: /\bgroup\b|\bensemble\b/i },
  { id: "pov", label: "POV", pattern: /\bpov\b|\bpoint of view\b/i },
  { id: "insert", label: "Insert", pattern: /\binsert\b/i },
  { id: "cutaway", label: "Cutaway", pattern: /\bcutaway\b/i },
  { id: "tracking", label: "Tracking", pattern: /\btrack(?:ing)?\b|\bdolly\b|\bgimbal\b/i },
  { id: "handheld", label: "Handheld", pattern: /\bhand[ -]?held\b/i },
  { id: "crane-jib", label: "Crane / jib", pattern: /\bcrane\b|\bjib\b/i },
  { id: "drone", label: "Drone", pattern: /\bdrone\b|\baerial\b/i },
  { id: "static", label: "Static", pattern: /\bstatic\b|\blocked\b|\block[ -]?off\b/i },
  { id: "vehicle", label: "Vehicle", pattern: /\bvehicle\b|\bcar mount\b|\bprocess trailer\b/i },
  { id: "virtual-production", label: "Green-screen / virtual production", pattern: /\bgreen[ -]?screen\b|\bvirtual production\b|\bled wall\b|\bvolume\b/i },
  { id: "vfx-plate", label: "VFX plate", pattern: /\bvfx\b|\bplate\b|\bclean plate\b|\btracking marker\b/i },
] as const;

const REQUIREMENT_DEFINITIONS = [
  ["cast", "Cast"],
  ["extras", "Extras"],
  ["locations", "Locations"],
  ["props", "Props"],
  ["wardrobe", "Wardrobe"],
  ["makeup", "Makeup"],
  ["vehicles", "Vehicles"],
  ["animals", "Animals"],
  ["stunts", "Stunts"],
  ["practical-effects", "Practical effects"],
  ["vfx", "VFX"],
  ["equipment", "Equipment"],
  ["sound", "Sound"],
  ["playback", "Playback"],
  ["permits", "Permits"],
  ["safety", "Safety"],
  ["accessibility", "Accessibility"],
] as const;

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function splitDetails(value: string) {
  return unique(value.split(/[\n,;|]+/));
}

function slug(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tbd";
}

function parseHeading(value: string) {
  const upper = value.toLocaleUpperCase();
  const interiorExterior = upper.startsWith("INT./EXT") || upper.startsWith("INT/EXT")
    ? "INT./EXT."
    : upper.startsWith("INT")
      ? "INT."
      : upper.startsWith("EXT")
        ? "EXT."
        : "Not specified";
  const dayNight = /\bNIGHT\b/.test(upper)
    ? "Night"
    : /\bDAY\b/.test(upper)
      ? "Day"
      : /\bDAWN\b/.test(upper)
        ? "Dawn"
        : /\bDUSK\b/.test(upper)
          ? "Dusk"
          : "Not specified";
  return { interiorExterior, dayNight };
}

function sceneRecords(project: PlotPickleProject): SceneRecord[] {
  return project.blocks.flatMap((block) => block.scenes.map((scene) => {
    const heading = project.screenplay.draftElements.find((element) => (
      element.type === "scene-heading"
      && (element.sceneId === scene.id || (!element.sceneId && element.sceneNumber === scene.number))
    ))?.text || scene.title || `Scene ${scene.number}`;
    const breakdown = project.production.breakdowns.find((item) => item.sceneId === scene.id);
    const locationIds = unique([...scene.locationIds, ...(breakdown?.locationIds ?? [])]);
    const miniNumbers = new Set(scene.miniBlocks.map((mini) => mini.number));
    const parts = parseHeading(heading);
    return {
      id: scene.id,
      number: scene.number,
      title: scene.title || heading,
      heading,
      blockId: block.id,
      blockNumber: block.number,
      pageEstimate: scene.pageEstimate,
      estimatedSeconds: scene.estimatedSeconds,
      characterIds: unique([...scene.characterIds, ...(breakdown?.castIds ?? [])]),
      locationIds,
      ...parts,
      breakdown,
      shotIds: project.production.shots.filter((shot) => shot.sceneId === scene.id).map((shot) => shot.id),
      frameIds: block.visuals.filter((frame) => miniNumbers.has(frame.miniBlockNumber) && Boolean(frame.src || frame.shot || frame.prompt)).map((frame) => frame.id),
    };
  })).sort((left, right) => left.number - right.number);
}

function createLocationsReport(project: PlotPickleProject, scenes: SceneRecord[]) {
  const reporting = project.production.reporting;
  const canonicalLocations = new Map(project.world.locations.map((location) => [location.id, location]));
  const locationIds = unique([
    ...project.world.locations.map((location) => location.id),
    ...scenes.flatMap((scene) => scene.locationIds),
    ...project.production.schedule.map((day) => day.locationId),
  ]).filter((id) => id !== "location-tbd");
  const characterNames = new Map(project.characters.map((character) => [character.id, character.name || "Unnamed character"]));

  return locationIds.map((locationId) => {
    const location = canonicalLocations.get(locationId);
    const plan = reporting?.locations.find((item) => item.locationId === locationId);
    const linkedScenes = scenes.filter((scene) => scene.locationIds.includes(locationId));
    const breakdowns = linkedScenes.flatMap((scene) => scene.breakdown ? [scene.breakdown] : []);
    const scheduled = project.production.schedule.filter((day) => day.locationId === locationId);
    const estimatedShootHours = plan?.estimatedShootHours
      || breakdowns.reduce((total, item) => total + item.estimatedHours, 0)
      || Math.round(linkedScenes.reduce((total, scene) => total + Math.max(scene.pageEstimate * 1.25, scene.estimatedSeconds / 2400), 0) * 10) / 10;
    return {
      id: locationId,
      storyLocation: location?.name || locationId,
      description: location?.description || "",
      realLocation: plan?.realLocation || "Not recorded",
      scenes: linkedScenes.map((scene) => ({ id: scene.id, number: scene.number, title: scene.title, blockId: scene.blockId })),
      interiorExterior: unique(linkedScenes.map((scene) => scene.interiorExterior)),
      dayNight: unique(linkedScenes.map((scene) => scene.dayNight)),
      characters: unique(linkedScenes.flatMap((scene) => scene.characterIds.map((id) => characterNames.get(id) || id))),
      props: unique(breakdowns.flatMap((item) => splitDetails(item.props))),
      wardrobe: unique(breakdowns.flatMap((item) => splitDetails(item.wardrobe))),
      sound: unique(breakdowns.flatMap((item) => splitDetails(item.sound))),
      lighting: plan?.lighting || "Not recorded",
      weather: plan?.weather || "Not recorded",
      permits: plan?.permits || "Not recorded",
      travel: plan?.travel || "Not recorded",
      accessibility: plan?.accessibility || "Not recorded",
      availability: plan?.availability || (scheduled.length ? scheduled.map((day) => day.date || `Day ${day.dayNumber}`).join(", ") : "Not recorded"),
      setupMinutes: plan?.setupMinutes ?? 0,
      estimatedShootHours,
      estimateBasis: plan?.estimatedShootHours
        ? "Saved location plan"
        : breakdowns.length
          ? "Canonical scene breakdown estimates"
          : "Page/runtime planning estimate",
      notes: plan?.notes || "",
      scheduledDays: scheduled.map((day) => day.dayNumber),
    };
  });
}

function createShotTypesReport(project: PlotPickleProject, scenes: SceneRecord[]) {
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const shotSources = project.production.shots.map((shot) => ({
    id: shot.id,
    sceneId: shot.sceneId,
    kind: "shot" as const,
    text: [shot.shotSize, shot.angle, shot.movement, shot.composition, shot.purpose, shot.notes].join(" "),
  }));
  const frameSources = project.blocks.flatMap((block) => block.visuals.map((frame) => ({
    id: frame.id,
    sceneId: block.scenes.find((scene) => scene.miniBlocks.some((mini) => mini.number === frame.miniBlockNumber))?.id || "",
    kind: "storyboard" as const,
    text: [frame.shot, frame.caption, frame.prompt, frame.continuity].join(" "),
  })));
  const sources = [...shotSources, ...frameSources];
  return SHOT_TYPE_DEFINITIONS.map((definition) => {
    const matches = sources.filter((source) => definition.pattern.test(source.text));
    const sceneIds = unique(matches.map((match) => match.sceneId));
    return {
      id: definition.id,
      label: definition.label,
      count: matches.length,
      plannedShots: matches.filter((match) => match.kind === "shot").length,
      storyboardFrames: matches.filter((match) => match.kind === "storyboard").length,
      scenes: sceneIds.map((id) => sceneById.get(id)).filter((scene): scene is SceneRecord => Boolean(scene)).map((scene) => ({
        id: scene.id,
        number: scene.number,
        title: scene.title,
        blockId: scene.blockId,
      })),
      guidance: matches.length
        ? "Confirm lens, support, crew and safety requirements for every matched setup."
        : "No canonical shot or storyboard text currently identifies this requirement.",
    };
  });
}

function commonValues(values: string[][]) {
  if (!values.length) return [];
  return unique(values[0]).filter((value) => values.every((list) => list.includes(value)));
}

function isRecorded(value: string | undefined) {
  return Boolean(value?.trim() && value.trim().toLocaleLowerCase() !== "not recorded");
}

function createShootGroupsReport(project: PlotPickleProject, scenes: SceneRecord[]) {
  const locationNames = new Map(project.world.locations.map((location) => [location.id, location.name]));
  const characterNames = new Map(project.characters.map((character) => [character.id, character.name || "Unnamed character"]));
  const decisions = new Map((project.production.reporting?.shootGroups ?? []).map((item) => [item.id, item]));
  const locationPlans = new Map((project.production.reporting?.locations ?? []).map((item) => [item.locationId, item]));
  const buckets = new Map<string, SceneRecord[]>();
  scenes.forEach((scene) => {
    const locationId = scene.locationIds[0];
    if (!locationId) return;
    const key = `${locationId}|${scene.dayNight}`;
    buckets.set(key, [...(buckets.get(key) ?? []), scene]);
  });

  return [...buckets.entries()].flatMap(([key, groupedScenes]) => {
    if (groupedScenes.length < 2) return [];
    const [locationId, dayNight] = key.split("|");
    const id = `shoot-group-${slug(locationId)}-${slug(dayNight)}`;
    const decision = decisions.get(id);
    const locationPlan = locationPlans.get(locationId);
    const sharedCastIds = commonValues(groupedScenes.map((scene) => scene.characterIds));
    const breakdowns = groupedScenes.map((scene) => scene.breakdown).filter((item): item is ProductionBreakdown => Boolean(item));
    const sharedWardrobe = commonValues(breakdowns.map((item) => splitDetails(item.wardrobe)));
    const sharedProps = commonValues(breakdowns.map((item) => splitDetails(item.props)));
    const sharedVehicles = commonValues(breakdowns.map((item) => splitDetails(item.vehicles)));
    const sharedStunts = commonValues(breakdowns.map((item) => splitDetails(item.stunts)));
    const sharedEffects = commonValues(breakdowns.map((item) => splitDetails(item.effects)));
    const shotsByScene = groupedScenes.map((scene) => project.production.shots.filter((shot) => shot.sceneId === scene.id));
    const sharedCameraSetup = unique([
      ...commonValues(shotsByScene.map((shots) => shots.map((shot) => shot.shotSize))).map((value) => `${value} framing`),
      ...commonValues(shotsByScene.map((shots) => shots.map((shot) => shot.angle))).map((value) => `${value} angle`),
      ...commonValues(shotsByScene.map((shots) => shots.map((shot) => shot.movement))).map((value) => `${value} movement`),
      ...commonValues(shotsByScene.map((shots) => shots.map((shot) => shot.lens))).map((value) => `${value} lens`),
    ]);
    const storyLocation = locationNames.get(locationId) || locationId;
    const setFootprint = isRecorded(locationPlan?.realLocation) ? `${storyLocation} at ${locationPlan?.realLocation}` : storyLocation;
    const reasons = [
      `Shared location: ${storyLocation}`,
      `Shared set: ${setFootprint}`,
      dayNight !== "Not specified" ? `Shared story time: ${dayNight}` : "",
      sharedCastIds.length ? `Shared cast: ${sharedCastIds.map((idValue) => characterNames.get(idValue) || idValue).join(", ")}` : "",
      sharedWardrobe.length ? `Shared wardrobe: ${sharedWardrobe.join(", ")}` : "",
      sharedProps.length ? `Shared props: ${sharedProps.join(", ")}` : "",
      isRecorded(locationPlan?.lighting) ? `Shared lighting plan: ${locationPlan?.lighting}` : "",
      sharedCameraSetup.length ? `Shared camera setup: ${sharedCameraSetup.join(", ")}` : "",
      sharedVehicles.length ? `Shared vehicles: ${sharedVehicles.join(", ")}` : "",
      sharedStunts.length ? `Shared stunt needs: ${sharedStunts.join(", ")}` : "",
      sharedEffects.length ? `Shared effects: ${sharedEffects.join(", ")}` : "",
      isRecorded(locationPlan?.weather) ? `Shared weather constraint: ${locationPlan?.weather}` : "",
    ].filter(Boolean);
    return [{
      id,
      label: `${locationNames.get(locationId) || locationId} · ${dayNight}`,
      locationId,
      dayNight,
      baseSceneIds: groupedScenes.map((scene) => scene.id),
      selectedSceneIds: decision ? decision.sceneIds : groupedScenes.map((scene) => scene.id),
      scenes: groupedScenes.map((scene) => ({
        id: scene.id,
        number: scene.number,
        title: scene.title,
        blockId: scene.blockId,
        shots: scene.shotIds.length,
      })),
      shotIds: groupedScenes.flatMap((scene) => scene.shotIds),
      reasons,
      status: decision?.status ?? "proposed",
      notes: decision?.notes ?? "",
      confidence: reasons.length >= 4 ? "high" : reasons.length >= 2 ? "medium" : "low",
    }];
  }).sort((left, right) => right.scenes.length - left.scenes.length || left.label.localeCompare(right.label));
}

function addHours(value: string, hours: number) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return "Not estimated";
  const minutes = (Number(match[1]) * 60 + Number(match[2]) + Math.round(hours * 60)) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function createActorScheduleReport(project: PlotPickleProject, scenes: SceneRecord[], shootGroups: ReturnType<typeof createShootGroupsReport>) {
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const locationNames = new Map(project.world.locations.map((location) => [location.id, location.name]));
  const plans = new Map((project.production.reporting?.actors ?? []).map((item) => [item.characterId, item]));
  const actors = project.characters.map((character) => {
    const actorScenes = scenes.filter((scene) => scene.characterIds.includes(character.id));
    const sceneIds = new Set(actorScenes.map((scene) => scene.id));
    const plan = plans.get(character.id);
    const days = project.production.schedule.filter((day) => day.sceneIds.some((id) => sceneIds.has(id))).map((day) => {
      const dayScenes = day.sceneIds.map((id) => sceneById.get(id)).filter((scene): scene is SceneRecord => scene !== undefined && scene.characterIds.includes(character.id));
      return {
        id: day.id,
        dayNumber: day.dayNumber,
        date: day.date,
        callTime: day.callTime || plan?.preferredCallTime || "Not recorded",
        wrapTime: addHours(day.callTime || plan?.preferredCallTime || "", day.estimatedHours),
        location: locationNames.get(day.locationId) || "Location not set",
        scenes: dayScenes.map((scene) => ({ id: scene.id, number: scene.number, title: scene.title, blockId: scene.blockId })),
        sides: dayScenes.map((scene) => `Scene ${scene.number} · ${scene.title}`),
      };
    });
    const breakdowns = actorScenes.flatMap((scene) => scene.breakdown ? [scene.breakdown] : []);
    const unavailable = new Set(plan?.unavailableDates ?? []);
    const conflicts = days.filter((day) => day.date && unavailable.has(day.date)).map((day) => ({
      dayNumber: day.dayNumber,
      date: day.date,
      reason: "Scheduled on a saved unavailable date.",
    }));
    return {
      id: character.id,
      character: character.name || "Unnamed character",
      actor: plan?.actorName || "Uncast",
      scenes: actorScenes.map((scene) => ({ id: scene.id, number: scene.number, title: scene.title, blockId: scene.blockId })),
      locations: unique(actorScenes.flatMap((scene) => scene.locationIds.map((id) => locationNames.get(id) || id))),
      wardrobe: unique([...(plan?.wardrobe ? splitDetails(plan.wardrobe) : []), ...breakdowns.flatMap((item) => splitDetails(item.wardrobe))]),
      makeup: unique([...(plan?.makeup ? splitDetails(plan.makeup) : []), ...breakdowns.flatMap((item) => splitDetails(item.makeup))]),
      rehearsalHours: plan?.rehearsalHours ?? 0,
      availability: plan?.availableDates.length ? plan.availableDates : [],
      days,
      daysRequired: new Set(days.map((day) => day.dayNumber)).size,
      groupedScenes: shootGroups.filter((group) => group.selectedSceneIds.some((id) => sceneIds.has(id))).map((group) => group.label),
      conflicts,
      unscheduledScenes: actorScenes.filter((scene) => !project.production.schedule.some((day) => day.sceneIds.includes(scene.id))).length,
      notes: plan?.notes || "",
    };
  });
  const byDay = project.production.schedule.map((day) => ({
    id: day.id,
    dayNumber: day.dayNumber,
    date: day.date,
    location: locationNames.get(day.locationId) || "Location not set",
    characters: actors.filter((actor) => actor.days.some((item) => item.id === day.id)).map((actor) => actor.character),
    scenes: day.sceneIds.map((id) => sceneById.get(id)).filter((scene): scene is SceneRecord => Boolean(scene)).map((scene) => `Scene ${scene.number} · ${scene.title}`),
    callTime: day.callTime,
    wrapTime: addHours(day.callTime, day.estimatedHours),
  }));
  return {
    actors,
    byDay,
    conflicts: actors.flatMap((actor) => actor.conflicts.map((conflict) => ({ ...conflict, actor: actor.actor, character: actor.character }))),
  };
}

function createTimelineReport(project: PlotPickleProject, scenes: SceneRecord[]) {
  const settings = project.production.reporting?.timeline;
  const pages = Math.round(scenes.reduce((total, scene) => total + scene.pageEstimate, 0) * 10) / 10;
  const shots = project.production.shots.length;
  const cast = new Set(scenes.flatMap((scene) => scene.characterIds)).size;
  const nights = scenes.filter((scene) => scene.dayNight === "Night").length;
  const activeLocationIds = unique(scenes.flatMap((scene) => scene.locationIds));
  const uniqueLocations = activeLocationIds.length;
  const moves = project.production.schedule.reduce((total, day, index, days) => (
    index && day.locationId && days[index - 1].locationId && day.locationId !== days[index - 1].locationId ? total + 1 : total
  ), 0) || Math.max(0, uniqueLocations - 1);
  const activeLocationPlans = (project.production.reporting?.locations ?? []).filter((plan) => activeLocationIds.includes(plan.locationId));
  const setupHours = Math.round(activeLocationPlans.reduce((total, plan) => total + plan.setupMinutes / 60, 0) * 10) / 10;
  const lightingPlans = activeLocationPlans.filter((plan) => isRecorded(plan.lighting)).length;
  const weatherLocations = activeLocationPlans.filter((plan) => isRecorded(plan.weather)).length;
  const activeCharacterIds = new Set(scenes.flatMap((scene) => scene.characterIds));
  const rehearsalHours = Math.round((project.production.reporting?.actors ?? [])
    .filter((plan) => activeCharacterIds.has(plan.characterId))
    .reduce((total, plan) => total + plan.rehearsalHours, 0) * 10) / 10;
  const childCharacterIds = new Set(project.characters.filter((character) => (
    /\b(child|children|kid|minor|teen(?:ager)?|baby|infant|toddler|school[ -]?age)\b/i
      .test([character.name, character.role, character.description].join(" "))
  )).map((character) => character.id));
  const childScenes = scenes.filter((scene) => scene.characterIds.some((id) => childCharacterIds.has(id))).length;
  const animalPattern = /\b(animal|dog|cat|horse|bird|livestock|pet|wildlife)\b/i;
  const animalScenes = scenes.filter((scene) => animalPattern.test([
    scene.breakdown?.notes,
    scene.breakdown?.extras,
    scene.breakdown?.props,
    scene.breakdown?.effects,
  ].join(" "))).length;
  const stuntScenes = scenes.filter((scene) => Boolean(scene.breakdown?.stunts.trim())).length;
  const effectsScenes = scenes.filter((scene) => Boolean(scene.breakdown?.effects.trim())).length;
  const vehicleScenes = scenes.filter((scene) => Boolean(scene.breakdown?.vehicles.trim())).length;
  const makeupScenes = scenes.filter((scene) => Boolean(scene.breakdown?.makeup.trim())).length;
  const equipmentSetups = unique(project.production.shots.flatMap((shot) => [shot.movement, shot.lens])).length;
  const breakdownHours = project.production.breakdowns.reduce((total, breakdown) => total + breakdown.estimatedHours, 0);
  const workloadHours = Math.round((breakdownHours + setupHours + rehearsalHours) * 10) / 10;
  const complexitySignals = scenes.reduce((total, scene) => {
    const breakdown = scene.breakdown;
    return total
      + Math.max(1, scene.characterIds.length / 4)
      + scene.shotIds.length / 8
      + (scene.dayNight === "Night" ? 0.75 : 0)
      + (breakdown?.stunts.trim() ? 1.5 : 0)
      + (breakdown?.effects.trim() ? 1.25 : 0)
      + (breakdown?.vehicles.trim() ? 0.75 : 0)
      + (breakdown?.makeup.trim() ? 0.5 : 0);
  }, 0)
    + childScenes * 0.75
    + animalScenes * 1.5
    + setupHours / 4
    + rehearsalHours / 8
    + equipmentSetups / 12
    + weatherLocations * 0.75
    + moves * 0.5;
  const pagesPerDay = settings?.pagesPerDay || 5;
  const hoursPerDay = settings?.hoursPerDay || 10;
  const optimisticDays = Math.max(1, Math.ceil(Math.max(pages / (pagesPerDay * 1.2), scenes.length / 8, complexitySignals / 12, workloadHours / (hoursPerDay * 1.1))));
  const realisticDays = Math.max(project.production.schedule.length, Math.ceil(Math.max(pages / pagesPerDay, scenes.length / 6, complexitySignals / 9, workloadHours / hoursPerDay)));
  const contingencyPercent = settings?.contingencyPercent ?? 20;
  const contingencyDays = Math.max(realisticDays, Math.ceil(realisticDays * (1 + contingencyPercent / 100)));
  const prepDays = settings?.prepDays ?? Math.max(1, Math.ceil(uniqueLocations / 3));
  const pickupDays = settings?.pickupDays ?? Math.max(1, Math.ceil(shots / 75));
  return {
    pages,
    scenes: scenes.length,
    shots,
    cast,
    locations: uniqueLocations,
    moves,
    nights,
    setupHours,
    lightingPlans,
    weatherLocations,
    rehearsalHours,
    childScenes,
    animalScenes,
    stuntScenes,
    effectsScenes,
    vehicleScenes,
    makeupScenes,
    equipmentSetups,
    workloadHours,
    hoursPerDay,
    prepDays,
    pickupDays,
    contingencyPercent,
    existingScheduleDays: project.production.schedule.length,
    scenarios: [
      { id: "optimistic", label: "Optimistic", shootDays: optimisticDays, totalDays: prepDays + optimisticDays, pagesPerDay: Math.round((pages / optimisticDays) * 10) / 10, scenesPerDay: Math.round((scenes.length / optimisticDays) * 10) / 10, assumption: "Minimal moves, approved coverage and no material delays." },
      { id: "realistic", label: "Realistic", shootDays: realisticDays, totalDays: prepDays + realisticDays + pickupDays, pagesPerDay: Math.round((pages / realisticDays) * 10) / 10, scenesPerDay: Math.round((scenes.length / realisticDays) * 10) / 10, assumption: "Canonical complexity, normal company moves, prep and pickups." },
      { id: "contingency", label: "Contingency", shootDays: contingencyDays, totalDays: prepDays + contingencyDays + pickupDays, pagesPerDay: Math.round((pages / contingencyDays) * 10) / 10, scenesPerDay: Math.round((scenes.length / contingencyDays) * 10) / 10, assumption: `${contingencyPercent}% coverage for weather, cast, safety, effects and technical delays.` },
    ],
  };
}

function createRequirementsReport(project: PlotPickleProject, scenes: SceneRecord[], locations: ReturnType<typeof createLocationsReport>) {
  const characterNames = new Map(project.characters.map((character) => [character.id, character.name || "Unnamed character"]));
  const values = new Map<string, string[]>();
  const sceneSets = new Map<string, Set<string>>();
  const add = (category: string, sceneId: string, details: string[]) => {
    if (!details.length) return;
    values.set(category, unique([...(values.get(category) ?? []), ...details]));
    sceneSets.set(category, new Set([...(sceneSets.get(category) ?? []), sceneId]));
  };
  scenes.forEach((scene) => {
    const breakdown = scene.breakdown;
    add("cast", scene.id, scene.characterIds.map((id) => characterNames.get(id) || id));
    add("locations", scene.id, scene.locationIds.map((id) => project.world.locations.find((item) => item.id === id)?.name || id));
    if (!breakdown) return;
    add("extras", scene.id, splitDetails(breakdown.extras));
    add("props", scene.id, splitDetails(breakdown.props));
    add("wardrobe", scene.id, splitDetails(breakdown.wardrobe));
    add("makeup", scene.id, splitDetails(breakdown.makeup));
    add("vehicles", scene.id, splitDetails(breakdown.vehicles));
    add("stunts", scene.id, splitDetails(breakdown.stunts));
    add("sound", scene.id, splitDetails(breakdown.sound));
    const effects = splitDetails(breakdown.effects);
    add("vfx", scene.id, effects.filter((item) => /vfx|cgi|digital|composit|green[ -]?screen|plate/i.test(item)));
    add("practical-effects", scene.id, effects.filter((item) => !/vfx|cgi|digital|composit|green[ -]?screen|plate/i.test(item)));
    const notes = [breakdown.notes, breakdown.props, breakdown.effects].join(" ");
    if (/\banimal|dog|cat|horse|bird|livestock\b/i.test(notes)) add("animals", scene.id, [breakdown.notes || breakdown.props]);
    if (/\bsafety|hazard|fire|weapon|water|height|traffic\b/i.test(notes)) add("safety", scene.id, [breakdown.notes]);
  });
  project.production.shots.forEach((shot) => {
    const equipment = [shot.movement, shot.lens].filter((item) => /drone|crane|jib|dolly|gimbal|handheld|vehicle|lens|steadicam/i.test(item));
    add("equipment", shot.sceneId, equipment);
  });
  project.production.cues.filter((cue) => cue.type === "source").forEach((cue) => add("playback", cue.sceneId, [cue.title || cue.cueNumber]));
  locations.forEach((location) => {
    const sceneId = location.scenes[0]?.id || location.id;
    if (location.permits !== "Not recorded") add("permits", sceneId, [location.permits]);
    if (location.accessibility !== "Not recorded") add("accessibility", sceneId, [location.accessibility]);
  });
  return REQUIREMENT_DEFINITIONS.map(([id, label]) => ({
    id,
    label,
    items: values.get(id) ?? [],
    scenes: sceneSets.get(id)?.size ?? 0,
    status: values.get(id)?.length ? "identified" : "review-needed",
    guidance: values.get(id)?.length
      ? "Verify ownership, dates, cost, department lead and safety dependencies."
      : "No canonical requirement is recorded; confirm this category during breakdown.",
  }));
}

export function createProductionReportsModel(
  project: PlotPickleProject,
  catalog: AiSystemsCatalog = aiSystemsData as AiSystemsCatalog,
) {
  const scenes = sceneRecords(project);
  const locations = createLocationsReport(project, scenes);
  const shotTypes = createShotTypesReport(project, scenes);
  const shootGroups = createShootGroupsReport(project, scenes);
  const actorSchedule = createActorScheduleReport(project, scenes, shootGroups);
  return {
    guidance: PRODUCTION_REPORT_GUIDANCE,
    overview: {
      scenes: scenes.length,
      pages: Math.round(scenes.reduce((total, scene) => total + scene.pageEstimate, 0) * 10) / 10,
      locations: locations.length,
      cast: new Set(scenes.flatMap((scene) => scene.characterIds)).size,
      shots: project.production.shots.length,
      storyboardFrames: scenes.reduce((total, scene) => total + scene.frameIds.length, 0),
      breakdowns: project.production.breakdowns.length,
      readyBreakdowns: project.production.breakdowns.filter((item) => item.readiness === "ready").length,
      blockedBreakdowns: project.production.breakdowns.filter((item) => item.readiness === "blocked").length,
      scheduleDays: project.production.schedule.length,
      unscheduledScenes: scenes.filter((scene) => !project.production.schedule.some((day) => day.sceneIds.includes(scene.id))).length,
    },
    locations,
    shotTypes,
    shootGroups,
    actorSchedule,
    timeline: createTimelineReport(project, scenes),
    requirements: createRequirementsReport(project, scenes, locations),
    aiSystems: {
      ...catalog,
      categories: {
        video: [...catalog.categories.video].sort((left, right) => left.displayOrder - right.displayOrder),
        image: [...catalog.categories.image].sort((left, right) => left.displayOrder - right.displayOrder),
        aggregator: [...catalog.categories.aggregator].sort((left, right) => left.displayOrder - right.displayOrder),
      },
    },
  };
}

export function updateProductionShootGroupDecision(
  project: PlotPickleProject,
  groupId: string,
  sceneIds: string[],
  status: ProductionShootGroupDecisionStatus,
  notes = "",
): PlotPickleProject {
  const now = new Date().toISOString();
  const existing = project.production.reporting?.shootGroups ?? [];
  const decision: ProductionShootGroupDecision = {
    id: groupId,
    sceneIds: unique(sceneIds),
    status,
    notes,
    updatedAt: now,
  };
  const shootGroups = existing.some((item) => item.id === groupId)
    ? existing.map((item) => item.id === groupId ? decision : item)
    : [...existing, decision];
  const reporting = project.production.reporting ?? {
    locations: [],
    actors: [],
    shootGroups: [],
    timeline: {
      hoursPerDay: 10,
      pagesPerDay: 5,
      prepDays: 1,
      pickupDays: 1,
      contingencyPercent: 20,
      updatedAt: now,
    },
  };
  return {
    ...project,
    metadata: { ...project.metadata, updatedAt: now },
    production: {
      ...project.production,
      reporting: { ...reporting, shootGroups },
    },
  };
}

export type ProductionReportsModel = ReturnType<typeof createProductionReportsModel>;
