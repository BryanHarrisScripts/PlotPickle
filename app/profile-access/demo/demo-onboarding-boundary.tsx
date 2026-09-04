"use client";

import { ReactNode, useEffect, useState } from "react";
import DemoExperience from "./demo-experience";
import styles from "./demo-onboarding-boundary.module.css";

type ProfileStatusProbe = {
  readonly configured: boolean;
  readonly authenticated: boolean;
  readonly accessMode: "desktop-loopback" | "server-network";
  readonly csrfToken?: string | null;
  readonly autonomousGuest?: { readonly active?: boolean } | null;
};

type EntryMode = "probing" | "first-run" | "normal" | "demo";
type HandoffState = "idle" | "waiting" | "creating" | "error";
type PendingHandoff = {
  readonly handoffId: string;
  readonly decisionIds: ReadonlyArray<string>;
};

function isFreshDesktop(status: ProfileStatusProbe) {
  return status.accessMode === "desktop-loopback"
    && !status.configured
    && !status.authenticated
    && !status.autonomousGuest?.active;
}

function canOfferReturningDemo(status: ProfileStatusProbe | null) {
  return status?.accessMode === "desktop-loopback"
    && status.configured
    && !status.authenticated
    && !status.autonomousGuest?.active;
}

export default function DemoOnboardingBoundary({ children }: { readonly children: ReactNode }) {
  const [status, setStatus] = useState<ProfileStatusProbe | null>(null);
  const [mode, setMode] = useState<EntryMode>("probing");
  const [returningDemoVisible, setReturningDemoVisible] = useState(false);
  const [pendingHandoff, setPendingHandoff] = useState<PendingHandoff | null>(null);
  const [handoffState, setHandoffState] = useState<HandoffState>("idle");
  const [handoffError, setHandoffError] = useState("");
  const [handoffRetry, setHandoffRetry] = useState(0);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" })
      .then(async (result) => {
        if (!result.ok) throw new Error("Profile status unavailable");
        return result.json() as Promise<ProfileStatusProbe>;
      })
      .then((next) => {
        if (!active) return;
        setStatus(next);
        setReturningDemoVisible(canOfferReturningDemo(next));
        setMode(isFreshDesktop(next) ? "first-run" : "normal");
      })
      .catch(() => {
        if (active) setMode("normal");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mode !== "normal" || !returningDemoVisible || !canOfferReturningDemo(status)) return;
    const dismissAfterProfileInteraction = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-profile-access-boundary="locked"] button, [data-profile-access-boundary="locked"] a, [data-profile-access-boundary="locked"] input, [data-profile-access-boundary="locked"] textarea')) {
        setReturningDemoVisible(false);
      }
    };
    window.addEventListener("click", dismissAfterProfileInteraction, true);
    return () => window.removeEventListener("click", dismissAfterProfileInteraction, true);
  }, [mode, returningDemoVisible, status]);

  useEffect(() => {
    if (!pendingHandoff || mode !== "normal") return;
    let active = true;
    let creating = false;

    const attemptHandoff = async () => {
      if (!active || creating) return;
      try {
        const statusResult = await fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" });
        const next = await statusResult.json() as ProfileStatusProbe;
        if (!statusResult.ok) throw new Error("The local profile service is unavailable.");
        if (!active) return;
        setStatus(next);
        if (!next.authenticated || !next.csrfToken) {
          setHandoffState("waiting");
          return;
        }

        creating = true;
        setHandoffState("creating");
        setHandoffError("");
        const result = await fetch("/api/demo/handoff", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "X-PlotPickle-CSRF": next.csrfToken,
          },
          body: JSON.stringify({
            action: "make-this-mine",
            approved: true,
            handoffId: pendingHandoff.handoffId,
            decisionIds: pendingHandoff.decisionIds,
          }),
        });
        const payload = await result.json().catch(() => ({})) as { readonly message?: string };
        if (!result.ok) throw new Error(payload.message || "PlotPickle could not create your new story project.");
        if (!active) return;
        active = false;
        setPendingHandoff(null);
        setHandoffState("idle");
        window.location.assign("/?workspace=dashboard");
      } catch (cause) {
        if (!active) return;
        active = false;
        setHandoffState("error");
        setHandoffError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        creating = false;
      }
    };

    void attemptHandoff();
    const poll = window.setInterval(() => void attemptHandoff(), 1_500);
    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, [pendingHandoff, mode, handoffRetry]);

  function makeThisMine(decisionIds: ReadonlyArray<string>) {
    if (decisionIds.length !== 5) return;
    setPendingHandoff({ handoffId: globalThis.crypto.randomUUID(), decisionIds: [...decisionIds] });
    setHandoffState("waiting");
    setHandoffError("");
    setReturningDemoVisible(false);
    setMode("normal");
  }

  function cancelHandoff() {
    setPendingHandoff(null);
    setHandoffState("idle");
    setHandoffError("");
  }

  if (mode === "probing") {
    return (
      <main className={styles.entry} data-demo-onboarding="probing">
        <section className={styles.card} aria-busy="true">
          <p className={styles.eyebrow}>PlotPickle</p>
          <h1>Opening the local entry…</h1>
          <p>Checking this PlotPickle Node before showing the correct local entry path.</p>
        </section>
      </main>
    );
  }

  if (mode === "demo") {
    return (
      <DemoExperience
        onExit={() => setMode(status && isFreshDesktop(status) ? "first-run" : "normal")}
        onEnterPlotPickle={() => setMode("normal")}
        onMakeThisMine={makeThisMine}
      />
    );
  }

  if (mode === "first-run") {
    return (
      <main className={styles.entry} data-demo-onboarding="fresh-desktop">
        <section className={styles.card}>
          <p className={styles.eyebrow}>Welcome to PlotPickle</p>
          <h1>See it work, or make it yours.</h1>
          <p>You can try a small disposable STORY world before creating a private local profile. DEMO needs no account, provider key, BUZZ identity, GitHub, Google, or Internet connection.</p>
          <div className={styles.choices}>
            <button type="button" data-demo-entry-action="demo" onClick={() => setMode("demo")}>
              <strong>DEMO — See PlotPickle work</strong>
              <span>Play five prepared story decisions, see consequences change, then reset or leave with nothing private retained.</span>
            </button>
            <button type="button" data-demo-entry-action="enter-plotpickle" onClick={() => setMode("normal")}>
              <strong>ENTER PLOTPICKLE — Create your local profile</strong>
              <span>Continue into the existing encrypted Human profile setup. No cloud account is required.</span>
            </button>
          </div>
          <small>DEMO is separate from Guest and cannot read Human profiles, credentials, private projects, BUZZ identity, connectors, or real canon.</small>
        </section>
      </main>
    );
  }

  return (
    <>
      {children}
      {pendingHandoff ? (
        <aside className={styles.handoffNotice} data-demo-handoff="pending" data-demo-handoff-state={handoffState} aria-live="polite">
          <strong>{handoffState === "creating" ? "Creating your Human story project…" : "Make This Mine is ready"}</strong>
          <span>{handoffError || "Create or unlock your normal PlotPickle Human profile. Your approved starter story will be created automatically after authentication."}</span>
          {handoffState !== "creating" ? (
            <div>
              {handoffState === "error" ? <button type="button" data-demo-handoff-action="retry" onClick={() => { setHandoffError(""); setHandoffState("waiting"); setHandoffRetry((value) => value + 1); }}>Retry</button> : null}
              <button type="button" data-demo-handoff-action="cancel" onClick={cancelHandoff}>Cancel</button>
            </div>
          ) : null}
        </aside>
      ) : null}
      {!pendingHandoff && returningDemoVisible && canOfferReturningDemo(status) ? (
        <button type="button" className={styles.demoShortcut} data-demo-entry-action="demo-returning" onClick={() => setMode("demo")}>
          Try DEMO
        </button>
      ) : null}
    </>
  );
}
