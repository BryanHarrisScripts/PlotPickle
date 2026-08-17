"use client";

import { useState } from "react";
import { BUZZ_STORY_ROOMS, type BuzzStoryRoomId } from "../lib/buzz-story-room";
import { BUZZ_GUILDHALL_CHANNELS } from "../lib/buzz-guildhall";
import styles from "./community-navigation-rail.module.css";

export type CommunitySection = "overview" | "great-hall" | "story-rooms" | "people" | "agents" | "reviews" | "guildhall";
type StoryRoomNav = { roomId: BuzzStoryRoomId; channel: { id: string; name: string; description: string } };
type GuildhallRoomNav = { id: string; name: string; label: string; channelId: string };

type Props = {
  section: CommunitySection;
  storyRooms: readonly StoryRoomNav[];
  selectedStoryRoomId: BuzzStoryRoomId;
  guildhallReadyRooms: readonly GuildhallRoomNav[];
  selectedGuildhallRoomId: string;
  onSectionChange: (section: CommunitySection) => void;
  onOpenStoryRoom: (roomId: BuzzStoryRoomId) => void;
  onOpenGuildhallRoom: (roomId: string) => void;
};

export default function CommunityNavigationRail({ section, storyRooms, selectedStoryRoomId, guildhallReadyRooms, selectedGuildhallRoomId, onSectionChange, onOpenStoryRoom, onOpenGuildhallRoom }: Props) {
  const [expanded, setExpanded] = useState({ community: true, storyRooms: true, guildhall: false, tools: false });
  const toggle = (key: keyof typeof expanded) => setExpanded((value) => ({ ...value, [key]: !value[key] }));

  return <aside className={styles.communityRail} aria-label="Community navigation">
    <nav aria-label="Community sections">
      <section className={styles.communityRailGroup}>
        <button type="button" className={styles.groupButton} aria-expanded={expanded.community} onClick={() => toggle("community")}>
          <span>Community</span><span aria-hidden="true">{expanded.community ? "−" : "+"}</span>
        </button>
        {expanded.community ? <div className={styles.communityRailChildren}>
          <button type="button" aria-selected={section === "overview"} onClick={() => onSectionChange("overview")}>Overview</button>
          <button type="button" aria-selected={section === "great-hall"} onClick={() => onSectionChange("great-hall")}>Great Hall</button>
          <button type="button" className={styles.subgroupButton} aria-expanded={expanded.storyRooms} aria-selected={section === "story-rooms"} onClick={() => { toggle("storyRooms"); onSectionChange("story-rooms"); }}>Story Rooms</button>
          {expanded.storyRooms ? <div className={styles.roomChildren}>
            {storyRooms.map((room) => {
              const definition = BUZZ_STORY_ROOMS.find((item) => item.id === room.roomId);
              return <button data-community-story-room-nav type="button" key={room.roomId} aria-current={section === "story-rooms" && selectedStoryRoomId === room.roomId ? "page" : undefined} onClick={() => onOpenStoryRoom(room.roomId)}>{definition?.label ?? room.roomId}</button>;
            })}
            {!storyRooms.length ? <p>No accessible Story Rooms yet.</p> : null}
          </div> : null}
          <button type="button" aria-selected={section === "people"} onClick={() => onSectionChange("people")}>People</button>
        </div> : null}
      </section>

      <section className={styles.communityRailGroup}>
        <button type="button" className={styles.groupButton} aria-expanded={expanded.guildhall} onClick={() => toggle("guildhall")}>
          <span>Guildhall</span><span aria-hidden="true">{expanded.guildhall ? "−" : "+"}</span>
        </button>
        <small>Internal coordination</small>
        {expanded.guildhall ? <div className={styles.communityRailChildren}>
          {guildhallReadyRooms.map((room) => {
            const definition = BUZZ_GUILDHALL_CHANNELS.find((item) => item.id === room.id);
            if (!definition || definition.id === "great-hall") return null;
            return <button data-community-guildhall-room-nav type="button" key={room.id} aria-current={section === "guildhall" && selectedGuildhallRoomId === room.id ? "page" : undefined} onClick={() => onOpenGuildhallRoom(room.id)}>{definition.label}</button>;
          })}
          {!guildhallReadyRooms.filter((room) => room.id !== "great-hall").length ? <button type="button" aria-selected={section === "guildhall"} onClick={() => onSectionChange("guildhall")}>Guildhall status</button> : null}
        </div> : null}
      </section>

      <section className={styles.communityRailGroup}>
        <button type="button" className={styles.groupButton} aria-expanded={expanded.tools} onClick={() => toggle("tools")}>
          <span>Community tools</span><span aria-hidden="true">{expanded.tools ? "−" : "+"}</span>
        </button>
        {expanded.tools ? <div className={styles.communityRailChildren}>
          <button type="button" aria-selected={section === "agents"} onClick={() => onSectionChange("agents")}>Agents &amp; Stewards</button>
          <button type="button" aria-selected={section === "reviews"} onClick={() => onSectionChange("reviews")}>Review Queue</button>
        </div> : null}
      </section>
    </nav>
  </aside>;
}
