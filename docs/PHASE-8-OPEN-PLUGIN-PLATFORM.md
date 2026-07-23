# Phase 8 — Open Plugin Platform

PlotPickle is an open, local-first storytelling platform. Phase 8 keeps the application core lean by placing external providers and exchange formats behind a stable, permissioned plugin boundary.

## Architecture

Plugins do not receive unrestricted access to project folders. They declare permissions and capabilities in a manifest, then use the Core Services Layer:

- ProjectService
- CanonService
- ScreenplayService
- StoryboardService
- ReportService
- TimelineService
- AIService
- AssetService
- StorageService
- GitService
- PluginService

The built-in UI and future third-party extensions can share these contracts instead of creating parallel integration paths.

## Manifest and lifecycle

Each plugin declares a stable id, semantic version, Plugin API version, minimum PlotPickle version, entry point, permissions, capabilities, dependencies, commands, menu contributions and panels.

Lifecycle states are installed, enabled, disabled, incompatible, blocked and error. New plugins install disabled. A plugin cannot be enabled until every declared permission has been explicitly granted. Undeclared permissions can never be granted.

## Initial core plugin contracts

Phase 8 includes manifests for GitHub, provider-neutral AI, PDF export and Final Draft exchange. The capability vocabulary also supports local AI models, image generation, music, voice, Fountain and report exporters without coupling the core to a vendor.

These manifests define integration boundaries; provider-specific network clients remain optional implementations. PlotPickle can continue to run with every external plugin disabled.

## Security boundary

- no silent plugin activation;
- no undeclared permission escalation;
- no direct project-folder access outside StorageService;
- Canon context remains subject to the approved-only policy;
- network, Git, AI, voice and write access are separately declared;
- plugin errors can be isolated without invalidating the story project.

## Forward compatibility

`PLUGIN_API_VERSION` and `CORE_SERVICES_API_VERSION` begin at 1.0.0. Phase 9 can publish these types as the public SDK, while Phase 10 can freeze them alongside the project and `.ppf` specifications.
