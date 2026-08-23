"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./community-story-room-access.module.css";

type CommunityMember = { pubkey: string; displayName: string; presence: string; updatedAt: string };
type BuzzChannel = { id: string; name: string; description: string };
type AccessPayload = { ok: boolean; channel: BuzzChannel; members: CommunityMember[]; message: string };

type Props = {
  readonly channel: BuzzChannel;
  readonly greatHallMembers: readonly CommunityMember[];
  readonly desktopUrl: string;
};

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json() as AccessPayload & { message?: string };
  if (!response.ok) throw new Error(body.message || `BUZZ returned ${response.status}.`);
  return body;
}

export default function CommunityStoryRoomAccess({ channel, greatHallMembers, desktopUrl }: Props) {
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [selectedPubkey, setSelectedPubkey] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const available = useMemo(() => greatHallMembers.filter((member) => !members.some((roomMember) => roomMember.pubkey === member.pubkey)), [greatHallMembers, members]);

  async function refresh(showNotice = false) {
    const body = await request(`/api/local-buzz/story-room-access?channel=${encodeURIComponent(channel.id)}`);
    setMembers(body.members);
    if (showNotice) setNotice(body.message);
    if (!selectedPubkey && body.members.length >= 0) {
      const next = greatHallMembers.find((member) => !body.members.some((roomMember) => roomMember.pubkey === member.pubkey));
      if (next) setSelectedPubkey(next.pubkey);
    }
  }

  useEffect(() => {
    setMembers([]);
    setSelectedPubkey("");
    setNotice("");
    void refresh(false).catch((error) => setNotice(error instanceof Error ? error.message : "Story Room access could not be loaded."));
  }, [channel.id]);

  async function addMember() {
    if (!selectedPubkey) return;
    setBusy("add");
    setNotice("");
    try {
      const body = await request("/api/local-buzz/story-room-access", {
        method: "POST",
        body: JSON.stringify({ channel: channel.id, pubkey: selectedPubkey, role }),
      });
      setMembers(body.members);
      const next = greatHallMembers.find((member) => !body.members.some((roomMember) => roomMember.pubkey === member.pubkey));
      setSelectedPubkey(next?.pubkey || "");
      setNotice("Access granted. That member can now see and comment in this same private Story Room from Buzz Desktop or PlotPickle.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Story Room access could not be granted.");
    } finally { setBusy(""); }
  }

  async function removeMember(pubkey: string) {
    setBusy(pubkey);
    setNotice("");
    try {
      const body = await request("/api/local-buzz/story-room-access", {
        method: "DELETE",
        body: JSON.stringify({ channel: channel.id, pubkey }),
      });
      setMembers(body.members);
      if (!selectedPubkey) setSelectedPubkey(pubkey);
      setNotice("Story Room access removed. The private channel is no longer shared with that member.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Story Room access could not be removed.");
    } finally { setBusy(""); }
  }

  return <section className={styles.card} aria-label="Story Room access">
    <header>
      <div>
        <span>Buzz access</span>
        <h3>One room, two interfaces.</h3>
        <p>This is a real private BUZZ channel. Anyone you grant access to here sees the same conversation in Buzz Desktop and PlotPickle; messages posted from either side stay in this one room.</p>
      </div>
      <button type="button" disabled={Boolean(busy)} onClick={() => void refresh(true)}>Refresh access</button>
    </header>

    <div className={styles.memberList}>
      {members.length ? members.map((member) => <article key={member.pubkey}>
        <div><i data-presence={member.presence || "offline"} aria-hidden="true" /><span><strong>{member.displayName}</strong><small>{member.pubkey.slice(0, 10)}…{member.pubkey.slice(-6)}</small></span></div>
        <button type="button" disabled={Boolean(busy)} onClick={() => void removeMember(member.pubkey)}>{busy === member.pubkey ? "Removing…" : "Remove"}</button>
      </article>) : <p>No additional Story Room members were returned yet. The room owner can still use the channel.</p>}
    </div>

    <div className={styles.controls}>
      <label><span>Share with an existing Great Hall member</span><select value={selectedPubkey} onChange={(event) => setSelectedPubkey(event.target.value)} disabled={!available.length}><option value="">{available.length ? "Choose member" : "Everyone in the Great Hall already has access"}</option>{available.map((member) => <option key={member.pubkey} value={member.pubkey}>{member.displayName}</option>)}</select></label>
      <label><span>Room role</span><select value={role} onChange={(event) => setRole(event.target.value)}><option value="member">Member</option><option value="guest">Guest</option><option value="admin">Admin</option><option value="bot">Bot</option></select></label>
      <button type="button" disabled={!selectedPubkey || Boolean(busy)} onClick={() => void addMember()}>{busy === "add" ? "Granting…" : "Grant Story Room access"}</button>
      {desktopUrl ? <a href={desktopUrl}>Open the community in Buzz Desktop</a> : null}
    </div>

    <p className={styles.note}>BUZZ enforces the actual channel permissions. If your connected identity is not an owner/admin for this room, BUZZ will refuse the membership change rather than PlotPickle pretending it succeeded.</p>
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
  </section>;
}
