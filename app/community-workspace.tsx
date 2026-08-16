"use client";

import { useEffect, useMemo, useState } from "react";
import { FOUNDATION_PROJECT_STORAGE_KEY } from "../core/contracts/foundation-plan";
import { normalizeFoundationProject, type PPFProject } from "../core/project/project";
import { BUZZ_GUILDHALL_ACTORS, BUZZ_GUILDHALL_CHANNELS } from "../lib/buzz-guildhall";
import { BUZZ_STORY_ROOMS, buzzProjectSlug, buzzRoomName, type BuzzStoryRoomId } from "../lib/buzz-story-room";
import styles from "./community-workspace.module.css";

const BUZZ_API = "/api/local-buzz";
const PROPOSAL_STORAGE_KEY = "plotpickle.buzz.proposals.v1";

type CommunitySection = "overview" | "great-hall" | "story-rooms" | "people" | "agents" | "reviews" | "guildhall";
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
type BuzzMessage = { id: string; content: string; author: string; createdAt: string };
type ReviewItem = { id: string; title: string; status: string; roomId?: string; createdAt?: string };

const SECTIONS: Array<{ id: CommunitySection; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "People, rooms, reviews and recent activity" },
  { id: "great-hall", label: "Great Hall", description: "Community-wide discussion" },
  { id: "story-rooms", label: "Story Rooms", description: "Private discussion for the active story" },
  { id: "people", label: "People", description: "Great Hall members and presence" },
  { id: "agents", label: "Agents & Stewards", description: "PlotPickle lore agents and operational stewards" },
  { id: "reviews", label: "Review Queue", description: "Community suggestions waiting for human review" },
  { id: "guildhall", label: "Guildhall", description: "Internal coordination rooms and status" },
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

function readProject(): PPFProject | null {
  if (typeof window === "undefined") return null;
  const source = window.localStorage.getItem(FOUNDATION_PROJECT_STORAGE_KEY);
  if (!source) return null;
  try { return normalizeFoundationProject(JSON.parse(source)); } catch { return null; }
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
  } catch { return []; }
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
  } catch { return ""; }
}

