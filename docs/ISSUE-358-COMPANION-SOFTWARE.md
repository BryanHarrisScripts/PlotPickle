# Companion software inventory, maintenance and Ollama bootstrap

Issue: #358

## Goal

The Windows first-run experience should show one curated inventory of software that participates in the PlotPickle workflow. It must distinguish installed software, a running local service, and usable model or checkpoint readiness.

## Curated inventory

PlotPickle checks only:

- its own Node.js/npm runtime;
- Ollama and installed Ollama models;
- ComfyUI Desktop;
- Buzz Desktop/CLI;
- Git and GitHub CLI.

It does not enumerate unrelated Windows applications.

## Maintenance boundary

Automatic maintenance is best-effort and restricted to reviewed Windows Package Manager IDs or PlotPickle's existing reviewed third-party installer scripts. A third-party update failure is reported and never prevents PlotPickle from starting in No AI mode.

PlotPickle does not claim ownership of third-party configuration, models, checkpoints, custom nodes, accounts or credentials.

## Ollama starter model

The fixed starter model is `smollm2:135m-instruct-q2_K`. It is approximately 88 MB and exists to verify the lowest-resource local Ollama path. It is not presented as a production-quality story model.

The starter may be installed only when:

- Ollama is reachable through the local loopback Ollama service;
- no installed Ollama model is available, or the writer explicitly chooses the Settings action;
- the requested model exactly matches the allowlisted starter model.

The model pull never enables cloud fallback and never sends story data. After installation, PlotPickle refreshes `/api/tags`; the writer still selects and tests the model before it becomes the active text route.
