# Developer Brief — #1910 Universal Local Voice Input

## Purpose

Add one reusable local speech-to-text input method for ordinary PlotPickle text fields.

The governing product rule is:

`Human speech -> Windows microphone -> temporary local PCM WAV -> whisper.cpp -> plain text -> the same field's existing input/onChange path`

Voice is only another way to type. It is not a new Agent, provider, project store, memory system, canon authority, realtime conversation service or paid-cloud route.

## User experience

When an eligible text field has focus, PlotPickle shows one compact microphone control at that field's right edge.

- Activate `Dictate text` to request OS/browser microphone permission and begin listening.
- Activate `Stop dictation` to finish the bounded recording.
- PlotPickle transcribes the temporary WAV locally with whisper.cpp.
- The resulting plain text is inserted into the same field at the captured selection/caret.
- The field regains focus and the Human may edit the text normally.
- Dictation never submits, sends, publishes, saves, accepts, merges or changes canon automatically.

The same app-shell capability serves Agent/chat composers, Community text, search fields, project notes and other ordinary natural-language inputs. Screens do not implement their own microphone stacks.

## Architecture

### Shared UI owner

`app/_components/universal-voice-input-layer.tsx` is the app-shell adopter. It tracks the actual focused eligible input/textarea and supplies that concrete element reference to the shared control.

`app/_components/voice-input-control.tsx` owns microphone capture, WAV construction, local transcription request, state/error announcements and caret restoration.

`lib/voice-input.ts` owns pure eligibility and text-insertion rules.

The universal layer updates a field through its native value setter and dispatches the same bubbling `input` event used by normal typing. Existing controlled React `onChange` state therefore remains authoritative. The dictation layer does not call downstream submit handlers.

### Local runtime owner

`build/voice/local-voice-gateway.ts` extends the existing PlotPickle loopback Vite gateway boundary. It exposes only:

- `GET /api/local-voice/status`;
- `POST /api/local-voice/setup`;
- `POST /api/local-voice/transcribe`.

`build/voice/local-voice-runtime.ts` owns fixed reviewed runtime/model paths, integrity verification, bounded non-shell process execution and temporary-file cleanup.

The gateway is registered by the existing `build/local-ai-gateway.ts` composition owner. This does not make voice a text-generation provider; it simply reuses PlotPickle's existing localhost server lifecycle.

### Settings owner

`app/sage-settings-workspace.tsx` exposes `Local Dictation` as a focused Settings section. `app/local-voice-settings.tsx` provides the explicit one-time install/repair action and public readiness information.

No automatic download occurs because a microphone control is visible or clicked.

## Pre-build reuse/exit-gate answers

1. Shared component owner: app-shell `UniversalVoiceInputLayer` + shared `VoiceInputControl`, not per-screen controls.
2. Existing native-process owner reused: the repository already uses argument-array `spawn(..., { shell: false })` for bounded native tooling, especially Sequence Evidence. Voice follows that discipline.
3. Audio format: Web Audio captures local float PCM, resamples to mono 16 kHz and encodes signed 16-bit RIFF/WAVE in the browser. FFmpeg is not required for dictation.
4. whisper.cpp runtime pin: Windows x64 CPU release asset `whisper-bin-x64.zip`, nightly tag `b5130`, source commit `927cfce34f31707e17f2bff35c349632fb9e2c3a`.
5. Runtime archive provenance: 8,573,270 bytes, SHA-256 `f9ec6c52a2e949b62ab51fa21d0d497958f9e41c3010c157c4e42932d5316f3c`, upstream MIT licence preserved under `runtime/whisper/`.
6. Model pin: `base.en`, immutable Hugging Face revision `80da2d8bfee42b0e836fc3a9890373e5defc00a6`, `ggml-base.en.bin`, 147,964,211 bytes, SHA-256 `a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002`, repository declares MIT.
7. Windows runtime location: the reviewed runtime/model are installed under PlotPickle's existing persistent application home, `runtime/voice/whisper-b5130/`, never in a PPF.
8. Temporary audio: PlotPickle creates one unique run directory under its persistent temp area, accepts at most two minutes / 4,000,044 WAV bytes, and recursively deletes capture/transcript files in `finally` on success or failure. Raw audio is never logged.
9. Sensitive/specialized exclusion: password, file, number, date/time, URL/email/tel, numeric input modes, credential/API key/token/signing-key/path/endpoint/command/code/model/provider/timecode descriptors, readonly/disabled controls and `data-voice-input="false"` are excluded centrally.
10. One active microphone: the shared control keeps one app-wide active owner; starting another session cancels and releases the previous capture. The concrete target element is stored explicitly rather than relying on `document.activeElement` during transcription.
11. Typed/dictated equivalence: the universal layer dispatches the ordinary bubbling `input` event after setting the same field value; existing screen state/submit logic remains untouched.
12. Windows proof: Product Gate installs/verifies the exact pinned runtime/model and transcribes deterministic locally synthesized 16 kHz PCM fixture audio with whisper.cpp/base.en.

## Runtime and model setup

The canonical pins live in `config/local-voice-input.json`.

`scripts/install-whisper-cpp.ps1` supports:

- `Verify` — no download; verify the reviewed install and hashes;
- `Install -Approved` — explicit download, exact size/hash verification, install and manifest creation;
- `Smoke -Approved` — ensure the reviewed install exists, synthesize a deterministic Windows fixture WAV and prove local transcription.

