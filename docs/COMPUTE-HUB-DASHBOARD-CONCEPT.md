# Compute Hub dashboard concept

Queued after issue #358.

The first-run Dashboard should evolve toward a darker, control-room-inspired **Compute Hub** while preserving the established Dashboard boundary: it remains a read-only status and navigation surface, not a configuration form.

## Visual direction

- dark charcoal and blue-grey panels with restrained cyan/green/yellow/red status accents;
- premium desktop control-panel feel without imitating another product;
- clear hierarchy for first-time users: compute mode, installed systems, local resources, active jobs and event history;
- retain high contrast, keyboard focus, reduced-motion and forced-colour support;
- theme should become an application-wide dark appearance option, not a Dashboard-only hard-coded palette.

## Dashboard content

- **Compute mode:** Local / Cloud / Off summary reflecting the actual text, image and video routing configuration;
- **Installed services:** PlotPickle Runtime, Ollama, ComfyUI, Buzz, GitHub, Google, OpenAI and MiniMax cards using real readiness data;
- **Local resources:** truthful CPU, GPU, VRAM, RAM and disk readings only where the packaged local runtime can report them reliably;
- **Active work:** current image/video jobs, model pulls and repository operations;
- **Event log:** recent connection checks, successful tests, failures and repair handoffs;
- each card links to the exact independent Settings section that owns configuration.

## Product boundaries

- no API keys, model selectors, endpoints or provider switches on Dashboard;
- no invented resource metrics or fake animated activity;
- no automatic cloud fallback;
- status uses icon, label and text in addition to colour;
- first experience should explain what is included, what is installed, and what remains optional.
