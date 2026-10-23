# Developer brief — PlotPickle Collaborative Workspace, Human + AI
**Decision date:** 2026-10-23  
**Status:** joint product-direction lock; **visual implementation deferred** until bidirectional gateway round-trip and Factory disk safety are independently verified.  
**Tracker:** [#3263](https://github.com/BryanHarrisScripts/PlotPickle/issues/3263)  
**Dependencies:** [#3259](https://github.com/BryanHarrisScripts/PlotPickle/issues/3259) (bidirectional AI gateway), [#3241](https://github.com/BryanHarrisScripts/PlotPickle/issues/3241) (Factory storage lifecycle).  
**Reference:** Human-supplied `plotpickle_ai_story_os_2026_2027_edition(1).html` (design reference only, not executable/product truth); Human-supplied Library mockup of individual “Continue This Film” panels; ChatGPT composer screenshot; October 23 Human–AI design conversation.

## 1. North star: two collaborators in one creative studio

PlotPickle should feel like a shared working environment for the Human and AI, not a chatbot pasted onto a collection of filmmaking screens and not an AI replacing the Human. The product should keep existing creative workspaces, make the relevant story and shot visible to the assistant with permission, and let decisions become durable, inspectable, independently verified results.

The language of the product remains filmmaking and storytelling for the creator, with richer engineering/evidence surfaces when wanted. A beginner should not have to inspect an infrastructure dashboard to write a scene; a producer or developer can opt into full operational detail.

**Locked principle:** preserve PlotPickle's existing functional menus and production objects; change **composition and collaboration**, not underlying canonical data/approval authority. Contract-first; source of truth before green decorative UI.

## 2. Joint design decision record (conversation summary)

The following records the October 23 conversation as decisions and constraints, not an unverifiable verbatim transcript:

| Sequence | Human idea/question | Collaborative decision |
| --- | --- | --- |
| 1 — Library | Each story should have its own “Continue This Film,” as shown in the Human's Afterglow/Brotherly Love Library mockup. | Yes: a **story-scoped continuation context**, with saved provenance and evidence, not a shared non-project-aware panel duplicated visually. |
| 2 — Co-design | The Human does not want to freeze an individual mockup unilaterally, but wants the interface designed with ChatGPT. | Treat the HTML as a concept. Co-design by testing real human/AI workflows and revising before freezing visual composition. |
| 3 — Navigation | Keep the same PlotPickle menu, move it into a left sidebar like ChatGPT; submenus/workspaces use the 1/2/3-column area. | Keep existing menu taxonomy in collapsible left sidebar. Menu entry opens a **real workspace immediately**, rather than opening a redundant navigation page. |
| 4 — Storyboard | Both prefer opening Storyboard immediately, with Act/Block/Shot navigation inside it. | Preserve canonical **Act → Sequence → Block → Mini-Block → Shot** structure and shot/version actions in the Storyboard workspace. No global sidebar explosion. |
| 5 — Conversational experience | The Human wants a chat interface inspired by the current ChatGPT message composer and attached screenshot, integrated into PlotPickle. | Persistent project-aware conversation, comfortable multiline input, send, history, context links, and provider-supported attachments/voice; it complements the real canvas instead of replacing it. |
| 6 — Layout | Explore 1, 2 and 3 columns, plus collapse/resize. | **1 = selected work canvas; 2 = selected canvas + AI conversation; 3 = left PlotPickle navigation + canvas + AI conversation.** Evidence and agent activity appear on demand, potentially as a tab/drawer, not an always-visible compulsory fourth pane. |
| 7 — Sequencing | Lock the concept and colours into a developer brief now, **implement after the real bidirectional test**, and address hard-drive exhaustion. | Gateway round trip and disk-space safety are explicit entry gates. No fake UI proof or early wholesale shell rewrite. |

### What is explicitly *not* frozen

Exact breakpoints, panel widths, whether AI collaboration is a right pane vs an overlay in focus mode, final text labels, hotkeys, and exact card motion require genuine use tests. “ChatGPT-inspired” refers to familiar interaction mechanics; do not misrepresent the embedded surface as the hosted ChatGPT application or promise direct access to an existing consumer chat session.

## 3. Navigation and layout contract

### Global navigation (left, collapsible)

Preserve current groups and their implemented submenus, including:

- **EXPLORE** — Learn, Library, Community, Screening, Reports;
- **DEVELOP** — Mind Map, World Map, Write, Edit, Refine;
- **VISUALIZE** — Outline, Storyboard, Previs, Timeline, Rough Cut;
- **PITCH** — Deck, Package, Feedback;
- **PLAY** — Identity, Wyrmwood, Unwritten;
- **ASSETS** — Posters, Characters, Collectibles, World, and Sound/Foley/Narration/Music within existing implemented nesting;
- **SETTINGS** — include Compute/Tunnel, Operations, Storage/Backups and existing categories.

Do not delete/relabel real capabilities just to match the HTML sample's “Story Projects,” “Script Library,” or “Story Agents & Gems”; its sidebar labels are **illustrative**, not canonical.

The sidebar may also expose **Recent Stories**, **Recent Conversations**, and “New Story Thread” as secondary affordances. Distinguish conversation creation from story creation. Always provide a reliable **Back to Dashboard** / home action, including from nested Settings pages. Global keyboard navigation may not intercept typing inside an editor/chat composer.

### Canvas-first behaviour

Selecting Storyboard loads the actual Storyboard workspace in the main canvas, preserving its state and selected source. Act/Sequence/Block/Mini-Block/Shot selection and source/version controls stay **inside** that canvas. Same rule for Mind Map, World Map, Write, Outline, Previs, Timeline, etc. Reuse existing canonical PPF source/locks/versions and API entry paths. No parallel unsynchronised data model.

### Layout modes

| Mode | Visible primary content | Required behaviour |
| --- | --- | --- |
| 1 column / Focus | Selected canvas only, sidebar toggle and easy AI access | Maximises working area without discarding composer draft, context or navigation. |
| 2 columns / Collaborate | Canvas + conversation | Work and discussion visible together. Global navigation accessible via toggle. |
| 3 columns / Studio | Collapsible navigation + canvas + conversation | Navigation and AI stay available; evidence/Factory details can be expanded contextually. |

Keyboard, touch, small widths, zoom (including 200%), varying content heights, screen readers and focus restoration must work; avoid horizontal overflow and vanishing navigation. Changes in layout cannot silently change active story, route, locks, approval, source SHA, or context. Persist per-Human layout preference without confusing it with story canon.

**Important difference from the attached HTML:** its scripted `setLayout(2)` shows sidebar + central chat, whereas the agreed *product direction* uses workspace + conversation for the 2-column mode. Use the mockup's **look and column switcher**, not its simulated behaviour as authority.

## 4. ChatGPT-inspired conversation, grounded in real PlotPickle

- A comfortable **bottom-anchored rounded multiline composer** with clear Send/Stop, keyboard shortcuts and growing text, not an “EXECUTE” command that implies arbitrary code or unreviewed side effects.
- Conversation history uses readable alternating Human/AI messages with timestamps, contextual source references and explicit state. No simulated acknowledgements, fixed 700ms responses, invented tool execution, fabricated prompts, or unverified model labels.
- Offer attach/import, voice input, and a model/provider selector **only when the chosen integration actually supports them**; non-supported affordances are disabled with a truthful reason. Never make the app claim it is directly controlling the user's current ChatGPT UI session.
- A creator may ask from Storyboard: “Review Shot 12 for continuity” and get **grounded** project/scene/shot references and proposed changes. The system may **prepare** changes but cannot claim they were saved/approved/locked until verified via actual source-backed actions.
- User can inspect **What I know / What I used / What I propose / What changed / Evidence** for each meaningful AI act; technical trace is optional. All model/provider calls and gateway messages carry source identity, capability, idempotency/correlation, status and receipt links.
- Persistent conversations are scoped to **Human + story/project + topic/thread**, with explicit option to open a cross-project thread that exposes **no private story context until granted**. Switching projects must never leak creative content or previous project answers into the new project.
- Preserve unsent drafts and scroll position as the Human moves tools. Support stop/cancel, retry with idempotency, expired/offline/unknown status; never conflate a successful HTTP response with a durable AI answer or an independent verification.
- The assistant is usable **within every workspace** and can propose edits in situ, not confined to a separate Chat page. An inspector for agent status, Factory queue and human decisions is available when wanted.

### Each story: “Continue This Film”

Library cards can show poster, saved title, truthful project status and its own continuation action. Selecting a saved story opens a **project-bound summary**: last verified location (e.g. Act/Block/Mini-Block/Shot), saved approvals, current outstanding work, actual evidence, active/not-active provider availability, unresolved Human decisions and a jump straight into the real workspace. For Afterglow, Brotherly Love or any other story, no fake “progress percent,” no cross-project synthetic summary, and no auto Save/Lock.

If no saved story is active, show a helpful **select or restore story** action rather than inventing production data.

## 5. Visual design — palette captured from supplied 2026–2027 HTML mockup

The uploaded mockup calls its palette “Tactile Obsidian / Obsidian Glass” with emerald lighting. Capture these tokens explicitly as the **approved exploration palette**. Names and values below are from the reference's Tailwind config/CSS, not measurements from the screenshots.

| Token | Exact reference value | Intended use |
| --- | --- | --- |
| `obsidian.base` | `#07090E` | Main background, quiet outer canvas |
| `obsidian.elevated` | `#0D111A` | Header/secondary elevated planes |
| `obsidian.card` | `rgba(18, 22, 32, 0.75)` | Frosted card/glass surface |
| `obsidian.modal` | `#161C2A` | Input surface, selected controls, modal body |
| `obsidian.border` | `rgba(255, 255, 255, 0.08)` | Subtle 1px structural borders |
| `obsidian.borderLight` | `rgba(255, 255, 255, 0.16)` | Stronger selection/edge separation |
| `emerald.glow` | `#00FF9D` | Accent and status **only when status is actually verified** |
| `emerald.dim` | `rgba(0, 255, 157, 0.12)` | Selected chip/low-emphasis accent background |
| `screenplay.paper` | `#0B0E17` | Inset readable screenplay canvas, emerald left rule in sample |
| `text.title` | `#FFFFFF` | Strong headings |
| `text.body` | `rgba(255, 255, 255, 0.85)` | Primary paragraph text |
| `text.meta` | `rgba(255, 255, 255, 0.50)` | Muted metadata, subject to contrast audit |
| `text.sublabel` | `rgba(255, 255, 255, 0.35)` | Decorative/subordinate text **not for essential readable content** |

**Typography:** `Inter` for general reading; `JetBrains Mono` for evidence/short technical labels, both with system fallback. Use these visual references as design tokens through the **existing PlotPickle styling/theme system**, not Tailwind CDN or Google-hosted font dependencies copied wholesale from the demo. Verify locally in Windows/offline mode. Rounded, low-noise controls, generous reading line heights, and subtle frosted depth are preferred; avoid expensive animation and low-contrast micro-text for critical state.

**Semantics:** emerald is an accent, not a universal “success” badge. Preserve PlotPickle's status truth taxonomy (Defined / Observed / Emerging / Available / Blocked), with patterns/text not colour alone. Red/amber/grey error states require accessible contrast. Do not reproduce the attached mockup's `KERNEL: ONLINE`, `12ms` latency, `NR (94%)`, story scores, terminal “tunnel authenticated,” or AI-generated dialogue as verified truth without real evidence. Document the required instrumentation first.

## 6. Bidirectional communication and evidence contract

The UI consumes [#3259] gateway state rather than simulating chat traffic:

- **P1 already merged** as PR #3262: versioned bounded question/answer envelopes, private write-once durable journal and unit tests. This is **not** a full bidirectional AI service.
- **P2 required:** owner-authenticated, scope-bound MCP question submission and retrieval and pending/answered/failed/readiness surfaces, real exact source channel/SHA, no trust in browser-provided identity.
- **P3 required:** persistent owner-configured outbound AI API dispatcher with proof of model invocation, correlation, restart/reconnect recovery and actual visible answer. A hosted consumer ChatGPT UI conversation cannot be assumed to be a remote wakeable agent.
- Before this visual programme advances, verify **one genuine round trip**: create question in PlotPickle → durable outbox → authenticated AI worker receives → correlated answer persists → PlotPickle renders the answer → ChatGPT/MCP can read its exact receipt. Demonstrate deduplication, expired/unknown semantics, authorization isolation and independent logs.
- Only then enable governed write recommendations/actions with explicit owner policy and independent software/creative verification. Neither chat nor Factory can silently approve canon, auto-save-lock, merge unreviewed code or present “green” without an exact-commit verifier.

## 7. Hard-drive capacity and safe retention — #3241 is a gate, not incidental cleanup

The user explicitly requires that PlotPickle have enough hard-drive space to run reliably. **Do not duplicate #3241**; schedule an executable first slice and complete its lifecycle independently of the UI redesign.

Documented October 23 owner-Windows measurements in #3241: C: previously down to about **0.01 GB free**, installer failed `ENOSPC`; later audit observed **27.44 GB available after manual recovery**, but **that figure is historical, not a current preflight**. The private engineering-team directory was about **32.93 GB**, unclassified. Do not assume it is disposable. User retained ten historical eligible runtimes and exempted special-purpose runtimes.

**Required engineering slices:**

1. **P0 reporting:** bounded, progress-aware Windows disk/free-space inventory, approved roots and immediate child totals; handle symlinks/junctions/reparse points without escaping roots. Report **free bytes, logical bytes, age, ownership, active refs and unknowns**, identifying the correct volume of each staged path.
2. **P1 prevention:** typed `DISK_SPACE_INSUFFICIENT` preflight with configurable reserve and projected install/candidate staging bytes. Invoke before npm install, large generation/cache writes or worktree staging. Fail closed without trying expensive operations when headroom is inadequate. Record exact source SHA and receipt.
3. **P2 safe reclamation:** register active/fallback runtimes, protected user-selected ten historical snapshots, running/scheduled-task-referenced paths, immutable evidence/queue/receipts and special runtimes. User-facing dry-run shows candidate path, reason, estimated reclaim (not promised free bytes), exclusion proof, confirmation. No unattended deletion of models, media, stories, user profiles, credentials, Library assets, source files or immutable verification evidence.
4. **P3 monitoring:** Settings → Operations/Storage report (warnings at policy-defined thresholds, not guessed), retention policy, bounded cleanup batches, audit trail and trend across repeated upgrades.

**Acceptance:** low-disk synthetic tests, real owner-Windows disk probe, symlink/junction negative tests, active process exclusion, interrupted cleanup recovery, exact-commit CI and native Windows/browser owner confirmation. Store sensitive filesystem paths only in authorized local evidence; redact in shared chat/PR reports. *Disk space available now must be measured at run time; no static “READY” marker.*

## 8. Implementation milestones and stop/go rules

| Milestone | Work | Exit evidence |
| --- | --- | --- |
| D0 — Record design | This brief + UX tracker #3263 + dependency ledger | Green docs PR merged; no UI replacement |
| G1 — Real bidirectional | #3259 P2/P3 worker/MCP/GUI integration | True AI answer from PlotPickle-initiated request; durable independent receipt after offline/restart |
| S1 — Storage protection | #3241 safe inventory + preflight followed by preview/retention | Host free-space reading; typed low-disk refusal; no owner-data deletion |
| U1 — Shared shell | Sidebar/menu parity + focus/collaborate/studio layout | Screens switch in place; keyboard/a11y/200% zoom and state persistence |
| U2 — Per-story collaboration | Project-scoped “Continue This Film” + chat context and evidence drawer | Brotherly Love/Afterglow isolation, correct source links and no fake metrics |
| U3 — Product acceptance | Exact MAIN commit, Windows native/browser UAT, gateway reconnect, storage tests | Independent PASS; documented blocked/unverified distinctions before wider rollout |

The sequence is **contract and safety first**. D0 can merge immediately; U1/U2 are blocked on G1 and S1. #3241's independent prevention work may proceed in parallel with gateway P2/P3; it must not wait for a new UI design. Prioritize a narrow safe storage preflight over unattended cleanup.

## 9. Acceptance journeys used for co-design

**A. Resume Brotherly Love:** Library → poster/story card → “Continue This Film” → truthful last saved Act/Block/Mini-Block/Shot and pending Human approvals → Storyboard opens directly → ask AI about Shot 12 → review actual evidence/proposal → approve or reject explicitly. Switch to Afterglow and ensure conversation context, cached source, locks and permissions never mix.

**B. Collaborate in Storyboard:** toggle 1/2/3 columns mid-edit; input draft and source selection persist. Chat composer handles multiline prompts, cancellation, offline/unknown, source-linked follow-ups and screen-reader focus. Existing story workspace has parity.

**C. Observe Factory:** ask about an issue from within PlotPickle; see real task, exact branch/SHA, test/verification evidence, what was not run, and a durable gateway message correlated to the same result. A PR merge requires explicit permitted authority and GitHub confirmation, not a chat reply.

**D. Low-disk refusal:** simulate low disk then use real owner-Windows host test; install/stage does not begin, error is typed, safe cleanup preview excludes protected story/media/receipts, and retry only after capacity is actually recovered.

## 10. Scope exclusions / evidence obligations

Do not implement by pasting the uploaded HTML verbatim: it loads Tailwind, FontAwesome and fonts from CDNs; its chat replies are generated by `setTimeout`; its score and terminal strings are static; layout toggling is a sample. No provider proof, audio connection, persistent AI memory or worktree/Factory authority is demonstrated by that file.

No immediate mass redesign of existing screens; no claim that PR #3262's green CI completed the remote AI round-trip or disk preflight. Any future mockup iteration must be labelled **concept**, show unsupported interactions explicitly, and follow existing UAT/Windows, verification truth, privacy, accessibility and canon contracts.

## Related work

- [#3259](https://github.com/BryanHarrisScripts/PlotPickle/issues/3259) — bidirectional gateway (PR #3262 P1 merged; future P2/P3 remain).
- [#3241](https://github.com/BryanHarrisScripts/PlotPickle/issues/3241) — disk-space/preflight/retention workstream.
- [#3263](https://github.com/BryanHarrisScripts/PlotPickle/issues/3263) — Collaborative Workspace UX v1, this brief's implementation issue.
- PR #3261 — direct Tunnel **Back to Dashboard** repair, merged; retain the same navigation promise in the new shell.
