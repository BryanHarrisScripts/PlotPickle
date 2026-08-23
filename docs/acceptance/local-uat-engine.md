# Local UAT engine

The Windows acceptance runner defaults to the local engine. It uses the PlotPickle Agent Plugin's Playwright MCP server and does not require Codex or ChatGPT usage quota.

Run the same default directly with:

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/run-local-uat.ps1 -BaseUrl http://127.0.0.1:4173 -Scope smoke`

Run the optional Codex exploratory engine with:

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/run-local-uat.ps1 -BaseUrl http://127.0.0.1:4173 -Scope smoke -Engine codex`

When Ollama is already running, the local engine looks for an installed instruction model between roughly 3B and 32B parameters and may use it to review deterministic browser evidence. Set `PLOTPICKLE_UAT_OLLAMA_MODEL` to force a particular installed model. Ollama review is advisory and is skipped when unavailable.
