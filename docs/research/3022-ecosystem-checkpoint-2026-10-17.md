# Ecosystem audit checkpoint: #3022, #3023 and #3024

Checked 2026-10-17T12:03:16.839Z, against main commit `0ea6e41c71da8a40d893fa6f123e1dbb2052c7e8`. This is a partial, evidence-bound checkpoint, not closure of the eight-stream audit. The [machine-readable receipt](3022-ecosystem-checkpoint-2026-10-17.json) records source hashes, upstream URLs/timestamps, lockfile versions, registry rows, public release channels, static agent identities and proof limits. It reuses the canonical registry instead of creating a second inventory authority.

## Parent status and completed work

#3022 and #3023–#3030 remain OPEN. Latest-capability-first modernization is authorized by the Human update in [#3022](https://github.com/BryanHarrisScripts/PlotPickle/issues/3022) and [#3053](https://github.com/BryanHarrisScripts/PlotPickle/issues/3053). Historical patch-only/no-major language is superseded; private story, credentials, signer identity and paid-provider consent remain protected.

Merged audit-linked work:

- #3045: vendored link metadata and attribution repair; #3049: nested Hunk shell-quote1.11.0 and retired Pi MCP adapter removal; #3050: own-record safety and structured fixture-data isolation; #3052: stale BUZZ0.5.25 test corrected to reviewed desktop0.5.26. The latter is a test correction, not a BUZZ version upgrade.
- #3054: Vinext1.2.1, Next/eslint-config-next16.4.2, React/DOM19.3.1 and RSC0.5.38; #3056: Mastra1.78.0 and AI SDK7.0.143; #3057: Cloudflare plugin1.64.0 and Wrangler4.151.1.
- #3059/#3063/#3060: Node26.12.0 pin, seven active architecture layers on Node26 and independent full Windows installer lifecycle. #3058 is CLOSED. Hosted Windows evidence is not a new test of this user's daily installation.
- #3062/#3064/#3065: explicit TS6.0.3 fixture compiler and bounded native fixture waves. #3061 remains OPEN with22 historical callers; their Node24.19 execution-only baseline is112cases92pass20fail0skip. The active native-API negative control intentionally rejects removed transform mode and is not migration debt.

The recent fixture work supports #3027; it does not complete #3023 or #3024. #3025–#3030 are not certified by this receipt.

## #3023: licence, dependency and security evidence

The existing command `node scripts/third-party-oss-audit.mjs --json` passed:30 registered systems,2 reviewed assets,2 non-OSS connections,24 direct npm dependencies and778 lockfile package records. No warnings, failures or missing transitive licence fields were reported. These are registry/lockfile checks, not a count of verified local installations or a legal clearance for every use.

Fresh `npm audit --package-lock-only --ignore-scripts --json` calls returned zero advisories for the root, `tools/hunk-review` and `.pi/npm` graphs. No clean installs were performed for this checkpoint. Other nested ecosystems and installed binaries remain separate audit obligations.

GitHub currently reports zero open CodeQL alerts and one open high-severity Dependabot alert:braces#52, GHSA-vfj7-8cjw-p6xm, affected range<=3.0.3, no first patched version reported. The source carries the previously reviewed vendor depth-guard mitigation (#2706); npm's zero result does not dismiss GitHub's alert or certify every vulnerability path. No alert was dismissed. See [the advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

All24 direct packages were checked against npm registry latest tags with UTC timestamps in the JSON. Newly identified toolchain gaps are ESLint10.12.0→10.13.0 and TypeScript6.0.3→7.0.2. The latter needs its own migration because the fixture compiler intentionally checks exactTS6.0.3. A major release is not a reason to defer it, but a manifest-only update would break the existing compiler contract.

## #3024: current pins, observed installations and candidate releases

