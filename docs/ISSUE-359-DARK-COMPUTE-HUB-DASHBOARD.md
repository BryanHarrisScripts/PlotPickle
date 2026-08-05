# Dark Compute Hub first-run Dashboard

Queued follow-up after issue #358.

The user-provided concept image establishes the visual direction: a dark, premium compute-control dashboard with local/cloud mode, installed-service cards, resource monitoring, active work and event status.

## Requirements

- preserve Dashboard as a read-only status and navigation surface;
- introduce dark appearance as an application-wide theme option rather than a Dashboard-only colour override;
- summarize actual Local, Cloud and Off routing for text, images and video;
- show PlotPickle Runtime, Ollama, ComfyUI, Buzz, GitHub, Google, OpenAI and MiniMax using real connection data;
- report CPU, GPU, VRAM, RAM and storage only when the local packaged runtime can obtain trustworthy values;
- show real model pulls, image/video jobs, repository operations and connection events;
- link each system to its independent Settings owner;
- retain green/yellow/red semantics with icon and text, keyboard focus, reduced motion and forced-colour support;
- never show credentials or provide inline endpoint/model/provider configuration on Dashboard.