The installer downloads to PlotPickle's own temporary area, validates before activation, copies the complete whisper executable/DLL directory, places `base.en` in the reviewed model directory, records the installed executable digest, preserves licence/provenance files and removes setup artifacts.

A changed runtime archive, model, executable or install provenance fails closed. PlotPickle never falls back to GPT-Live, OpenAI speech APIs, HeyGen or another paid/cloud transcription provider.

## Microphone lifecycle

States are explicit:

`IDLE -> REQUESTING_PERMISSION -> LISTENING -> FINALIZING_AUDIO -> TRANSCRIBING -> INSERTED -> IDLE`

Failures are explicit:

- `PERMISSION_DENIED`;
- `MIC_UNAVAILABLE`;
- `MODEL_UNAVAILABLE`;
- `RUNTIME_UNAVAILABLE`;
- `TRANSCRIPTION_FAILED`;
- `CANCELLED`;
- `TIMEOUT`.

The microphone is requested only from the Human's button activation. All MediaStream tracks are stopped on finish, cancellation, timeout, replacement by another field, component unmount and permission/capture failure where a stream exists.

The first version is intentionally stop-then-transcribe. It does not require realtime partial transcripts or an always-open voice session.

## Privacy and authority

- Audio stays local.
- Audio is temporary and is not saved in a project or PPF.
- Raw audio is not sent to an Agent, provider, Community service or cloud endpoint.
- Raw audio is not retained in Agent memory or logs.
- The transcript has no special authority; after insertion it is ordinary editable text.
- Existing Human approval, PPF canon, Story Proposal, Agent and Community boundaries remain unchanged.
- Voice input never causes automatic send/submit/save/publish/canon admission.

## Accessibility

The shared control is a real focusable button and exposes:

- `Dictate text` while idle;
- `Stop dictation` while listening;
- `aria-pressed` for the listening state;
- screen-reader status updates for permission, listening, finalization, local transcription, insertion and failures;
- keyboard activation through native button Enter/Space semantics;
- visible focus;
- state that is not color-only;
- no required animation, with reduced-motion styles;
- field focus/caret restoration after successful insertion.

## OSS and attribution

whisper.cpp is a managed local open-source runtime. Its exact source/release, licence, notice path and PlotPickle use are recorded in the canonical OSS registry.

`base.en` is a reviewed third-party model asset. Its immutable source revision, exact byte size, SHA-256 and declared licence are recorded in the canonical local-voice manifest and model provenance note.

No whisper.cpp source code is copied into PlotPickle. PlotPickle invokes the reviewed upstream binary as an external local process.

## Non-goals

- No GPT-Live or continuous voice session.
- No HeyGen/avatar dependency.
- No speech synthesis or spoken Assistant output.
- No new Agent.
- No voice memory.
- No voice canon.
- No provider/model chooser in ordinary UI.
- No Python, Conda, Docker, Ollama, CUDA or FFmpeg requirement for dictation.
- No silent runtime/model download.
- No cloud fallback.
- No microphone control on secrets, credentials, paths, commands, numeric/date inputs or other specialized controls.
- No per-screen copy of microphone/transcription logic.

## Focused acceptance evidence

Tests must prove:

- exact runtime/model pins and hashes;
- explicit setup approval and no automatic download;
- fixed PlotPickle-owned paths and `shell: false` native execution;
- bounded audio and timeout;
- temp cleanup in `finally`;
- one active transcription and one active microphone capture;
- microphone permission only follows explicit activation;
- track release and failure preservation;
- insertion preserves existing text and caret target;
- normal `input/onChange` path is used and no submit callback exists in the voice layer;
- centralized secret/specialized exclusions;
- no GPT-Live/cloud transcription fallback;
- Settings install/repair surface;
- accessible labels/status semantics;
- OSS licence/provenance records;
- Windows local fixture transcription in Product Gate;
- PR Gate and Product Gate run on the exact same final head.

## Completion definition

#1910 is complete when a user can focus an eligible PlotPickle natural-language input, dictate locally through one shared app-shell control, receive editable text back in that same field without auto-submit, and the reviewed Windows whisper.cpp/base.en runtime is explicit, integrity-checked, private, attributable and proven by the two-gate release process.

## Addendum — `/` Agent shortcut

The same PR also adds a second lightweight text-entry affordance to the Writing Assistant composer. It does not create a command language or another Agent registry.

- Pressing `/` while the prompt is empty opens a compact picker of PlotPickle Agents that are actually conversationally routable.
- Clicking the visible `/` control opens the same picker.
- The picker reads `/api/writing-assistant/agent-compute`, which is already derived from the canonical Agent profiles and Mastra role registry. Agent names are not duplicated or hard-coded into the picker.
- Only real PlotPickle-owned configurable Mastra roles are listed; BUZZ and External Developer entries stay under their own runtime authority.
- Arrow Up/Down changes the highlighted Agent, Enter selects it, and Escape closes the list.
- Selecting an Agent changes the real `agentId` sent with the next Writing Assistant turn. The selected target is visible and can be cleared back to the default PlotPickle Assistant.
- `/` inside ordinary non-empty prose remains ordinary text. The shortcut only intercepts a new empty prompt.
- Agent selection changes who receives the text; it does not change provider authority, tool permission, PPF/canon authority, Human approval or memory boundaries.
- Dictation and `/` compose cleanly: `/` chooses the conversational target, while the microphone only supplies editable text to the existing prompt.
