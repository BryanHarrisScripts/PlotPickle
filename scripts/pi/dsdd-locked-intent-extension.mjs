import { readFile } from "node:fs/promises";

function text(value, max = 24000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export default function plotpickleDsddLockedIntent(pi) {
  pi.on("context_with_system", async (event) => {
    const packetPath = process.env.PLOTPICKLE_DSDD_BUILD_PACKET;
    if (!packetPath) return { messages: event.messages };
    const packet = JSON.parse(await readFile(packetPath, "utf8"));
    if (!packet?.locked || packet?.repairMayMutateIntent !== false) {
      throw new Error("DSDD coding requires one immutable locked build packet.");
    }
    if (!event.messages.length || event.messages[0]?.role !== "system") {
      throw new Error("Pi DSDD context projection must preserve the leading system message.");
    }
    const requirements = Array.isArray(packet.requirements)
      ? packet.requirements.map((item) => `${text(item?.id, 40)} ${text(item?.text, 4000)}`).filter(Boolean)
      : [];
    const locked = [
      "PLOTPICKLE DSDD LOCKED INTENT",
      `Intent version: ${packet.intentVersion}`,
      `Intent digest: ${text(packet.intentDigest, 128)}`,
      `Human-approved meaning: ${text(packet.understoodMeaning)}`,
      "Requirements:",
      ...requirements,
      "This meaning is immutable for this build/repair run.",
      "Do not alter, weaken, reinterpret, or delete an acceptance obligation to make verification green.",
      "If implementation cannot satisfy the locked requirement, leave it failing and report the evidence.",
    ].join("\n");
    return {
      messages: [
        event.messages[0],
        { role: "system", content: locked, timestamp: Date.now() },
        ...event.messages.slice(1),
      ],
    };
  });
}