| Component/channel | Current source pin or policy | Observation / checked upstream | Next action |
|---|---|---|---|
| Pi coding agent |1.0.1| Existing managed CLI returns1.0.1; upstream1.3.0 published2026-10-15 | Coordinated Pi and extension upgrade with Windows SDK/RPC/native-MCP/codemode proof |
| Pi Durable |1.0.0, active-default adapter policy| Default managed package manifest1.0.0 present; upstream1.3.0 | Isolated JSONL reopen/replay/authority and migration proof |
| Cline | user-managed, no exact active pin| npm CLI3.0.73; release channels separately include extension4.1.25 and desktop0.0.48; local callable version UNPROVEN | Audit configured worker and choose explicit CLI policy; do not equate channels |
| OpenPencil | CLI/MCP and desktop0.15.1| CLI/MCP managed manifests0.15.1 present; upstream CLI/release0.16.0 | Coordinated packages and desktop assets/integrity, scoped design and explicit-connect Windows proof |
| BUZZ relay | compose manifestv0.4.26| Source pin only; local installed/running relay UNPROVEN; latest relay release not established here | Independently inspect relay/image channel |
| BUZZ desktop | reviewed fallback0.5.26| Upstream desktop-v0.5.28, published2026-10-09, GitHub prerelease=false; fallback installer is marked alpha/unsigned | Review actual Windows assets and updater compatibility before promotion |
| Portless | isolated developer tool0.15.5| Upstream0.15.8; local installed version UNPROVEN | Separate bounded developer-tool update |
| Mastra / AI SDK |1.78.0 /7.0.143 locked| Both match checked npm latest tags | Preserve current versions; complete capability/agent-health work separately |

The local probes checked versions/manifests only. They did not run inference, extension jobs, durable restart, design edits, BUZZ presence, signing or remote messages.

Pi's four loaded extension packages also have newer checked releases:

| Extension | Current pin | Checked npm latest |
|---|---|---|
| @dietrichgebert/ponytail |4.8.4|5.3.2|
| pi-subagents |0.35.1|0.79.0|
| @ff-labs/pi-fff |0.10.1|0.11.0|
| pi-context-view |0.4.2|0.7.1|

The old pi-mcp-adapter remains retired/dormant. Historical candidate evaluation files that mention older Pi versions are history, not the current managed pin. Do not reactivate the retired adapter while updating extensions. Pi1.3 release notes include resumed-tool restoration, exact internal dependency pins and malformed-tool-argument rejection; preserve PlotPickle's native MCP/authorization and no-silent-fallback contracts when adopting these changes. [Upstream Pi1.3.0](https://github.com/earendil-works/pi/releases/tag/v1.3.0).

## Static agent census and proof limits

Current source registries contain20 named profiles:9 embedded Mastra,6 BUZZ-managed and5 UAT/observer/handoff profiles. Mastra declares16 roles:9 overlap named profiles, while7 are role-only (discovery-mapper, character, world, screenwriter, graphic-novel, production, workflow-change). The supervisor declares5 worker IDs and is itself a separate process; Pi/Cline are2 developer-worker registrations. Registry counts overlap and must not be summed as independent healthy agents. The JSON lists each identity and relationship.

The public Playhouse directory contains15 profile references; the assembled Guildhall has16 actors. Knot, Thread and Heart are in the profile/directory sets but absent from Guildhall actors. This is a source mismatch requiring owner/transport investigation, not a confirmed runtime defect. Twenty-two registered Skills are procedures, not22 additional callable agents. Six runtime sidecars are registered; their process health was not observed here.

Every agent's input/output health remains UNPROVEN in this checkpoint. Dynamic external BUZZ peers were not discovered. Existing #3008 owns the actual input/output census/adapters; reuse that owner. Version presence, registered identity, connected/present, correlated output, valid schema, signed read-back and room authority are separate proof classes. No signed transport test or public/DM message is authorized merely by this audit.

## Ordered completion queue

