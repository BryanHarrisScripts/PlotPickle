# PlotPickle / BUZZ one-time Community setup

On Windows, double-click `Sync-PlotPickle-BUZZ.cmd` from the PlotPickle folder. The original `Setup-PlotPickle-BUZZ.cmd` remains as a compatible entry point to the same safe sync.

The launcher first prints the channel and Agent plan without writing anything. When you confirm, it asks for the intended BUZZ relay and your Human/admin BUZZ private key using a hidden prompt. It then:

1. Finds the BUZZ CLI installed with BUZZ Desktop.
2. Creates only missing Human-purpose Community rooms from this four-room set: Great Hall, Story Workshop, Wyrmwood and Marquee. Existing matching rooms are kept.
3. Discovers existing PlotPickle Agent identities owned by the BUZZ account, including BUZZ's single-record response shape.
4. Creates one `PlotPickle-BUZZ-Missing-Agents.team.json` import containing only missing Agents, with their exact names, system prompts, public bios and embedded official PlotPickle painterly avatars.
5. Adds each discovered Agent only to the public rooms contributed by the active PlotPickle Community plugin, with the BUZZ `bot` role.
6. Verifies every membership after writing it.

When Agents are missing, open BUZZ Desktop, choose **Agents → Import Team**, select the generated file shown by the launcher, and approve the import once. BUZZ Desktop mints a separate key and owner authorization for every imported Agent, stores those secrets in its protected local credential boundary, and publishes the Agent avatars. Rerun the sync once after import; it discovers the approved identities and completes their room memberships.

## Correcting avatars on Agents that already exist

Do not import the team again to change an existing Agent's image. BUZZ snapshot import always mints a new identity, so a second import would create duplicates.

The launcher detects existing PlotPickle Agents and prints the exact named WebP for each one. Type `OPEN` when prompted to open `public\assets\helpers\official`. In BUZZ Desktop, open **Agents**, edit the matching Persona/Profile, choose that Agent's named WebP, and save. BUZZ Desktop owns the managed Agent's private key and publishes the corrected profile on the same identity; PlotPickle never reads or copies that key.

This small Desktop confirmation is required because the current BUZZ CLI can update an Agent draft's instructions and runtime settings, but it does not expose managed Persona avatar edits. The supported Desktop edit automatically propagates the Persona image to its linked Agent instances.

The Human key is used for channel administration and membership only. PlotPickle Agents never sign or speak with the Human key. The relay supplies public profiles and ownership proofs, never private keys. The Human credential is passed to child processes through the current process environment and cleared in a `finally` block. It is not accepted as a command-line argument, printed, or written to source/configuration files. The generated team import contains no credentials, memory or Human profile data.

To inspect or archive the nine retired machine-generated rooms, use `Utilities\Clean-PlotPickle-BUZZ.cmd`. Run its PLAN mode first. The normal sync never recreates those retired rooms.

For a read-only plan from PowerShell:

```powershell
.\scripts\setup-buzz-community.ps1 -PlanOnly
```

To supply a non-standard BUZZ executable:

```powershell
.\scripts\setup-buzz-community.ps1 -BuzzCli "C:\Tools\BUZZ\buzz.exe"
```
