import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { agentPortraitSpec, type AgentPortraitAccessory } from "../lib/agent-portrait-registry";
import styles from "./agent-portrait.module.css";

type PortraitStyle = CSSProperties & { "--agent-portrait-size": string };

function Accessory({ kind, accent }: { readonly kind: AgentPortraitAccessory; readonly accent: string }): ReactNode {
  if (kind === "circlet") return <><path d="M104 91Q160 58 216 91" fill="none" stroke={accent} strokeWidth="7" /><circle cx="160" cy="75" r="7" fill="#63ddcc" /></>;
  if (kind === "staff") return <><path d="M246 86v154" stroke="#9b743d" strokeWidth="8" strokeLinecap="round" /><path d="M231 92q15-31 30 0" fill="none" stroke={accent} strokeWidth="6" /></>;
  if (kind === "scale") return <><path d="M160 241v39m-31-22h62" stroke={accent} strokeWidth="4" /><path d="m143 258-13 19h26zm34 0-13 19h26z" fill="none" stroke={accent} strokeWidth="4" /></>;
  if (kind === "quill") return <><path d="M211 239q25-74 65-110-5 55-54 113" fill={accent} opacity=".78" /><path d="m205 257 30-38" stroke="#f0dca8" strokeWidth="4" /></>;
  if (kind === "compass") return <><circle cx="160" cy="258" r="19" fill="#102b29" stroke={accent} strokeWidth="4" /><path d="m160 244 6 14-6 14-6-14z" fill="#68e0cf" /></>;
  if (kind === "thread") return <><path d="M88 236c43 34 101 35 145 0M96 250c39 22 92 22 128-2" fill="none" stroke={accent} strokeWidth="3" opacity=".82" /></>;
  if (kind === "council") return <><path d="M105 253h110" stroke={accent} strokeWidth="4" /><circle cx="132" cy="253" r="8" fill="#35c9b8" /><circle cx="160" cy="253" r="8" fill={accent} /><circle cx="188" cy="253" r="8" fill="#35c9b8" /></>;
  if (kind === "lens") return <><circle cx="226" cy="238" r="21" fill="#102a28" stroke={accent} strokeWidth="5" /><path d="m240 253 20 20" stroke="#d7bc76" strokeWidth="6" strokeLinecap="round" /></>;
  if (kind === "ledger") return <><path d="M202 228h56v67h-56z" fill="#392b22" stroke={accent} strokeWidth="4" /><path d="M213 242h33m-33 14h29" stroke="#ddc587" strokeWidth="3" /></>;
  if (kind === "bell") return <><path d="M221 235q0-25 19-31 19 6 19 31l8 13h-54z" fill="#a96d31" stroke={accent} strokeWidth="3" /><circle cx="240" cy="251" r="6" fill={accent} /></>;
  if (kind === "journal") return <><path d="M202 229h59v66h-59z" fill="#453529" stroke={accent} strokeWidth="4" /><path d="M214 243h34m-34 13h28" stroke="#d6c49e" strokeWidth="3" /></>;
  if (kind === "gate") return <><path d="M218 226h48v70h-48z" fill="#253634" stroke={accent} strokeWidth="4" /><path d="M230 296v-39q12-21 24 0v39" fill="#0d1716" stroke="#d7bc76" strokeWidth="3" /></>;
  if (kind === "iron-quill") return <><path d="M217 221q23-61 59-91-6 51-48 94" fill={accent} opacity=".8" /><path d="m211 246 29-38" stroke="#d7bc76" strokeWidth="5" /></>;
  if (kind === "code") return <><path d="m212 241-14 14 14 14m42-28 14 14-14 14m-28 10 15-51" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></>;
  if (kind === "scroll") return <><path d="M203 229h59v65h-59q9-9 0-17z" fill="#d1b477" stroke="#9f7139" strokeWidth="4" /><path d="M215 244h34m-34 12h29" stroke="#76552e" strokeWidth="3" /></>;
  return null;
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
  const paintId = `agent-paint-${portrait.id}`;
  const bgId = `agent-bg-${portrait.id}`;
  const hairId = `agent-hair-${portrait.id}`;
  const cloakId = `agent-cloak-${portrait.id}`;
  const skinId = `agent-skin-${portrait.id}`;

  return (
    <span
      className={`${styles.frame} ${className}`.trim()}
      data-agent-id={portrait.id}
      data-agent-portrait="painterly-fantasy"
      data-locked={locked ? "true" : "false"}
      style={style}
    >
      {portrait.source ? (
        <Image className={styles.sourceImage} src={portrait.source} alt={label} fill sizes={`${size}px`} unoptimized />
      ) : (
        <svg className={styles.portraitSvg} viewBox="0 0 320 320" role="img" aria-label={label}>
          <defs>
            <radialGradient id={bgId} cx="48%" cy="30%" r="76%">
              <stop offset="0" stopColor="#24564f" />
              <stop offset=".55" stopColor="#102724" />
              <stop offset="1" stopColor="#050908" />
            </radialGradient>
            <linearGradient id={hairId} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor={portrait.hairHighlight} />
              <stop offset=".42" stopColor={portrait.hair} />
              <stop offset="1" stopColor="#211817" />
            </linearGradient>
            <linearGradient id={cloakId} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor={portrait.cloak} />
              <stop offset="1" stopColor="#101817" />
            </linearGradient>
            <linearGradient id={skinId} x1="0" y1="0" x2=".85" y2="1">
              <stop stopColor="#f0c8aa" />
              <stop offset=".5" stopColor={portrait.skin} />
              <stop offset="1" stopColor="#89584b" />
            </linearGradient>
            <filter id={paintId} x="-15%" y="-15%" width="130%" height="130%">
              <feTurbulence type="fractalNoise" baseFrequency=".018 .075" numOctaves="3" seed={portrait.id.length * 7} result="noise" />
              <feColorMatrix in="noise" type="saturate" values=".18" result="grain" />
              <feBlend in="SourceGraphic" in2="grain" mode="soft-light" />
            </filter>
          </defs>
          <rect width="320" height="320" fill={`url(#${bgId})`} />
          <circle cx="160" cy="126" r="102" fill="#42d3c0" opacity=".08" />
          <g filter={`url(#${paintId})`}>
            <path d="M35 320c20-85 67-122 125-122s106 37 125 122" fill={`url(#${cloakId})`} />
            {portrait.elf ? <><path d="M98 132 48 113l49 43z" fill={`url(#${skinId})`} /><path d="m222 132 50-19-49 43z" fill={`url(#${skinId})`} /></> : null}
            <path d="M125 188h70l12 48q-47 34-94 0z" fill={portrait.skin} opacity=".96" />
            <ellipse cx="160" cy="137" rx="67" ry="83" fill={`url(#${skinId})`} />
            <path d="M88 143c-6-70 27-111 74-111 51 0 82 42 75 109-24-24-47-34-74-33-28 1-51 11-75 35z" fill={`url(#${hairId})`} />
            <path d="M94 124c-12 41-4 82 18 112l22-29c-18-24-23-54-13-90z" fill={`url(#${hairId})`} opacity=".96" />
            <path d="M226 124c12 41 5 82-18 112l-21-29c18-24 23-54 13-90z" fill={`url(#${hairId})`} opacity=".93" />
            <path d="M118 131q17-9 32-1M170 130q17-9 32 1" fill="none" stroke="#57362f" strokeWidth="5" strokeLinecap="round" />
            <ellipse cx="136" cy="143" rx="6.5" ry="5.5" fill="#102824" />
            <ellipse cx="187" cy="143" rx="6.5" ry="5.5" fill="#102824" />
            <circle cx="134" cy="141" r="1.8" fill="#d9fff6" />
            <circle cx="185" cy="141" r="1.8" fill="#d9fff6" />
            <path d="M160 149c-5 12-6 24-1 28 5 3 11 1 15-2" fill="none" stroke="#925f52" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M138 189q23 14 46 0" fill="none" stroke="#75433e" strokeWidth="4.5" strokeLinecap="round" />
            <Accessory kind={portrait.accessory} accent={portrait.accent} />
          </g>
          <path d="M42 72Q160 8 278 72M42 248q118 64 236 0" fill="none" stroke="#5bd4c2" strokeWidth="2" opacity=".25" />
        </svg>
      )}
    </span>
  );
}