1. #3024/#3053: upgrade Pi plus loaded extensions together after inspecting1.0.1→1.3.0 changelogs and extension compatibility; genuine lockfile, focused regressions, SDK/stdio/native-MCP/authorization, Windows private managed install, UAT/build/reviews/exact-head gates. Retain rollback and no provider calls for compatibility probes.
2. #3024: Pi Durable1.3.0 isolated state/replay migration; then OpenPencil0.16.0 coordinated adapter/package/desktop proof.
3. #3024: BUZZ desktop0.5.28 asset verification and separate relay channel; Cline CLI policy and Portless0.15.8. No identity impersonation or implicit BUZZ dispatch.
4. #3023/#3053: ESLint and TypeScript7 compatibility waves. Keep the current exactTS6 compiler until its deliberate migration is proven; do not silently change expected output to satisfy the new compiler.
5. #3023: complete remaining graph, installed-binary, upstream and licence/model provenance rows; compare the original28 matrix items. That attachment is referenced in #3022 but not present in this checkout, so exact row-by-row reconciliation remains UNPROVEN. Existing issue descriptions support progress without inventing the missing attachment contents.
6. #3022: roll up all eight streams only after their evidence and Human acceptance. Keep #3022/#3023/#3024 open now.

## Registered-system dispositions

A KEEP_CHECKED_VERSION row means only that its declared/locked version matched the checked npm tag. UPDATE_CANDIDATE requires compatibility/licensing/migration proof. REFERENCE is not an installed runtime. REQUIRES_STREAM_REVIEW and not-checked fields remain explicit.

| Registered system | Use class | Declared/locked version | Checked npm latest | Disposition | Audit owner |
|---|---|---|---|---|---|
| Node.js | bundled | 26.12.0 | not checked here | REQUIRES_STREAM_REVIEW | #3023 |
| React | npm-runtime | 19.3.1 | 19.3.1 | KEEP_CHECKED_VERSION | #3023 |
| Vite | npm-runtime | 8.3.4 | 8.3.4 | KEEP_CHECKED_VERSION | #3023 |
| Vinext | npm-runtime | 1.2.1 | 1.2.1 | KEEP_CHECKED_VERSION | #3023 |
| Mastra | npm-runtime | 1.78.0 | 1.78.0 | KEEP_CHECKED_VERSION | #3024 |
| Vercel AI SDK | npm-runtime | 7.0.143 | 7.0.143 | KEEP_CHECKED_VERSION | #3024 |
| Drizzle ORM | npm-runtime | 0.45.4 | 0.45.4 | KEEP_CHECKED_VERSION | #3023 |
| libsodium / libsodium-wrappers-sumo | npm-runtime | 0.8.4 | 0.8.4 | KEEP_CHECKED_VERSION | #3023 |
| Tailwind CSS | npm-runtime | 4.3.3 | 4.3.3 | KEEP_CHECKED_VERSION | #3023 |
| BUZZ | managed-download | 0.4.26 | not checked here | REQUIRES_STREAM_REVIEW | #3024 |
| Ollama | connect-only | user-managed | not checked here | REQUIRES_STREAM_REVIEW | #3025 |
| llama.cpp | connect-only | user-managed | not checked here | REQUIRES_STREAM_REVIEW | #3025 |
| whisper.cpp | managed-download | b5130 | not checked here | REQUIRES_STREAM_REVIEW | #3026 |
| ComfyUI | connect-only | user-managed | not checked here | REQUIRES_STREAM_REVIEW | #3026 |
| FFmpeg / ffprobe | connect-only | user-managed | not checked here | REQUIRES_STREAM_REVIEW | #3026 |
| Lazy Frames | managed-download | 0.6.3 | not checked here | REQUIRES_STREAM_REVIEW | #3026 |
| Portless | developer-tool | 0.15.5 | 0.15.8 | UPDATE_CANDIDATE | #3024 |
| Pi coding agent | developer-tool | 1.0.1 | 1.3.0 | UPDATE_CANDIDATE | #3024 |
| Cline | developer-tool | user-managed | 3.0.73 | REQUIRES_STREAM_REVIEW | #3024 |
| ReelBench Skills | reference-only | not versioned / unknown | not checked here | REFERENCE | #3023 |
| BERD | reference-only | not versioned / unknown | not checked here | REFERENCE | #3023 |
| GitHub Spec Kit | reference-only | not versioned / unknown | not checked here | REFERENCE | #3023 |
| Lightricks ComfyUI-LTXVideo pinned workflow | reference-only | not versioned / unknown | not checked here | REFERENCE | #3026 |
| ComfyUI LTX-Video workflow template | reference-only | not versioned / unknown | not checked here | REFERENCE | #3026 |
| Sideshow | reference-only | not versioned / unknown | not checked here | REFERENCE | #3023 |
| JetBrains Mono | bundled | 2.304 | not checked here | REQUIRES_STREAM_REVIEW | #3023 |
| Color Expert Agent Skill | reference-only | not versioned / unknown | not checked here | REFERENCE | #3023 |
| Pi Durable | managed-active-default-adapter | 1.0.0 | 1.3.0 | UPDATE_CANDIDATE | #3024 |
| OpenPencil | managed-optional-adapter | 0.15.1 | 0.16.0 | UPDATE_CANDIDATE | #3024 |
| lru 0.14.0 security backport | vendored-security-backport | 0.14.0 | not checked here | REQUIRES_STREAM_REVIEW | #3023 |

