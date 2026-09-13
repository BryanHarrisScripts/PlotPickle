"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authenticatedProfileFetch } from "../../../core/auth/profile-request-browser";
import {
  PROJECT_LIBRARY_CHANGED_EVENT,
  listLibraryProjects,
  type ProjectLibrarySummary,
} from "../../../core/storage/project-library-browser";
import { BUZZ_STORY_ROOMS, type BuzzStoryRoomId } from "../../../lib/buzz/buzz-story-room";
import { buzzLegacyStoryRoomName, buzzStoryRoomDisplayName } from "../../../lib/buzz/story-room-identity";
import CommunityStoryRoomAccess from "./community-story-room-access";
import styles from "./community-workspace.module.css";

const BUZZ_API = "/api/local-buzz";
const PRIVATE_STORY_ROOM_ID: BuzzStoryRoomId = "story";

type BuzzChannel = { id: string; name: string; description: string };
type CommunityMember = { pubkey: string; displayName: string; presence: string; updatedAt: string };
type StoryIdentity = Pick<ProjectLibrarySummary, "id" | "title">;
type StoryRoomRecord = {
  roomId: BuzzStoryRoomId;
  displayName: string;
  channel: BuzzChannel;
  listingId: string;
  created?: boolean;
  mappedFromLegacy?: boolean;
};

type Props = {
  readonly identityVerified: boolean;
  readonly greatHallMembers: readonly CommunityMember[];
  readonly desktopUrl: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedProfileFetch(`${BUZZ_API}${path}`, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || `BUZZ returned ${response.status}.`);
  return body;
}

function storyRoomIdentityBody(story: StoryIdentity, createMissing: boolean) {
  return {
    projectId: story.id,
    createMissing,
    rooms: BUZZ_STORY_ROOMS.map((room) => ({
      id: room.id,
      legacyName: buzzLegacyStoryRoomName(story, room.id),
      displayName: buzzStoryRoomDisplayName(story, room.id),
      description: `${story.title} · ${room.description}`,
    })),
  };
}

function privateRoom(rooms: readonly StoryRoomRecord[] | undefined) {
  return rooms?.find((room) => room.roomId === PRIVATE_STORY_ROOM_ID) ?? null;
}

