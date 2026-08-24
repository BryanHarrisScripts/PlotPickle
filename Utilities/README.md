# PlotPickle Utilities

This folder contains PlotPickle's supported maintenance, verification and advanced Windows utilities. The repository root is intentionally kept simple for first-time users: normal platform launchers stay at the root, while maintenance tools live here.

Internal implementation scripts remain under `scripts` so application startup, testing and update paths remain separated from Human-facing utilities.

## Start here

For ordinary Windows use, run the root `Start-PlotPickle.bat`. PlotPickle runs privately on this computer at `http://127.0.0.1:4173`. Keep its command window open while using PlotPickle. Closing that window stops the local PlotPickle server; it does not remove your projects or settings.

`Start-PlotPickle.cmd` remains available here as a convenience wrapper for the same supported root launcher.

No Administrator rights, Windows service or Windows startup registration are required.

## Utilities

| Utility | Use it when | What it changes |
| --- | --- | --- |
| `Start-PlotPickle.cmd` | You want to open PlotPickle from this folder | Starts or opens the verified local app |
| `Update-PlotPickle.cmd` | You downloaded PlotPickle and want the current release | Updates application files while preserving the user-owned runtime |
| `Repair-PlotPickle.cmd` | Startup reports a damaged or incomplete installation | Repairs reviewed PlotPickle dependencies and runtime files |
| `Verify-PlotPickle.cmd` | You want the complete local verification pass | Runs the maintained full-check utility |
| `Check-ComfyUI.cmd` | Image generation is not ready | Checks the supported ComfyUI connection and starter path |
| `Sync-PlotPickle-BUZZ.cmd` | BUZZ Agents, avatars or room membership need synchronization | Creates only the four supported missing Community rooms and repairs approved Agent memberships |
| `Clean-PlotPickle-BUZZ.cmd` | Old machine-generated BUZZ rooms or messages need cleanup | Plans, archives legacy rooms, or explicitly resets one retained room |
| `Start-Production-Supervisor.bat` | Advanced local production-agent diagnosis is needed | Starts the bounded local Visual/Video Production supervisor tools |

The `.bat` launchers stored beside the convenience `.cmd` files are maintained implementation launchers. Normal users should prefer the short `.cmd` utilities above.

## BUZZ Community cleanup

The supported Human-facing BUZZ rooms are:

- `great-hall` — general Community conversation
- `story-council` — shown as Story Workshop
- `wyrmwood-ring` — Wyrmwood discussion
- `marquee` — posters, key art, trailers and visual development

`Clean-PlotPickle-BUZZ.cmd` always offers three separate modes:

1. PLAN reads the Community and changes nothing.
2. ARCHIVE archives the nine retired machine/specialist rooms. Existing history is preserved by BUZZ.
3. RESET permanently replaces one retained room with a new empty channel and restores its prior membership. This is the clean-history option and requires the exact room-specific confirmation.

The Human/admin BUZZ private key is entered through a hidden prompt, passed only through the current process environment and cleared when the utility exits. It is never written into the PlotPickle checkout. Agent identities remain separate from the Human identity.

Run PLAN first. Use ARCHIVE for the normal cleanup. Use RESET only when you deliberately want to remove the existing history from Great Hall, Story Workshop, Wyrmwood or Marquee.

## Archive

`Utilities/archive/` contains retired or duplicate historical launchers renamed with the `.arc` suffix. They are reference material only and are intentionally non-executable. Do not use them for normal setup, repair, verification or BUZZ synchronization.

The earlier Lighthouse launcher is archived because it is retired and is not a trustworthy packaged-runtime release gate. Use `Verify-PlotPickle.cmd` for the supported complete verification path.
