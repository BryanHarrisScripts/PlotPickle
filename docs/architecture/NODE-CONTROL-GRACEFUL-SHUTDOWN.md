# PlotPickle Node Control and Graceful Shutdown

Status: implementation contract for the top-left Node control and local shutdown lifecycle.

Related architecture:
- `docs/architecture/PLOTPICKLE-NODE-TOPOLOGY.md`
- `docs/architecture/MANAGED-DESKTOP-HARNESS.md`

## Product intent

The permanent top-left PlotPickle crest represents the local PlotPickle Node: the physical installation/device running PlotPickle. The far-right Profile control continues to represent the active Human.

The user-facing mental model is:

```text
Top left  = PlotPickle Node
Top right = Human Profile
```

The crest must use approximately the same visual size and navigation footprint as the other primary navigation icons. Its artwork may remain distinctive, but it must not occupy a large blank block in the header.

Under the crest, show a short presentation form of the Node ID, for example:

```text
[CREST]
 Node
PP-7F42
```

The short ID is display-only. The full durable `node_id` and Node signing identity remain the security/provenance identifiers.

## Node panel

Clicking the crest opens a compact Node panel. A single click must not immediately terminate PlotPickle.

The panel should show, where available:

- full Node ID;
- Node lifecycle state;
- active Human profile;
- current project;
- save state such as Saved or Unsaved changes;
- a concise local readiness/capability summary when useful;
- `Shut Down PlotPickle` as the intentional destructive action.

Profile/account management does not belong in this panel.

## Graceful shutdown contract

`Shut Down PlotPickle` means safely saving and closing PlotPickle and its own local runtime. It does not mean shutting down or rebooting Windows.

The runtime supervisor owns shutdown lifecycle truth. UI components request shutdown; they do not directly kill arbitrary processes.

Target sequence:

```text
Human chooses Shut Down PlotPickle
        ↓
Confirm intent
        ↓
Inspect current project/session save state
        ↓
Persist safe autosave / PPF state
        ↓
Confirm persistence succeeded
        ↓
Close and release Human-scoped session state
        ↓
Detach Human BUZZ session
        ↓
Stop PlotPickle-owned managed services/process tree
        ↓
Terminate the PlotPickle launcher/CMD runtime
        ↓
Close the PlotPickle-owned browser window
        ↓
Node stopped
```

Shutdown is a lifecycle operation only. PPF/canonical story-state authority remains unchanged.

## Save behavior

Normal shutdown should autosave wherever the existing PlotPickle save contract considers that safe.

Known unsaved creative state must never be discarded silently.

Expected behavior:

- If everything is already saved, continue directly after confirmation.
- If unsaved work can safely be autosaved, show `Saving your work…`, confirm persistence, then continue shutdown.
- If PlotPickle cannot safely persist all known changes, shutdown must stop and show the actual failure. The Human may retry or cancel.
- A save failure must not be converted into a forced successful shutdown.

If a save requires explicit Human action rather than safe autosave, provide a clear `Save and Shut Down` / `Cancel` choice.

## Confirmation copy

Primary confirmation:

**Shut down this PlotPickle Node?**

Supporting copy:

`PlotPickle will save your work, close the current session, stop local services, and close this PlotPickle window.`

Actions:

- `Cancel`
- `Shut Down PlotPickle`

Avoid a second confirmation unless there is a real save or lifecycle problem.

## Browser and launcher ownership

A successful shutdown should leave no normal PlotPickle launcher/CMD process behind.

The startup/launcher lifecycle must participate in shutdown so PlotPickle can cleanly stop:

- application runtime/server;
- PlotPickle-managed agents and local helper services;
- PlotPickle-owned child processes;
- the launcher/CMD window itself.

Browser shutdown must be scoped to the PlotPickle-owned window or browser instance opened by the launcher. PlotPickle must never kill the user's entire browser or unrelated tabs/windows.

Because ordinary browser scripts cannot reliably close arbitrary windows they did not open, the launcher/shell should retain lifecycle ownership of the PlotPickle browser window it starts, or expose an equivalent shell-owned close contract.

## Human/session cleanup

Before Node services terminate, graceful shutdown should, where applicable:

- close current project handles;
- persist safe project/PPF state;
- release active profile/vault access;
- clear active agent context;
- clear retrieval/search context;
- detach the active BUZZ Human session;
- clear transient credentials/session material where appropriate;
- invalidate the current local Human session.

Ordinary shutdown must not delete Human profiles, projects, Node identity, Node signing keys or installation configuration.

## Node identity invariants

One PlotPickle installation/device owns one durable Node identity. Multiple Human profiles on the same installation continue to share that Node identity while retaining separate private workspaces and BUZZ identities.

Restarting or normally shutting down PlotPickle must not rotate `node_id`.

Example:

```text
Node PP-7F42
├── Human A
├── Human B
└── Human C
```

The navigation may display `PP-7F42`, but security and provenance continue to use the full durable Node identity.

## Lifecycle states

The Node control should expose at least these states:

- `RUNNING` — normal interaction;
- `SAVING` — shutdown requested and persistence is in progress;
- `SHUTTING DOWN` — save/session cleanup succeeded and runtime teardown is in progress;
- `SHUTDOWN BLOCKED` — a save, cleanup or lifecycle dependency failed;
- `STOPPED` — no local PlotPickle runtime is active.

Repeated shutdown requests must be disabled once a shutdown sequence has begun.

## Non-goals

This contract does not add:

- remote Node shutdown;
- peer-compute control;
- Windows shutdown/reboot;
- account deletion;
- profile switching;
- BUZZ administration.

## Acceptance criteria

1. The top-left crest matches the approximate navigation footprint of the other primary navigation icons.
2. A short Node ID such as `PP-7F42` appears beneath the crest.
3. Clicking the crest opens a Node panel rather than immediately shutting down.
4. The Node panel exposes the full Node ID and current lifecycle/save context.
5. The far-right Profile control remains the separate Human identity control.
6. `Shut Down PlotPickle` requires intentional confirmation.
7. Already-saved work shuts down without unnecessary extra prompts.
8. Unsaved work is safely autosaved when the current save contract permits it.
9. A failed save blocks shutdown instead of silently discarding work.
10. The active Human/profile session is safely released before runtime teardown.
11. PlotPickle-owned local services and child processes stop cleanly.
12. The PlotPickle launcher/CMD runtime exits.
13. The PlotPickle-owned browser window closes.
14. Unrelated browser tabs/windows and unrelated processes are never terminated.
15. Multiple Human profiles on one installation continue to use one Node ID.
16. Restarting PlotPickle preserves the existing Node ID.
17. Normal shutdown never rotates Node identity.
18. Existing LEARN, PLAN, BUILD, Library and BUZZ behavior remains unchanged.
19. Add lifecycle regression coverage for save → session cleanup → managed service stop → launcher/browser close contract.
20. BEN, Startup/UAT, profile/privacy, Node topology and production build gates must be green on the exact implementation head before merge.