export default function CommunityWorkspace({ onOpenSettings }: { readonly onOpenSettings: () => void }) {
  const [section, setSection] = useState<CommunitySection>("overview");
  const [community, setCommunity] = useState<CommunityStatus | null>(null);
  const [guildhall, setGuildhall] = useState<GuildhallStatus | null>(null);
  const [project, setProject] = useState<PPFProject | null>(null);
  const [storyRooms, setStoryRooms] = useState<StoryRoomRecord[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<BuzzStoryRoomId>("story");
  const [storyMessages, setStoryMessages] = useState<BuzzMessage[]>([]);
  const [hallDraft, setHallDraft] = useState("");
  const [storyDraft, setStoryDraft] = useState("");
  const [memberPubkey, setMemberPubkey] = useState("");
  const [memberRole, setMemberRole] = useState("member");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const selectedRoom = storyRooms.find((room) => room.roomId === selectedRoomId) ?? null;
  const onlineMembers = community?.members.filter((member) => member.presence === "online").length ?? 0;
  const activeProjectName = project?.title || "No active story";
  const storyPrefix = useMemo(() => project ? buzzProjectSlug(project) : "", [project]);
  const desktopUrl = buzzDesktopUrl(community?.relayUrl || "", community?.community || "");

  async function refreshCommunity(showNotice = false) {
    const [communityBody, guildhallBody] = await Promise.all([
      request<CommunityStatus & { ok: true }>("/community/status"),
      request<GuildhallStatus & { ok: true }>("/guildhall/status"),
    ]);
    setCommunity(communityBody);
    setGuildhall(guildhallBody);
    if (showNotice) setNotice(communityBody.message);
    return { communityBody, guildhallBody };
  }

  async function loadStoryRooms(prefix = storyPrefix) {
    if (!prefix || !community?.identityVerified) { setStoryRooms([]); return; }
    const body = await request<{ rooms: BuzzChannel[] }>(`/rooms?projectPrefix=${encodeURIComponent(prefix)}`);
    const mapped = body.rooms.flatMap((channel) => {
      const definition = BUZZ_STORY_ROOMS.find((room) => channel.name === buzzRoomName(project, room.id));
      return definition ? [{ roomId: definition.id, channel } satisfies StoryRoomRecord] : [];
    });
    setStoryRooms(mapped);
  }

  async function loadStoryMessages(room = selectedRoom) {
    if (!room) { setStoryMessages([]); return; }
    const body = await request<{ messages: BuzzMessage[] }>(`/messages?channel=${encodeURIComponent(room.channel.id)}&limit=40`);
    setStoryMessages(body.messages);
  }

  useEffect(() => {
    setProject(readProject());
    setReviews(readReviews());
    let cancelled = false;
    void refreshCommunity(false)
      .then(({ communityBody }) => {
        if (cancelled || !communityBody.identityVerified) return;
        const current = readProject();
        if (!current) return;
        const prefix = buzzProjectSlug(current);
        return request<{ rooms: BuzzChannel[] }>(`/rooms?projectPrefix=${encodeURIComponent(prefix)}`).then((body) => {
          if (cancelled) return;
          const mapped = body.rooms.flatMap((channel) => {
            const definition = BUZZ_STORY_ROOMS.find((room) => channel.name === buzzRoomName(current, room.id));
            return definition ? [{ roomId: definition.id, channel } satisfies StoryRoomRecord] : [];
          });
          setStoryRooms(mapped);
        });
      })
      .catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : "Community status could not be loaded."); });
    return () => { cancelled = true; };
  }, []);

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
          rooms: BUZZ_STORY_ROOMS.map((room) => ({
            id: room.id,
            name: buzzRoomName(project, room.id),
            description: `${project.title} · ${room.description}`,
          })),
        }),
      });
      setStoryRooms(body.rooms);
      setNotice(`All ${body.rooms.length} private Story Rooms are ready for ${project.title}.`);
    });
  }

  async function sendHallMessage() {
    if (!community?.greatHall || !hallDraft.trim()) return;
    await run("hall-send", async () => {
      await request("/messages", { method: "POST", body: JSON.stringify({ channel: community.greatHall?.id, content: hallDraft.trim() }) });
      setHallDraft("");
      await refreshCommunity(false);
      setNotice("Your signed message was added to the Great Hall.");
    });
  }

  async function sendStoryMessage() {
    if (!selectedRoom || !storyDraft.trim()) return;
    await run("story-send", async () => {
      await request("/messages", { method: "POST", body: JSON.stringify({ channel: selectedRoom.channel.id, content: storyDraft.trim() }) });
      setStoryDraft("");
      await loadStoryMessages(selectedRoom);
      setNotice(`Your signed message was added to ${BUZZ_STORY_ROOMS.find((room) => room.id === selectedRoom.roomId)?.label || "the Story Room"}.`);
    });
  }

  async function addMember() {
    if (!memberPubkey.trim()) return;
    await run("member-add", async () => {
      const body = await request<CommunityStatus & { ok: true }>("/community/members", {
        method: "POST",
        body: JSON.stringify({ pubkey: memberPubkey.trim(), role: memberRole }),
      });
      setCommunity(body);
      setMemberPubkey("");
      setNotice("The existing Buzz member was added to the PlotPickle Great Hall.");
    });
  }

  async function removeMember(pubkey: string) {
    await run(`remove-${pubkey}`, async () => {
      const body = await request<CommunityStatus & { ok: true }>("/community/members", {
        method: "DELETE",
        body: JSON.stringify({ pubkey }),
      });
      setCommunity(body);
      setNotice("Great Hall access was removed for that member.");
    });
  }

  function openStoryRoom(roomId: BuzzStoryRoomId) {
    setSelectedRoomId(roomId);
    setSection("story-rooms");
    const room = storyRooms.find((item) => item.roomId === roomId) ?? null;
    void loadStoryMessages(room).catch((error) => setNotice(error instanceof Error ? error.message : "Story Room messages could not be loaded."));
  }

  const connected = Boolean(community?.identityVerified && community.greatHall);
  const readyRoomCount = storyRooms.length;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p>Community</p>
          <h1>The PlotPickle Playhouse gathers here.</h1>
          <span>People, Story Rooms and approved agents share one native PlotPickle workspace. Buzz provides the signed community layer underneath; the writer stays inside PlotPickle for normal collaboration.</span>
        </div>
        <div className={styles.connection} data-ready={connected ? "true" : "false"} role="status">
          <i aria-hidden="true" />
          <div><strong>{connected ? "Community connected" : "Community setup needed"}</strong><small>{community?.message || "Checking Buzz and the PlotPickle Guildhall…"}</small></div>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Community sections" role="tablist">
        {SECTIONS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={section === item.id} title={item.description} className={section === item.id ? styles.activeTab : undefined} onClick={() => setSection(item.id)}>{item.label}</button>)}
      </nav>

      {!community?.identityVerified ? (
        <section className={styles.setupCard}>
          <div><span>Connect once</span><h2>Community uses your locally encrypted Buzz identity.</h2><p>Open basic Settings, connect and verify your Buzz community, then return here. The private identity stays on this computer and is not stored in GitHub or the PPF.</p></div>
          <button type="button" onClick={onOpenSettings}>Open Settings</button>
        </section>
      ) : !guildhall?.operational ? (
        <section className={styles.setupCard}>
          <div><span>One-time Guildhall setup</span><h2>{guildhall ? `${guildhall.readyCount}/${guildhall.totalCount} Guildhall rooms ready` : "Prepare the PlotPickle Guildhall"}</h2><p>PlotPickle creates only the missing private rooms, then verifies that all eleven exist before reporting the community as operational.</p></div>
          <button type="button" disabled={busy === "guildhall" || !guildhall?.canSetup} onClick={() => void setupGuildhall()}>{busy === "guildhall" ? "Building Guildhall…" : "Set up PlotPickle Guildhall"}</button>
        </section>
      ) : null}

      {section === "overview" ? <main className={styles.stack}>
        <section className={styles.summaryGrid}>
          <button type="button" onClick={() => setSection("great-hall")}><span>Great Hall</span><strong>{community?.members.length ?? 0} members</strong><small>{onlineMembers} online now</small></button>
          <button type="button" onClick={() => setSection("story-rooms")}><span>Active story</span><strong>{activeProjectName}</strong><small>{readyRoomCount}/6 Story Rooms ready</small></button>
          <button type="button" onClick={() => setSection("reviews")}><span>Review queue</span><strong>{reviews.length} waiting</strong><small>Nothing changes PPF canon without approval</small></button>
          <button type="button" onClick={() => setSection("guildhall")}><span>Guildhall</span><strong>{guildhall?.readyCount ?? 0}/{guildhall?.totalCount ?? 11} rooms</strong><small>{guildhall?.operational ? "Operational" : "Setup incomplete"}</small></button>
        </section>
        <section className={styles.panel}>
          <header><div><span>Recent community activity</span><h2>What is happening in the Great Hall</h2></div><button type="button" disabled={Boolean(busy)} onClick={() => void refreshCommunity(true)}>Refresh</button></header>
          <div className={styles.activityList}>
            {community?.recentActivity.length ? community.recentActivity.slice(0, 8).map((item) => <article key={item.id}><div><strong>{item.author || "Guild member"}</strong><small>{displayDate(item.createdAt)}</small></div><p>{item.content}</p></article>) : <p className={styles.empty}>No Great Hall messages yet. Open the Great Hall to start the conversation.</p>}
          </div>
        </section>
        <section className={styles.twoColumn}>
          <article className={styles.panel}><span>People</span><h2>{community?.members.length ?? 0} Great Hall members</h2><p>Presence comes from Buzz, but normal member viewing stays inside PlotPickle.</p><button type="button" onClick={() => setSection("people")}>See people</button></article>
          <article className={styles.panel}><span>Agents & Stewards</span><h2>{BUZZ_GUILDHALL_ACTORS.length} lore identities</h2><p>Sage, Avery, Wyrmwood and the Guildhall stewards have named responsibilities rather than appearing as anonymous services.</p><button type="button" onClick={() => setSection("agents")}>Meet the Guildhall</button></article>
        </section>
      </main> : null}

      {section === "great-hall" ? <main className={styles.stack}>
        <section className={styles.sectionHeading}><div><span>The Great Hall</span><h2>One gathering place for people and approved PlotPickle agents.</h2><p>Use this for community-wide discussion and handoffs. Story-specific material belongs in the private Story Rooms.</p></div><button type="button" onClick={() => void refreshCommunity(true)}>Refresh Hall</button></section>
        <section className={styles.conversation}>
          <div className={styles.messageList}>{community?.recentActivity.length ? community.recentActivity.map((item) => <article key={item.id}><header><strong>{item.author || "Guild member"}</strong><small>{displayDate(item.createdAt)}</small></header><p>{item.content}</p></article>) : <p className={styles.empty}>The Great Hall is quiet.</p>}</div>
          <div className={styles.composer}><textarea value={hallDraft} onChange={(event) => setHallDraft(event.target.value)} placeholder="Write to the Great Hall…" rows={4} /><button type="button" disabled={!connected || !hallDraft.trim() || Boolean(busy)} onClick={() => void sendHallMessage()}>{busy === "hall-send" ? "Sending…" : "Send signed message"}</button></div>
        </section>
      </main> : null}

      {section === "story-rooms" ? <main className={styles.stack}>
        <section className={styles.sectionHeading}><div><span>Story Rooms</span><h2>{project ? `Private rooms for ${project.title}` : "Open a story to create its rooms"}</h2><p>Story, Characters, Structure, Continuity, Visual Development and Production Notes stay separate from community-wide discussion.</p></div><button type="button" disabled={!community?.identityVerified || !project || Boolean(busy)} onClick={() => void ensureStoryRooms()}>{busy === "story-rooms" ? "Creating…" : storyRooms.length === 6 ? "Story Rooms ready" : "Create missing Story Rooms"}</button></section>
        <div className={styles.roomGrid}>{BUZZ_STORY_ROOMS.map((definition) => {
          const ready = storyRooms.some((room) => room.roomId === definition.id);
          return <button key={definition.id} type="button" disabled={!ready} data-ready={ready ? "true" : "false"} onClick={() => openStoryRoom(definition.id)}><span>{definition.label}</span><strong>{ready ? "Ready" : "Not created"}</strong><small>{definition.description}</small></button>;
        })}</div>
        {selectedRoom ? <section className={styles.conversation}>
          <header className={styles.roomConversationHeader}><div><span>Active room</span><h3>{BUZZ_STORY_ROOMS.find((room) => room.id === selectedRoom.roomId)?.label}</h3></div><button type="button" onClick={() => void loadStoryMessages(selectedRoom)}>Load messages</button></header>
          <div className={styles.messageList}>{storyMessages.length ? storyMessages.map((message) => <article key={message.id}><header><strong>{message.author || "Story Room member"}</strong><small>{displayDate(message.createdAt)}</small></header><p>{message.content}</p></article>) : <p className={styles.empty}>Load this room to see its signed conversation.</p>}</div>
          <div className={styles.composer}><textarea value={storyDraft} onChange={(event) => setStoryDraft(event.target.value)} placeholder="Discuss this story without changing canon…" rows={4} /><button type="button" disabled={!storyDraft.trim() || Boolean(busy)} onClick={() => void sendStoryMessage()}>{busy === "story-send" ? "Sending…" : "Send to Story Room"}</button></div>
        </section> : null}
      </main> : null}

      {section === "people" ? <main className={styles.stack}>
        <section className={styles.sectionHeading}><div><span>People</span><h2>Great Hall members and presence</h2><p>PlotPickle can read Great Hall membership and online/away/offline presence natively. Full community-wide invitation issuance is not exposed by the current Buzz CLI, so that owner-only step remains in Buzz Desktop for now.</p></div></section>
        <section className={styles.memberGrid}>{community?.members.length ? community.members.map((member) => <article key={member.pubkey}><header><div><i data-presence={member.presence} aria-hidden="true" /><strong>{member.displayName}</strong></div><span>{member.presence || "offline"}</span></header><small>{member.pubkey.slice(0, 12)}…{member.pubkey.slice(-8)}</small><button type="button" disabled={Boolean(busy)} onClick={() => void removeMember(member.pubkey)}>Remove from Great Hall</button></article>) : <p className={styles.empty}>No Great Hall members were returned yet.</p>}</section>
        <section className={styles.accessCard}><div><span>Add existing Buzz member</span><h3>Grant Great Hall access</h3><p>Paste the 64-character public key of someone who already belongs to your Buzz community, then choose their Great Hall role.</p></div><div className={styles.accessControls}><input value={memberPubkey} onChange={(event) => setMemberPubkey(event.target.value)} placeholder="64-character Buzz public key" /><select value={memberRole} onChange={(event) => setMemberRole(event.target.value)}><option value="member">Member</option><option value="guest">Guest</option><option value="admin">Admin</option><option value="bot">Bot</option></select><button type="button" disabled={!community?.canManageGreatHall || !memberPubkey.trim() || Boolean(busy)} onClick={() => void addMember()}>Add to Great Hall</button></div></section>
        <section className={styles.boundaryCard}><div><span>Invite a new person</span><h3>Buzz still owns new-community invitations.</h3><p>This is the one community-owner task PlotPickle does not fake. Until Buzz exposes invitation issuance through its supported CLI/API, use Buzz Desktop for the initial invite; after they join, PlotPickle can manage their Great Hall access here.</p></div>{desktopUrl ? <a href={desktopUrl}>Open community in Buzz Desktop</a> : <button type="button" onClick={onOpenSettings}>Finish Buzz setup</button>}</section>
      </main> : null}

      {section === "agents" ? <main className={styles.stack}>
        <section className={styles.sectionHeading}><div><span>Agents & Stewards</span><h2>The Guildhall has names, jobs and boundaries.</h2><p>Mastra agents stay PlotPickle agents. Deterministic observers remain evidence-driven services. Orin and Fen are the only optional Buzz-native stewards and still require owner review in Buzz Desktop.</p></div></section>
        <section className={styles.agentGrid}>{BUZZ_GUILDHALL_ACTORS.map((actor) => <article key={actor.id}><header><div><strong>{actor.displayName}</strong><span>{actor.title}</span></div><small>{actor.buzzPresence === "native-draft" ? "Owner review" : actor.buzzPresence === "mirrored" ? "PlotPickle agent" : "Service"}</small></header><p>{actor.summary}</p><footer><span>{actor.runtime}</span><span>{BUZZ_GUILDHALL_CHANNELS.find((room) => room.id === actor.primaryChannel)?.label || actor.primaryChannel}</span></footer></article>)}</section>
      </main> : null}

      {section === "reviews" ? <main className={styles.stack}>
        <section className={styles.sectionHeading}><div><span>Review Queue</span><h2>Community discussion never becomes canon by itself.</h2><p>Selected discussion can become a proposal, but the writer must explicitly approve a change before the PPF is updated.</p></div></section>
        <section className={styles.reviewList}>{reviews.length ? reviews.map((review) => <article key={review.id}><div><strong>{review.title}</strong><small>{review.roomId ? `From ${review.roomId}` : "Community proposal"} · {displayDate(review.createdAt)}</small></div><span>Awaiting human review</span></article>) : <p className={styles.empty}>Nothing is waiting for review. This is a good state: there are no community suggestions asking to change story canon.</p>}</section>
        <section className={styles.boundaryCard}><div><span>Authority boundary</span><h3>PPF remains the creative record.</h3><p>Community messages, agent observations and Guildhall activity are discussion and evidence. They can suggest; they cannot silently rewrite the writer's accepted story.</p></div></section>
      </main> : null}

      {section === "guildhall" ? <main className={styles.stack}>
        <section className={styles.sectionHeading}><div><span>Guildhall</span><h2>Coordination underneath the Playhouse</h2><p>The Great Hall is visible to the community. The remaining rooms organize curriculum, Wyrmwood, continuity, visual review, UAT, repairs, GitHub status and durable history without cluttering the writer's normal workspace.</p></div><button type="button" disabled={!guildhall?.canSetup || guildhall?.operational || Boolean(busy)} onClick={() => void setupGuildhall()}>{guildhall?.operational ? "Guildhall operational" : "Create missing rooms"}</button></section>
        <section className={styles.guildGrid}>{BUZZ_GUILDHALL_CHANNELS.map((definition) => {
          const ready = guildhall?.readyRooms.some((room) => room.id === definition.id) ?? false;
          return <article key={definition.id} data-ready={ready ? "true" : "false"}><header><strong>{definition.label}</strong><span>{ready ? "Ready" : "Missing"}</span></header><p>{definition.description}</p><small>{definition.id === "great-hall" ? "Community-facing gathering room" : "Internal coordination room"}</small></article>;
        })}</section>
      </main> : null}

      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    </div>
  );
}
