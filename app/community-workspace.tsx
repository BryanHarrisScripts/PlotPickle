"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FOUNDATION_PROJECT_STORAGE_KEY } from "../core/contracts/foundation-plan";
import { normalizeFoundationProject, type PPFProject } from "../core/project/project";
import { BUZZ_GUILDHALL_ACTORS, BUZZ_GUILDHALL_CHANNELS } from "../lib/buzz-guildhall";
import { BUZZ_STORY_ROOMS, buzzProjectSlug, buzzRoomName, type BuzzStoryRoomId } from "../lib/buzz-story-room";
import {
  COMMUNITY_GREAT_HALL_ROOM_ID,
  COMMUNITY_VISIBLE_STORY_ROOMS,
  UNVERIFIED_HUMAN_BUZZ_IDENTITY,
  createGreatHallActiveRoom,
  createStoryActiveRoom,
  humanBuzzFingerprint,
  isKnownHumanBuzzIdentity,
  type ActiveBbsRoom,
  type HumanBuzzIdentity,
} from "../lib/community-bbs";
import CommunityAgentRoster from "./community-agent-roster";
import CommunityBackdoorTerminal from "./community-backdoor-terminal";
import CommunityStoryRoomAccess from "./community-story-room-access";
import ConnectedStudiosPanel from "./connected-studios-panel";
import navigationStyles from "./community-navigation.module.css";
import styles from "./community-workspace.module.css";

const BUZZ_API = "/api/local-buzz";
const PROPOSAL_STORAGE_KEY = "plotpickle.buzz.proposals.v1";
const COMMUNITY_BBS_NAME = "PlotPickle Community BBS";

type CommunitySection = "overview" | "terminal" | "connected-studios" | "story-rooms" | "people" | "agents" | "reviews" | "guildhall";
type BuzzChannel = { id: string; name: string; description: string };
type CommunityMember = { pubkey: string; displayName: string; presence: string; updatedAt: string };
type ActivityItem = { id: string; content: string; author: string; createdAt: string };
type CommunityStatus = {
  configured: boolean;
  identityVerified: boolean;
  community: string;
  relayUrl: string;
  identityLabel: string;
  greatHall: BuzzChannel | null;
  members: CommunityMember[];
  recentActivity: ActivityItem[];
  canManageGreatHall: boolean;
  fullRosterSupported: boolean;
  inviteManagement: "buzz-desktop";
  message: string;
};
type GuildhallStatus = {
  configured: boolean;
  identityVerified: boolean;
  canSetup: boolean;
  operational: boolean;
  readyCount: number;
  totalCount: number;
  readyRooms: Array<{ id: string; name: string; label: string; channelId: string }>;
  missingRooms: Array<{ id: string; name: string; label: string }>;
  message: string;
};
type StoryRoomRecord = { roomId: BuzzStoryRoomId; channel: BuzzChannel; created?: boolean };
type ReviewItem = { id: string; title: string; status: string; roomId?: string; createdAt?: string };

const SECTIONS: Array<{ id: CommunitySection; label: string; primary?: boolean }> = [
  { id: "overview", label: "Overview" },
  { id: "terminal", label: "Terminal", primary: true },
  { id: "story-rooms", label: "Story Rooms", primary: true },
  { id: "connected-studios", label: "Connected Studios" },
  { id: "people", label: "People" },
  { id: "agents", label: "Agents & Stewards" },
  { id: "reviews", label: "Review Queue" },
  { id: "guildhall", label: "Guildhall" },
];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BUZZ_API}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || `Buzz returned ${response.status}.`);
  return body;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}

function parseStoredProject(source: string) {
  try {
    return { ok: true as const, project: normalizeFoundationProject(JSON.parse(source)) };
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
}

function readProject(): PPFProject | null {
  if (typeof window === "undefined") return null;
  const source = window.localStorage.getItem(FOUNDATION_PROJECT_STORAGE_KEY);
  if (!source) return null;
  const parsed = parseStoredProject(source);
  if (!parsed.ok) {
    console.warn(`PlotPickle could not read the active project from local storage: ${parsed.error}`);
    return null;
  }
  return parsed.project;
}

function readReviews(): ReviewItem[] {
  if (typeof window === "undefined") return [];
  try {
    const source = window.localStorage.getItem(PROPOSAL_STORAGE_KEY);
    const value: unknown = source ? JSON.parse(source) : [];
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const item = entry as Record<string, unknown>;
      const status = typeof item.status === "string" ? item.status : "";
      if (status !== "open") return [];
      return [{
        id: typeof item.id === "string" ? item.id : `${Date.now()}-${Math.random()}`,
        title: typeof item.title === "string" && item.title ? item.title : "Community story suggestion",
        status,
        roomId: typeof item.roomId === "string" ? item.roomId : undefined,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : undefined,
      }];
    });
  } catch (error) {
    console.warn(`PlotPickle could not read the local Community review queue: ${errorMessage(error)}`);
    return [];
  }
}

