# PlotPickle / BUZZ one-time Community setup

On Windows, double-click `Sync-PlotPickle-BUZZ.cmd` from the PlotPickle folder. The original `Setup-PlotPickle-BUZZ.cmd` remains as a compatible entry point to the same safe sync.

The launcher first prints the channel and Agent plan without writing anything. When you confirm, it asks for the intended BUZZ relay and your Human/admin BUZZ private key using a hidden prompt. It then:

1. Finds the BUZZ CLI installed with BUZZ Desktop.
2. Creates only missing PlotPickle Guildhall channels; existing channels are kept.
3. Discovers existing PlotPickle Agent identities owned by the BUZZ account, including BUZZ's single-record response shape.
4. Creates one `PlotPickle-BUZZ-Missing-Agents.team.json` import containing only missing Agents, with their exact names, system prompts, public bios and embedded PlotPickle lore avatars.
5. Adds each discovered Agent to the rooms contributed by the active PlotPickle Community plugin, with the BUZZ `bot` role.
6. Verifies every membership after writing it.

When Agents are missing, open BUZZ Desktop, choose **Agents → Import Team**, select the generated file shown by the launcher, and approve the import once. BUZZ Desktop mints a separate key and owner authorization for every imported Agent, stores those secrets in its protected local credential boundary, and publishes the Agent avatars. Rerun the sync once after import; it discovers the approved identities and completes their room memberships.

The Human key is used for channel administration and membership only. PlotPickle Agents never sign or speak with the Human key. The relay supplies public profiles and ownership proofs, never private keys. The Human credential is passed to child processes through the current process environment and cleared in a `finally` block. It is not accepted as a command-line argument, printed, or written to source/configuration files. The generated team import contains no credentials, memory or Human profile data.

For a read-only plan from PowerShell:

```powershell
.\scripts\setup-buzz-community.ps1 -PlanOnly
```

To supply a non-standard BUZZ executable:

```powershell
.\scripts\setup-buzz-community.ps1 -BuzzCli "C:\Tools\BUZZ\buzz.exe"
```
