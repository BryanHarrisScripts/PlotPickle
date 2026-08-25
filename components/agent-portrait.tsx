import type { CSSProperties } from "react";
import { agentProfileById } from "../lib/agents/agent-profiles";
import styles from "./agent-portrait.module.css";

type AgentPortraitSpec = {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly column: 0 | 1 | 2 | 3 | 4;
  readonly row: 0 | 1 | 2 | 3;
  readonly source?: "canonical-asset";
};

const PORTRAITS: readonly AgentPortraitSpec[] = [
  { id: "knot-pickle", displayName: "Knot Pickle", description: "the story-path guide holding an untangled parchment knot", column: 0, row: 0, source: "canonical-asset" },
  { id: "thread-pickle", displayName: "Thread Pickle", description: "the continuity guide tracing a luminous woven timeline", column: 0, row: 0, source: "canonical-asset" },
  { id: "heart-pickle", displayName: "Heart Pickle", description: "the character guide holding an emotional heart-flame", column: 0, row: 0, source: "canonical-asset" },
  { id: "sage-brinewick", displayName: "Sage Brinewick", description: "the supplied elder wizard and curriculum-guide portrait", column: 0, row: 0 },
  { id: "tamsin-hearthquill", displayName: "Tamsin Hearthquill", description: "the supplied botanical foundations-keeper portrait", column: 1, row: 0 },
  { id: "master-oaken-vague", displayName: "Master Oaken-Vague", description: "the supplied dark fire-mage Wyrmwood keeper portrait", column: 2, row: 0 },
  { id: "rowan-scalequill", displayName: "Rowan Scalequill", description: "the supplied armored lesson-arbiter portrait", column: 3, row: 0 },
  { id: "quillan-reedcloak", displayName: "Quillan Reedcloak", description: "the supplied hooded scholar and story-scribe portrait", column: 4, row: 0 },
  { id: "elowen-mapweaver", displayName: "Elowen Mapweaver", description: "the supplied green-cloaked ranger and beat-cartographer portrait", column: 0, row: 1 },
  { id: "mira-threadmere", displayName: "Mira Threadmere", description: "the supplied masked continuity-keeper portrait", column: 1, row: 1 },
  { id: "critics-circle", displayName: "Critics' Circle", description: "the supplied ceremonial forest-elf council portrait", column: 2, row: 1 },
  { id: "marquee-director", displayName: "The Marquee Director", description: "the supplied elegant adult female elf with red-golden copper hair", column: 3, row: 1 },
  { id: "luma-glassfern", displayName: "Luma Glassfern", description: "the supplied luminous fairy visual-warden portrait", column: 4, row: 1 },
  { id: "orin-ledgerbark", displayName: "Orin Ledgerbark", description: "the supplied spectacled archivist with inspection lens portrait", column: 0, row: 2 },
  { id: "merrin-bellwarden", displayName: "Merrin Bellwarden", description: "the supplied bardic community-moderator portrait", column: 1, row: 2 },
  { id: "avery-north", displayName: "Avery North", description: "the supplied young wayfarer studying a map portrait", column: 2, row: 2 },
  { id: "bram-gatewick", displayName: "Bram Gatewick", description: "the supplied orc gatewarden portrait", column: 3, row: 2 },
  { id: "rook-ironquill", displayName: "Rook Ironquill", description: "the supplied dwarf forgekeeper and blacksmith portrait", column: 4, row: 2 },
  { id: "ben", displayName: "BEN", description: "the supplied dwarf code-steward and miner portrait", column: 0, row: 3 },
  { id: "fen-copperwind", displayName: "Fen Copperwind", description: "the supplied winged herald carrying a scroll portrait", column: 1, row: 3 },
] as const;

function agentPortraitSpec(id: string) {
  return PORTRAITS.find((portrait) => portrait.id === id) ?? null;
}

type PortraitStyle = CSSProperties & { "--agent-portrait-size": string };

function atlasPosition(column: AgentPortraitSpec["column"], row: AgentPortraitSpec["row"]): CSSProperties {
  const x = column * 25;
  const y = row * (100 / 3);
  return { backgroundPosition: `${x}% ${y}%` };
}

export default function AgentPortrait({
  id,
  alt,
  size = 64,
  locked = false,
  className = "",
}: {
  readonly id: string;
  readonly alt?: string;
  readonly size?: number;
  readonly locked?: boolean;
  readonly className?: string;
}) {
  const portrait = agentPortraitSpec(id);
  if (!portrait) return null;

  const label = alt || `Painterly fantasy portrait of ${portrait.displayName}`;
  const style: PortraitStyle = { "--agent-portrait-size": `${size}px` };
  const canonicalAvatarRef = agentProfileById(id)?.publicPresentation?.avatarRef || "";

  return (
    <span
      className={`${styles.frame} ${className}`.trim()}
      data-agent-id={portrait.id}
      data-agent-portrait="painterly-fantasy"
      data-public-avatar-ref={canonicalAvatarRef || undefined}
      data-locked={locked ? "true" : "false"}
      style={style}
    >
      {portrait.source === "canonical-asset" ? (
        <span
          aria-label={label}
          className={styles.canonicalPortrait}
          data-agent-artwork="current-lore"
          role="img"
          style={{ backgroundImage: `url("${canonicalAvatarRef}")` }}
        />
      ) : (
        <span
          aria-label={label}
          className={styles.atlasPortrait}
          data-agent-artwork="current-lore"
          role="img"
          style={atlasPosition(portrait.column, portrait.row)}
        />
      )}
    </span>
  );
}