function displayDate(value: string | undefined) {
  if (!value) return "Recently";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleString();
}

function buzzDesktopUrl(relay: string, name: string) {
  try {
    const url = new URL(relay);
    if (!["ws:", "wss:"].includes(url.protocol)) return "";
    const query = new URLSearchParams({ relay: url.toString().replace(/\/$/, "") });
    if (name.trim()) query.set("name", name.trim());
    return `buzz://add-community?${query.toString()}`;
  } catch (error) {
    console.warn(`PlotPickle could not build the Buzz Desktop community link: ${errorMessage(error)}`);
    return "";
  }
}

export default function CommunityWorkspace({ onOpenSettings }: { readonly onOpenSettings: () => void }) {
  const [section, setSection] = useState<CommunitySection>("terminal");
  const [expandedNavigationSection, setExpandedNavigationSection] = useState<CommunitySection | null>("story-rooms");
  const [community, setCommunity] = useState<CommunityStatus | null>(null);
  const [humanIdentity, setHumanIdentity] = useState<HumanBuzzIdentity | null>(null);
  const [guildhall, setGuildhall] = useState<GuildhallStatus | null>(null);
  const [project, setProject] = useState<PPFProject | null>(null);
  const [storyRooms, setStoryRooms] = useState<StoryRoomRecord[]>([]);
  const [activeRoom, setActiveRoom] = useState<ActiveBbsRoom | null>(null);
  const [memberPubkey, setMemberPubkey] = useState("");
  const [memberRole, setMemberRole] = useState("member");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const onlineMembers = community?.members.filter((member) => member.presence === "online").length ?? 0;
  const activeProjectName = project?.title || "No active story";
  const nodeName = community?.community.trim() || "";
  const desktopUrl = buzzDesktopUrl(community?.relayUrl || "", community?.community || "");
  const connected = Boolean(community?.identityVerified && community.greatHall);
  const humanCanPost = isKnownHumanBuzzIdentity(humanIdentity);
  const callerName = humanIdentity?.displayName.trim() || "UNVERIFIED WRITER";
  const callerFingerprint = humanBuzzFingerprint(humanIdentity?.pubkey || "");
  const visibleStoryRoomCount = COMMUNITY_VISIBLE_STORY_ROOMS.filter((definition) => storyRooms.some((room) => room.roomId === definition.id)).length;
  const readyHallCount = (community?.greatHall ? 1 : 0) + visibleStoryRoomCount;
  const visibleMembers = community?.members.slice(0, 6) ?? [];

  const refreshCommunity = useCallback(async (showNotice = false) => {
    const [communityBody, guildhallBody, humanBody] = await Promise.all([
      request<CommunityStatus & { ok: true }>("/community/status"),
      request<GuildhallStatus & { ok: true }>("/guildhall/status"),
      request<HumanBuzzIdentity & { ok: true }>("/human-identity").catch((error) => ({
        ...UNVERIFIED_HUMAN_BUZZ_IDENTITY,
        ok: true as const,
        message: error instanceof Error ? error.message : UNVERIFIED_HUMAN_BUZZ_IDENTITY.message,
      })),
    ]);
    setCommunity(communityBody);
    setGuildhall(guildhallBody);
    setHumanIdentity(humanBody);
    setActiveRoom((current) => {
      const greatHall = createGreatHallActiveRoom(communityBody.greatHall);
      if (!current || current.kind === "great-hall") return greatHall;
      return current;
    });
    if (showNotice) setNotice(humanBody.humanCommunityAllowed ? communityBody.message : humanBody.message);
    return { communityBody, guildhallBody, humanBody };
  }, []);

  const loadStoryRooms = useCallback(async (prefix: string, identityVerified: boolean) => {
    if (!prefix || !identityVerified) { setStoryRooms([]); return; }
    const body = await request<{ rooms: BuzzChannel[] }>(`/rooms?projectPrefix=${encodeURIComponent(prefix)}`);
    const currentProject = readProject();
    const mapped = body.rooms.flatMap((channel) => {
      const definition = BUZZ_STORY_ROOMS.find((room) => channel.name === buzzRoomName(currentProject, room.id));
      return definition ? [{ roomId: definition.id, channel } satisfies StoryRoomRecord] : [];
    });
    setStoryRooms(mapped);
    setActiveRoom((current) => {
      if (!current || current.kind !== "story-room") return current;
      const record = mapped.find((room) => room.roomId === current.roomId);
      return record ? createStoryActiveRoom(record.roomId, record.channel) : current;
    });
  }, []);

  useEffect(() => {
    const current = readProject();
    setProject(current);
    setReviews(readReviews());
    let cancelled = false;
    void refreshCommunity(false)
      .then(({ communityBody }) => {
        if (cancelled || !communityBody.identityVerified || !current) return;
        return loadStoryRooms(buzzProjectSlug(current), communityBody.identityVerified);
      })
      .catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : "Community status could not be loaded."); });
    return () => { cancelled = true; };
  }, [loadStoryRooms, refreshCommunity]);

  async function run(name: string, operation: () => Promise<void>) {
    setBusy(name);
    setNotice("");
    try { await operation(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "The Community action could not be completed."); }
    finally { setBusy(""); }
  }

  async function setupGuildhall() {
    await run("guildhall", async () => {
      const result = await request<GuildhallStatus & { message: string }>("/guildhall/setup", { method: "POST" });
      setGuildhall(result);
      await refreshCommunity(false);
      setNotice(result.message);
    });
  }

  async function ensureStoryRooms() {
    if (!project) { setNotice("Open LEARN or PLAN once so PlotPickle has an active story before creating Story Rooms."); return; }
    await run("story-rooms", async () => {
      const body = await request<{ rooms: StoryRoomRecord[] }>("/rooms/ensure", {
        method: "POST",
        body: JSON.stringify({
          projectPrefix: buzzProjectSlug(project),
          rooms: BUZZ_STORY_ROOMS.map((room) => ({ id: room.id, name: buzzRoomName(project, room.id), description: `${project.title} · ${room.description}` })),
        }),
      });
      setStoryRooms(body.rooms);
      setNotice(`All ${body.rooms.length} compatibility-safe private Story Room channels are ready for ${project.title}.`);
    });
  }

  async function addMember() {
    if (!memberPubkey.trim()) return;
    await run("member-add", async () => {
      const body = await request<CommunityStatus & { ok: true }>("/community/members", { method: "POST", body: JSON.stringify({ pubkey: memberPubkey.trim(), role: memberRole }) });
      setCommunity(body);
      setMemberPubkey("");
      setNotice("The existing Buzz member was added to the PlotPickle Great Hall.");
    });
  }

  async function removeMember(pubkey: string) {
    await run(`remove-${pubkey}`, async () => {
      const body = await request<CommunityStatus & { ok: true }>("/community/members", { method: "DELETE", body: JSON.stringify({ pubkey }) });
      setCommunity(body);
      setNotice("Great Hall access was removed for that member.");
    });
  }

  function openGreatHall() {
    const room = createGreatHallActiveRoom(community?.greatHall);
    if (!room) { setNotice("Great Hall is not available from the current Buzz community yet."); return; }
    setActiveRoom(room);
    setSection("terminal");
    setExpandedNavigationSection("story-rooms");
  }

  function openStoryRoom(roomId: BuzzStoryRoomId) {
    const record = storyRooms.find((room) => room.roomId === roomId);
    const room = record ? createStoryActiveRoom(record.roomId, record.channel) : null;
    if (!room) { setNotice("That Story Room has not been created yet."); return; }
    setActiveRoom(room);
    setSection("terminal");
    setExpandedNavigationSection("story-rooms");
  }

  function toggleNavigationSection(id: CommunitySection) {
    setExpandedNavigationSection((current) => current === id ? null : id);
  }

  const buzzState = !community ? "checking" : connected ? "online" : community.configured && !community.identityVerified ? "checking" : community.identityVerified && community.message.includes("has not been created") ? "checking" : "offline";
  const buzzStatusLabel = buzzState === "online" ? "BUZZ ONLINE" : buzzState === "checking" ? "BUZZ CHECKING" : "BUZZ OFFLINE";
  const buzzLampColor = buzzState === "online" ? "#52f6c5" : buzzState === "checking" ? "#d8a25e" : "#6e4d45";

  function navigationStatus(id: CommunitySection) {
    if (id === "terminal") return activeRoom ? `Hall ${activeRoom.hallNumber} · ${activeRoom.roomName}` : `${onlineMembers} online`;
    if (id === "story-rooms") return `${readyHallCount}/6 halls ready · ${activeProjectName}`;
    if (id === "connected-studios") return connected ? "Community connected" : "Available offline";
    if (id === "people") return `${community?.members.length ?? 0} members`;
    if (id === "agents") return `${BUZZ_GUILDHALL_ACTORS.length} agents & stewards`;
    if (id === "reviews") return `${reviews.length} waiting for review`;
    if (id === "guildhall") return `${guildhall?.readyCount ?? 0}/${guildhall?.totalCount ?? 11} rooms ready`;
    return "";
  }

  return (
    <div className={styles.page}>
      {section !== "terminal" ? <header className={styles.hero}>
        <div><p>Community</p><h1>The PlotPickle Community gathers here.</h1><span>People, Story Rooms and approved agents share one native PlotPickle workspace. Buzz provides the signed community layer underneath; the writer stays inside PlotPickle for normal collaboration.</span></div>
        <div className={styles.connection} data-ready={connected ? "true" : "false"} role="status"><i aria-hidden="true" /><div><strong>{connected ? "Community connected" : "Community setup needed"}</strong><small>{humanCanPost ? community?.message : humanIdentity?.message || community?.message || "Checking Buzz and the PlotPickle Guildhall…"}</small></div></div>
      </header> : null}

      <div className={navigationStyles.communityLayout}>
        <aside className={navigationStyles.communityRail} aria-label="Community and Guildhall navigation">
          {section === "terminal" ? <>
            <header className={navigationStyles.railHeader}><b>{COMMUNITY_BBS_NAME}</b></header>
            <div className={navigationStyles.destinationDetails} data-community-bbs-server="true">
              <small>SERVER / NODE</small><p><strong>{nodeName || "BUZZ NODE UNAVAILABLE"}</strong></p>
              <div role="status" data-buzz-state={buzzState} aria-label={buzzStatusLabel} style={{ display: "grid", gridTemplateColumns: "12px 1fr", gap: 8, alignItems: "center", margin: "12px 0", padding: "9px 10px", border: "1px solid rgba(78, 255, 211, 0.18)", background: "rgba(4, 14, 12, 0.65)" }}>
                <i aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: buzzLampColor, boxShadow: `0 0 10px ${buzzLampColor}` }} />
                <span><strong>{buzzStatusLabel}</strong><br /><small>{community?.message || "Checking Buzz identity and relay…"}</small></span>
              </div>
              <p data-community-caller="verified-human"><small>CALLER</small><br /><strong>{callerName}</strong>{callerFingerprint ? <><br /><small>{callerFingerprint}</small></> : null}</p>
              {!humanCanPost ? <div role="alert" data-community-identity-mismatch={humanIdentity?.kind === "agent" ? "true" : undefined}><small>{humanIdentity?.message || "Connect and verify your personal Buzz identity before posting."}</small>{humanIdentity?.kind === "agent" ? <p><strong>Sage is your PlotPickle guide; Sage is not your Community identity.</strong></p> : null}</div> : null}
              <p><small>CALLERS</small><br /><strong>{community?.members.length ?? 0} members · {onlineMembers} online</strong></p>
              <div aria-label="Connected Community callers">{visibleMembers.length ? visibleMembers.map((member) => <p key={member.pubkey} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{member.displayName}</span><small>{member.presence || "offline"}</small></p>) : <p><small>No callers returned yet.</small></p>}</div>
              {!humanCanPost ? <button type="button" className={navigationStyles.destinationButton} onClick={onOpenSettings}><b>Connect / Claim writer identity</b></button> : null}
            </div>
          </> : <header className={navigationStyles.railHeader}><b>Community &amp; Guildhall</b></header>}

          <nav id="community-destinations" className={navigationStyles.destinationList} aria-label="Community destinations">
            {SECTIONS.map((item) => {
              const expandable = item.id !== "overview";
              const expanded = expandedNavigationSection === item.id;
              return <div className={navigationStyles.destinationItem} data-active={section === item.id ? "true" : "false"} data-expandable={expandable ? "true" : "false"} data-primary={item.primary ? "true" : undefined} key={item.id}>
                <div className={navigationStyles.destinationRow}>
                  <button type="button" className={navigationStyles.destinationButton} data-community-section={item.id} aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)}><b>{item.label}</b></button>
                  {expandable ? <button type="button" className={navigationStyles.destinationChevron} aria-expanded={expanded} aria-controls={`community-nav-${item.id}`} aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label}`} onClick={() => toggleNavigationSection(item.id)}><span aria-hidden="true">›</span></button> : null}
                </div>
                {expandable && expanded ? <div className={navigationStyles.destinationDetails} id={`community-nav-${item.id}`}><small>{navigationStatus(item.id)}</small>{item.id === "story-rooms" ? <div className={navigationStyles.subDestinationList}>
                  <button type="button" className={navigationStyles.subDestination} data-community-room={COMMUNITY_GREAT_HALL_ROOM_ID} disabled={!community?.greatHall} aria-current={activeRoom?.kind === "great-hall" ? "page" : undefined} onClick={openGreatHall}><span>Hall 1 · Great Hall</span><small>{community?.greatHall ? "Ready · human conversation" : "Not available"}</small></button>
                  {COMMUNITY_VISIBLE_STORY_ROOMS.map((definition) => { const ready = storyRooms.some((room) => room.roomId === definition.id); return <button key={definition.id} type="button" className={navigationStyles.subDestination} data-community-room={definition.id} disabled={!ready} aria-current={activeRoom?.roomId === definition.id ? "page" : undefined} onClick={() => openStoryRoom(definition.id)}><span>Hall {definition.hallNumber} · {definition.label}</span><small>{ready ? "Ready" : "Not created"}</small></button>; })}
                </div> : null}</div> : null}
              </div>;
            })}
          </nav>
        </aside>

        <div className={navigationStyles.communityContent}>
          {section !== "terminal" && !community?.identityVerified ? <section className={styles.setupCard}><div><span>Connect once</span><h2>Community uses your locally encrypted Buzz identity.</h2><p>Open basic Settings, connect and verify your Buzz community, then return here. The private identity stays on this computer and is not stored in GitHub or the PPF.</p></div><button type="button" onClick={onOpenSettings}>Open Settings</button></section> : section !== "terminal" && !guildhall?.operational ? <section className={styles.setupCard}><div><span>One-time Guildhall setup</span><h2>{guildhall ? `${guildhall.readyCount}/${guildhall.totalCount} Guildhall rooms ready` : "Prepare the PlotPickle Guildhall"}</h2><p>PlotPickle creates only the missing private rooms, then verifies that all eleven exist before reporting the community as operational.</p></div><button type="button" disabled={busy === "guildhall" || !guildhall?.canSetup} onClick={() => void setupGuildhall()}>{busy === "guildhall" ? "Building Guildhall…" : "Set up PlotPickle Guildhall"}</button></section> : null}

          {section === "terminal" ? <CommunityBackdoorTerminal connected={connected} canPost={humanCanPost} nodeName={nodeName} humanIdentity={humanIdentity} activeRoom={activeRoom} greatHallChannelId={community?.greatHall?.id || ""} members={community?.members ?? []} recentActivity={community?.recentActivity ?? []} readyGuildhallRooms={guildhall?.readyRooms ?? []} storyRooms={storyRooms} reviews={reviews} desktopUrl={desktopUrl} onExit={() => setSection("overview")} onNotice={setNotice} onOpenSettings={onOpenSettings} onRefreshCommunity={() => refreshCommunity(false).then(() => undefined)} onSelectGreatHall={openGreatHall} onSelectStoryRoom={openStoryRoom} /> : null}

          {section === "overview" ? <main className={styles.stack}>
            <section className={styles.summaryGrid}>
              <button type="button" onClick={openGreatHall}><span>Hall 1 · Great Hall</span><strong>{community?.members.length ?? 0} members</strong><small>{onlineMembers} online now · human conversation</small></button>
              <button type="button" onClick={() => setSection("story-rooms")}><span>Story Rooms</span><strong>{activeProjectName}</strong><small>{readyHallCount}/6 visible halls ready</small></button>
              <button type="button" onClick={() => setSection("reviews")}><span>Review queue</span><strong>{reviews.length} waiting</strong><small>Nothing changes PPF canon without approval</small></button>
              <button type="button" onClick={() => setSection("terminal")}><span>Backdoor Terminal</span><strong>{activeRoom ? `HALL ${activeRoom.hallNumber}` : "CONNECT 2400"}</strong><small>Room-first signed Community BBS</small></button>
            </section>
            <section className={styles.panel}><header><div><span>Recent community activity</span><h2>What is happening in the Great Hall</h2></div><button type="button" disabled={Boolean(busy)} onClick={() => void refreshCommunity(true)}>Refresh</button></header><div className={styles.activityList}>{community?.recentActivity.length ? community.recentActivity.slice(0, 8).map((item) => <article key={item.id}><div><strong>{item.author || "Guild member"}</strong><small>{displayDate(item.createdAt)}</small></div><p>{item.content}</p></article>) : <p className={styles.empty}>No Great Hall messages yet. Open Hall 1 to start the conversation.</p>}</div></section>
            <section className={styles.twoColumn}><article className={styles.panel}><span>People</span><h2>{community?.members.length ?? 0} Great Hall members</h2><p>Presence comes from Buzz, but normal member viewing stays inside PlotPickle.</p><button type="button" onClick={() => setSection("people")}>See people</button></article><article className={styles.panel}><span>Agents & Stewards</span><h2>{BUZZ_GUILDHALL_ACTORS.length} lore identities</h2><p>Agent coordination stays in explicit Guildhall routes rather than flooding the human Great Hall.</p><button type="button" onClick={() => setSection("agents")}>Meet the Guildhall</button></article></section>
          </main> : null}

          {section === "story-rooms" ? <main className={styles.stack}><section className={styles.sectionHeading}><div><span>Story Rooms</span><h2>{project ? `Six visible halls for ${project.title}` : "Open a story to create its private halls"}</h2><p>Great Hall is Hall 1. The five specialist Story Rooms are Halls 2-6. The legacy broad `story` channel remains compatibility data only and is not a duplicate seventh destination.</p></div><button type="button" disabled={!community?.identityVerified || !project || Boolean(busy)} onClick={() => void ensureStoryRooms()}>{busy === "story-rooms" ? "Creating…" : storyRooms.length === 6 ? "Compatibility rooms ready" : "Create missing Story Rooms"}</button></section><section className={styles.memberGrid}><article data-ready={community?.greatHall ? "true" : "false"}><header><div><strong>Hall 1 · Great Hall</strong></div><span>{community?.greatHall ? "Ready" : "Unavailable"}</span></header><p>Human-to-human public conversation. Merrin may moderate; ordinary specialist agent evidence belongs in Guildhall routes.</p><button type="button" disabled={!community?.greatHall} onClick={openGreatHall}>Open Hall 1</button></article>{COMMUNITY_VISIBLE_STORY_ROOMS.map((definition) => { const record = storyRooms.find((room) => room.roomId === definition.id); return <article key={definition.id} data-ready={record ? "true" : "false"><header><div><strong>Hall {definition.hallNumber} · {definition.label}</strong></div><span>{record ? "Ready" : "Not created"}</span></header><p>{definition.description}</p><button type="button" disabled={!record} onClick={() => openStoryRoom(definition.id)}>Open Hall {definition.hallNumber}</button></article>; })}</section>{activeRoom?.kind === "story-room" ? (() => { const record = storyRooms.find((room) => room.roomId === activeRoom.roomId); return record ? <CommunityStoryRoomAccess channel={record.channel} greatHallMembers={community?.members ?? []} desktopUrl={desktopUrl} /> : null; })() : null}</main> : null}

          {section === "connected-studios" ? <main className={styles.stack}><ConnectedStudiosPanel onOpenGreatHall={openGreatHall} /></main> : null}

          {section === "people" ? <main className={styles.stack}><section className={styles.sectionHeading}><div><span>People</span><h2>Great Hall members and presence</h2><p>PlotPickle can read Great Hall membership and online/away/offline presence natively. Full community-wide invitation issuance is not exposed by the current Buzz CLI, so that owner-only step remains in Buzz Desktop for now.</p></div></section><section className={styles.memberGrid}>{community?.members.length ? community.members.map((member) => <article key={member.pubkey}><header><div><i data-presence={member.presence} aria-hidden="true" /><strong>{member.displayName}</strong></div><span>{member.presence || "offline"}</span></header><small>{member.pubkey.slice(0, 12)}…{member.pubkey.slice(-8)}</small><button type="button" disabled={Boolean(busy)} onClick={() => void removeMember(member.pubkey)}>Remove from Great Hall</button></article>) : <p className={styles.empty}>No Great Hall members were returned yet.</p>}</section><section className={styles.accessCard}><div><span>Add existing Buzz member</span><h3>Grant Great Hall access</h3><p>Paste the 64-character public key of someone who already belongs to your Buzz community, then choose their Great Hall role.</p></div><div className={styles.accessControls}><input value={memberPubkey} onChange={(event) => setMemberPubkey(event.target.value)} placeholder="64-character Buzz public key" /><select value={memberRole} onChange={(event) => setMemberRole(event.target.value)}><option value="member">Member</option><option value="guest">Guest</option><option value="admin">Admin</option><option value="bot">Bot</option></select><button type="button" disabled={!community?.canManageGreatHall || !memberPubkey.trim() || Boolean(busy)} onClick={() => void addMember()}>Add to Great Hall</button></div></section><section className={styles.boundaryCard}><div><span>Invite a new person</span><h3>Buzz still owns new-community invitations.</h3><p>This is the one community-owner task PlotPickle does not fake. Until Buzz exposes invitation issuance through its supported CLI/API, use Buzz Desktop for the initial invite; after they join, PlotPickle can manage their Great Hall and Story Room access here.</p></div>{desktopUrl ? <a href={desktopUrl}>Open community in Buzz Desktop</a> : <button type="button" onClick={onOpenSettings}>Finish Buzz setup</button>}</section></main> : null}

          {section === "agents" ? <main className={styles.stack}><CommunityAgentRoster /></main> : null}

          {section === "reviews" ? <main className={styles.stack}><section className={styles.sectionHeading}><div><span>Review Queue</span><h2>Community discussion never becomes canon by itself.</h2><p>Selected discussion can become a proposal, but the writer must explicitly approve a change before the PPF is updated.</p></div></section><section className={styles.reviewList}>{reviews.length ? reviews.map((review) => <article key={review.id}><div><strong>{review.title}</strong><small>{review.roomId ? `From ${review.roomId}` : "Community proposal"} · {displayDate(review.createdAt)}</small></div><span>Awaiting human review</span></article>) : <p className={styles.empty}>Nothing is waiting for review. This is a good state: there are no community suggestions asking to change story canon.</p>}</section><section className={styles.boundaryCard}><div><span>Authority boundary</span><h3>PPF remains the creative record.</h3><p>Community messages, agent observations and Guildhall activity are discussion and evidence. They can suggest; they cannot silently rewrite the writer&apos;s accepted story.</p></div></section></main> : null}

          {section === "guildhall" ? <main className={styles.stack}><section className={styles.sectionHeading}><div><span>Guildhall</span><h2>Agent coordination beneath the human Community BBS</h2><p>Great Hall is the human gathering place. Lore, Wyrmwood, continuity, visual review, UAT, repairs, GitHub status and durable agent evidence stay on their explicit Guildhall routes.</p></div><button type="button" disabled={!guildhall?.canSetup || guildhall?.operational || Boolean(busy)} onClick={() => void setupGuildhall()}>{guildhall?.operational ? "Guildhall operational" : "Create missing rooms"}</button></section><section className={styles.guildGrid}>{BUZZ_GUILDHALL_CHANNELS.map((definition) => { const ready = guildhall?.readyRooms.some((room) => room.id === definition.id) ?? false; return <article key={definition.id} data-ready={ready ? "true" : "false"><header><strong>{definition.label}</strong><span>{ready ? "Ready" : "Missing"}</span></header><p>{definition.description}</p><small>{definition.id === "great-hall" ? "Human Community gathering route" : "Explicit agent / coordination route"}</small></article>; })}</section></main> : null}
        </div>
      </div>
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    </div>
  );
}