## Direct npm snapshot

These are the exact lockfile versions and checked npm tags; release-time rechecking remains necessary.

| Package | Locked | Checked latest | Decision scope |
|---|---|---|---|
| @cloudflare/vite-plugin | 1.64.0 | 1.64.0 | matches checked latest tag |
| @mastra/core | 1.78.0 | 1.78.0 | matches checked latest tag |
| @tailwindcss/postcss | 4.3.3 | 4.3.3 | matches checked latest tag |
| @vitejs/plugin-react | 6.1.2 | 6.1.2 | matches checked latest tag |
| @vitejs/plugin-rsc | 0.5.38 | 0.5.38 | matches checked latest tag |
| ai | 7.0.143 | 7.0.143 | matches checked latest tag |
| braces | null | 3.0.3 | reviewed vendor backport; do not replace blindly |
| drizzle-orm | 0.45.4 | 0.45.4 | matches checked latest tag |
| libsodium-wrappers-sumo | 0.8.4 | 0.8.4 | matches checked latest tag |
| next | 16.4.2 | 16.4.2 | matches checked latest tag |
| react | 19.3.1 | 19.3.1 | matches checked latest tag |
| react-dom | 19.3.1 | 19.3.1 | matches checked latest tag |
| sharp | 0.35.5 | 0.35.5 | matches checked latest tag |
| tailwindcss | 4.3.3 | 4.3.3 | matches checked latest tag |
| vinext | 1.2.1 | 1.2.1 | matches checked latest tag |
| vite | 8.3.4 | 8.3.4 | matches checked latest tag |
| wrangler | 4.151.1 | 4.151.1 | matches checked latest tag |
| @types/node | 26.6.5 | 26.6.5 | matches checked latest tag |
| @types/react | 19.3.0 | 19.3.0 | matches checked latest tag |
| @types/react-dom | 19.3.0 | 19.3.0 | matches checked latest tag |
| drizzle-kit | 0.31.11 | 0.31.11 | matches checked latest tag |
| eslint | 10.12.0 | 10.13.0 | separate upgrade wave |
| eslint-config-next | 16.4.2 | 16.4.2 | matches checked latest tag |
| typescript | 6.0.3 | 7.0.2 | separate upgrade wave |

## Verification for this reporting change

No source, runtime pin, lockfile, test, normative approval or project data is changed. Validate JSON parsing, source digests, registry/census counts and reported upstream/security scope; run existing OSS audit and truth admission. Exact-head architecture/BEN/CodeQL and separate reviews remain required before merging the report. Prior product UAT/build/installer results remain linked historical evidence, not fresh product proof from documentation.
