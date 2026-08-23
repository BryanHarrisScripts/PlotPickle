# PlotPickle Utilities

This folder is the plain-language starting point for a downloaded PlotPickle package. The supported utilities here call PlotPickle's maintained implementation scripts; internal scripts remain under `scripts` so existing startup, testing and update paths do not break.

## Start here

Run `Start-PlotPickle.cmd` for ordinary use. PlotPickle runs privately on this computer at `http://127.0.0.1:4173`. Keep its command window open while using PlotPickle. Closing that window stops the local PlotPickle server; it does not remove your projects or settings.

No Administrator rights, Windows service or Windows startup registration are required.

## Utilities

| Utility | Use it when | What it changes |
| --- | --- | --- |
| `Start-PlotPickle.cmd` | You want to open PlotPickle | Starts or opens the verified local app |
| `Update-PlotPickle.cmd` | You downloaded PlotPickle and want the current release | Updates application files while preserving the user-owned runtime |
| `Repair-PlotPickle.cmd` | Startup reports a damaged or incomplete installation | Repairs reviewed PlotPickle dependencies and runtime files |
| `Verify-PlotPickle.cmd` | You want the complete local verification pass | Runs the maintained full-check utility |
| `Check-ComfyUI.cmd` | Image generation is not ready | Checks the supported ComfyUI connection and starter path |
| `Sync-PlotPickle-BUZZ.cmd` | BUZZ Agents, avatars or room membership need synchronization | Creates only the four supported missing Community rooms and repairs approved Agent memberships |
| `Clean-PlotPickle-BUZZ.cmd` | Old machine-generated BUZZ rooms or messages need cleanup | Plans, archives legacy rooms, or explicitly resets one retained room |

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

The earlier Lighthouse launcher is intentionally not exposed here because it is retired and is not a trustworthy packaged-runtime release gate. Use `Verify-PlotPickle.cmd` for the supported complete verification path.