export default function CommunityPrivateStoryRoom({ identityVerified, greatHallMembers, desktopUrl }: Props) {
  const [stories, setStories] = useState<readonly ProjectLibrarySummary[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState("");
  const [roomsByStory, setRoomsByStory] = useState<Record<string, readonly StoryRoomRecord[]>>({});
  const [roomErrors, setRoomErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const selectedStory = useMemo(
    () => stories.find((story) => story.id === selectedStoryId) ?? stories[0] ?? null,
    [selectedStoryId, stories],
  );
  const selectedPrivateRoom = privateRoom(selectedStory ? roomsByStory[selectedStory.id] : undefined);

  const refreshLibrary = useCallback(async () => {
    const nextStories = listLibraryProjects().filter((story) => !story.archivedAt);
    setStories(nextStories);
    setSelectedStoryId((current) => nextStories.some((story) => story.id === current) ? current : nextStories[0]?.id ?? "");

    if (!identityVerified || !nextStories.length) {
      setRoomsByStory({});
      setRoomErrors({});
      return;
    }

    const results = await Promise.all(nextStories.map(async (story) => {
      try {
        const body = await request<{ rooms: StoryRoomRecord[] }>("/story-room-identity", {
          method: "POST",
          body: JSON.stringify(storyRoomIdentityBody(story, false)),
        });
        return { storyId: story.id, rooms: Array.isArray(body.rooms) ? body.rooms : [], error: "" };
      } catch (error) {
        return { storyId: story.id, rooms: [] as StoryRoomRecord[], error: error instanceof Error ? error.message : "Room status unavailable." };
      }
    }));

    setRoomsByStory(Object.fromEntries(results.map((result) => [result.storyId, result.rooms])));
    setRoomErrors(Object.fromEntries(results.filter((result) => result.error).map((result) => [result.storyId, result.error])));
  }, [identityVerified]);

  useEffect(() => {
    void refreshLibrary();
    const handleLibraryChange = () => { void refreshLibrary(); };
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, handleLibraryChange);
    return () => window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, handleLibraryChange);
  }, [refreshLibrary]);

  async function ensureStoryRoom() {
    if (!selectedStory || !identityVerified) return;
    setBusy(selectedStory.id);
    setNotice("");
    try {
      const body = await request<{ rooms: StoryRoomRecord[]; message: string }>("/story-room-identity", {
        method: "POST",
        body: JSON.stringify(storyRoomIdentityBody(selectedStory, true)),
      });
      const rooms = Array.isArray(body.rooms) ? body.rooms : [];
      setRoomsByStory((current) => ({ ...current, [selectedStory.id]: rooms }));
      setRoomErrors((current) => {
        const next = { ...current };
        delete next[selectedStory.id];
        return next;
      });
      setNotice(body.message || `Private Story Room is ready for ${selectedStory.title}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Private Story Room could not be prepared.");
    } finally {
      setBusy("");
    }
  }

  if (!stories.length) {
    return <main className={styles.stack} data-private-story-room-story-first="true">
      <section className={styles.sectionHeading}>
        <div><span>Private Story Room</span><h2>No stories in My Stories yet.</h2><p>Create or import a story in PlotPickle first. Private Story Rooms are created only for stories that exist in your Project Library.</p></div>
      </section>
    </main>;
  }

  return <main className={styles.stack} data-private-story-room-story-first="true">
    <section className={styles.sectionHeading}>
      <div><span>Private Story Room</span><h2>Choose a story from My Stories.</h2><p>Each Private Story Room belongs to one real story in your Project Library. Selecting a story never changes which story is active in your writing workspace.</p></div>
    </section>

    <section className={styles.summaryGrid} aria-label="My Stories for Private Story Room">
      {stories.map((story) => {
        const room = privateRoom(roomsByStory[story.id]);
        const error = roomErrors[story.id];
        const selected = selectedStory?.id === story.id;
        return <button
          type="button"
          key={story.id}
          aria-current={selected ? "true" : undefined}
          data-private-story-room-story={story.id}
          data-private-story-room-state={error ? "unavailable" : room ? "ready" : "not-created"}
          onClick={() => { setSelectedStoryId(story.id); setNotice(""); }}
        >
          <span>{error ? "ROOM STATUS UNAVAILABLE" : room ? "ROOM READY" : "NO ROOM YET"}</span>
          <strong>{story.title}</strong>
          <small>{story.format || "Story"}{story.genre ? ` · ${story.genre}` : ""}</small>
        </button>;
      })}
    </section>

    {selectedStory ? selectedPrivateRoom ? <>
      <section className={styles.sectionHeading} data-private-story-room-selected="ready">
        <div><span>Room</span><h2>{selectedStory.title}</h2><p>This story already has a Private Story Room. Visibility, people and access requests are managed below after the room exists.</p></div>
      </section>
      <CommunityStoryRoomAccess channel={selectedPrivateRoom.channel} greatHallMembers={greatHallMembers} desktopUrl={desktopUrl} />
    </> : <section className={styles.sectionHeading} data-private-story-room-selected="not-created">
      <div><span>Create Private Story Room</span><h2>{selectedStory.title}</h2><p>Create one private BUZZ space for this story. Listing, member and request administration appear only after the room exists.</p></div>
      <button type="button" disabled={!identityVerified || busy === selectedStory.id} onClick={() => void ensureStoryRoom()}>{busy === selectedStory.id ? "Creating…" : "Create Private Story Room"}</button>
    </section> : null}

    {selectedStory && roomErrors[selectedStory.id] ? <p className={styles.empty} role="status">{roomErrors[selectedStory.id]}</p> : null}
    {notice ? <p className={styles.empty} role="status">{notice}</p> : null}
  </main>;
}
