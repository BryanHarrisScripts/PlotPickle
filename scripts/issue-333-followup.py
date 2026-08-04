from __future__ import annotations

import json
from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, source: str) -> None:
    Path(path).write_text(source, encoding="utf-8")


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise SystemExit(f"Expected source block not found: {label}")
    return source.replace(old, new, 1)


# Split the cloud Dashboard indicator into exact OpenAI and MiniMax links.
path = "app/setup-connections-dashboard.tsx"
source = read(path)
source = replace_once(
    source,
    '''    const savedAi = connectionStatus.items.ai;
    const cloudProviderSelected = !/ollama|lm studio|local|manual|disabled|no ai/i.test(savedAi.identity);
    const cloudAi: SetupConnection = cloudProviderSelected ? savedAi : {
      ...savedAi,
      state: "disconnected",
      identity: "No cloud provider selected",
      detail: "A local provider is selected. Cloud generation remains off unless the writer deliberately configures it.",
      lastSuccessfulConnection: "",
    };
''',
    '''    const savedAi = connectionStatus.items.ai;
    const providerConnection = (provider: "openai" | "minimax", label: string): SetupConnection =>
      savedAi.identity.toLowerCase().includes(provider) ? savedAi : {
        ...savedAi,
        state: "disconnected",
        identity: `No ${label} provider selected`,
        detail: `${label} remains optional until its own Settings section is configured and tested.`,
        lastSuccessfulConnection: "",
      };
    const openai = providerConnection("openai", "OpenAI");
    const minimax = providerConnection("minimax", "MiniMax");
''',
    "cloud provider status split",
)
source = replace_once(
    source,
    '''        rows: [
          rowFromConnection(cloudAi, {
            id: "cloud-ai",
            label: "Cloud images & video · OpenAI, MiniMax or another provider",
            requirement: "Optional",
            detail: `${cloudAi.detail} Cloud image generation · OpenAI or another provider remains supported, while MiniMax adds image-01 and H3 video. ChatGPT Plus does not include OpenAI API usage; API keys and billing are separate.`,
            settingsSection: "ai",
            links: [
              { label: "Create OpenAI API key", href: OPENAI_KEYS_URL },
              { label: "OpenAI API billing", href: OPENAI_BILLING_URL },
              { label: "OpenAI API quickstart", href: OPENAI_QUICKSTART_URL },
              { label: "Create MiniMax API key", href: MINIMAX_KEYS_URL },
              { label: "MiniMax pricing", href: MINIMAX_PRICING_URL },
              { label: "MiniMax H3 video guide", href: MINIMAX_H3_URL },
            ],
          }),
        ],
''',
    '''        rows: [
          rowFromConnection(openai, {
            id: "openai",
            label: "Cloud writing & images · OpenAI",
            requirement: "Optional",
            detail: `${openai.detail} ChatGPT Plus does not include OpenAI API usage; the API account and billing are separate.`,
            settingsSection: "openai",
          }),
          rowFromConnection(minimax, {
            id: "minimax",
            label: "Cloud text, images & H3 video · MiniMax",
            requirement: "Optional",
            detail: `${minimax.detail} MiniMax uses the writer's own account and requires explicit consent before paid image or video tests.`,
            settingsSection: "minimax",
          }),
        ],
''',
    "cloud dashboard rows",
)
source = replace_once(
    source,
    '          <span>A car-dashboard view of PlotPickle. Green is ready, yellow needs setup or testing, and red means a previously working component has failed. Open the exact Settings section to make changes.</span>',
    '          <span>PlotPickle works locally without any optional account. This is a read-only car-dashboard view: green is ready, yellow needs setup or testing, and red means a previously working component has failed. Open the exact Settings section to make changes.</span>',
    "dashboard header copy",
)
write(path, source)

# Preserve the locked planning vocabulary while adding independent component destinations.
path = "config/settings-system-taxonomy.json"
taxonomy = json.loads(read(path))
for system in taxonomy["systems"]:
    for item in system["items"]:
        if item["id"] == "local-ollama":
            item["mechanics"] = [
                "Status",
                "Model selection",
                "Test response",
                "Repair guidance",
                "Prompting",
                "Tokens",
                "GGUF",
                "EXL2",
            ]
        elif item["id"] == "cloud-openai":
            item["mechanics"] = [
                "Status",
                "Configuration",
                "Test/update",
                "Repair guidance",
                "TTFT monitoring",
            ]
write(path, json.dumps(taxonomy, indent=2, ensure_ascii=False) + "\n")

# Update legacy taxonomy contracts for the new honest Settings surfaces.
path = "tests/settings-system-taxonomy.test.mjs"
source = read(path)
source = replace_once(
    source,
    '  const allowedTargets = new Set(["general", "appearance", "project-defaults", "storage", "ai", "github", "plugins", "google", "buzz", "privacy", "about", "sitemap"]);',
    '  const allowedTargets = new Set(["general", "appearance", "project-defaults", "storage", "ai", "github", "plugins", "google", "buzz", "privacy", "about", "sitemap", "ollama", "openai", "minimax", "comfyui"]);',
    "taxonomy target allow-list",
)
write(path, source)

# Align old Dashboard tests with the read-only component split.
path = "tests/issue-256-setup-connections-dashboard.test.mjs"
source = read(path)
source = source.replace(
    '    "Cloud images & video · OpenAI, MiniMax or another provider",\n',
    '    "Cloud writing & images · OpenAI",\n    "    Cloud text, images & H3 video · MiniMax",\n',
    1,
)
source = replace_once(
    source,
    '  for (const target of ["ollama", "comfyui", "github", "google", "buzz", "storage"]) {',
    '  for (const target of ["ollama", "openai", "minimax", "comfyui", "github", "google", "buzz", "storage"]) {',
    "Dashboard Settings targets",
)
write(path, source)

path = "tests/issue-258-creative-compute-paths.test.mjs"
source = read(path)
source = source.replace('    "Test all connections",\n', '', 1)
write(path, source)

# Strengthen the new regression so each cloud card links to its exact section.
path = "tests/issue-333-dashboard-settings-separation.test.mjs"
source = read(path)
source = replace_once(
    source,
    '  assert.match(dashboard, /Open settings/);\n',
    '  assert.match(dashboard, /Open settings/);\n  assert.match(dashboard, /settingsSection: "openai"/);\n  assert.match(dashboard, /settingsSection: "minimax"/);\n',
    "exact cloud Dashboard links",
)
write(path, source)

print("Issue #333 follow-up fixes applied")
