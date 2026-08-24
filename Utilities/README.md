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
| `Convert-Screenplay-To-PPF.cmd` | You have an existing screenplay and want a PlotPickle project file | Reads the source screenplay locally and writes a new rich `.ppf`; the source file is never changed |
| `Check-ComfyUI.cmd` | Image generation is not ready | Checks the supported ComfyUI connection and starter path |
| `Sync-PlotPickle-BUZZ.cmd` | BUZZ Agents, avatars or room membership need synchronization | Creates only the four supported missing Community rooms and repairs approved Agent memberships |
| `Clean-PlotPickle-BUZZ.cmd` | Old machine-generated BUZZ rooms or messages need cleanup | Plans, archives legacy rooms, or explicitly resets one retained room |
| `Start-Production-Supervisor.bat` | Advanced local production-agent diagnosis is needed | Starts the bounded local Visual/Video Production supervisor tools |

The `.bat` launchers stored beside the convenience `.cmd` files are maintained implementation launchers. Normal users should prefer the short `.cmd` utilities above.

## Screenplay to PPF conversion

`Convert-Screenplay-To-PPF.cmd` is a thin launcher over PlotPickle's existing screenplay parser, rich screenplay importer and portable PPF packager. It does not create a second importer or project format.

Supported source families are Final Draft `.fdx`, Fountain `.fountain` / `.spmd`, plain screenplay `.txt`, and text-based `.pdf`. For PDFs, the utility uses a local `pdftotext` (Poppler) or `mutool` (MuPDF) command when one is already available. PlotPickle does not silently OCR scanned/image-only PDFs; export those scripts as Final Draft, Fountain or text, or perform an explicit OCR step first.

You can drag a screenplay file onto `Convert-Screenplay-To-PPF.cmd`, double-click the utility and enter a path, or run it from a terminal. By default the resulting `.ppf` is written beside the source screenplay. The source file is never modified.

The resulting project keeps the imported screenplay evidence and marks generated structural interpretation as reviewable suggestions. Importing a screenplay does not mark PlotPickle curriculum lessons complete.

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
