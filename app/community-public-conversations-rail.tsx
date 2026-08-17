"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./community-public-conversations-rail.module.css";

const COMMUNITY_STATUS_API = "/api/local-buzz/community/status";

type PublicConversation = {
  id: string;
  content: string;
  author: string;
  createdAt: string;
};

type CommunityStatusResponse = {
  identityVerified: boolean;
  recentActivity: PublicConversation[];
};

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleString();
}

function summary(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? `${normalized.slice(0, 117)}…` : normalized;
}

function findCommunityHeader() {
  return document.querySelector<HTMLElement>(
    '[data-active-workspace="community"] [data-workspace-frame="true"] > :first-child > header',
  );
}

function openGreatHall() {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Community sections"] button'),
  );
  const greatHall = buttons.find((button) => button.textContent?.trim() === "Great Hall");
  if (!greatHall) return;
  greatHall.click();
  window.setTimeout(() => {
    const composer = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Write to the Great Hall…"]');
    const conversation = composer?.closest("section");
    conversation?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 80);
}

export default function CommunityPublicConversationsRail() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [conversations, setConversations] = useState<PublicConversation[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    setHost(findCommunityHeader());
  }, []);

  async function refresh() {
    setStatus("loading");
    try {
      const response = await fetch(COMMUNITY_STATUS_API, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const body = await response.json() as CommunityStatusResponse & { message?: string };
      if (!response.ok) throw new Error(body.message || "Community conversations could not be loaded.");
      const recent = Array.isArray(body.recentActivity) ? body.recentActivity.slice(0, 5) : [];
      setConversations(recent);
      setStatus(body.identityVerified && recent.length ? "ready" : "empty");
    } catch {
      setConversations([]);
      setStatus("error");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (!host) return null;

  return createPortal(
    <aside aria-label="Recent public conversations" className={styles.rail} data-community-public-rail="true">
      <header className={styles.header}>
        <div>
          <p>Public conversations</p>
          <h2>Jump back into the Great Hall</h2>
        </div>
        <button disabled={status === "loading"} onClick={() => void refresh()} type="button">
          {status === "loading" ? "Loading…" : "Refresh"}
        </button>
      </header>

      <p className={styles.explainer}>
        The Great Hall is PlotPickle's public conversation surface. Private Story Rooms and Guildhall rooms stay out of this list.
      </p>

      <div className={styles.list}>
        {status === "ready" ? conversations.map((conversation) => (
          <button
            aria-label={`Open public conversation from ${conversation.author || "Guild member"}`}
            className={styles.conversation}
            key={conversation.id}
            onClick={openGreatHall}
            type="button"
          >
            <span className={styles.meta}>
              <strong>{conversation.author || "Guild member"}</strong>
              <small>{displayDate(conversation.createdAt)}</small>
            </span>
            <span className={styles.snippet}>{summary(conversation.content)}</span>
            <span className={styles.jump}>Open conversation →</span>
          </button>
        )) : null}

        {status === "empty" ? (
          <p className={styles.empty}>No public Great Hall conversations yet.</p>
        ) : null}
        {status === "error" ? (
          <p className={styles.empty}>Recent public conversations are temporarily unavailable.</p>
        ) : null}
      </div>

      <button className={styles.viewAll} onClick={openGreatHall} type="button">
        View all Great Hall conversations
      </button>
    </aside>,
    host,
  );
}
