# PlotPickle / BUZZ one-time Community setup

On Windows, double-click `Setup-PlotPickle-BUZZ.cmd` from the PlotPickle folder.

The launcher first prints the channel and Agent plan without writing anything. When you confirm, it asks for the intended BUZZ relay and your Human/admin BUZZ private key using a hidden prompt. It then:

1. Finds the BUZZ CLI installed with BUZZ Desktop.
2. Creates only missing PlotPickle Guildhall channels; existing channels are kept.
3. Discovers existing PlotPickle Agent identities owned by the BUZZ account.
4. Adds each discovered Agent to the rooms contributed by the active PlotPickle Community plugin, with the BUZZ `bot` role.
5. Verifies every membership after writing it.

BUZZ-native Agent creation retains BUZZ's owner-review boundary. If an Agent does not exist, the launcher can also request the separate BUZZ owner/provisioner credential and `BUZZ_AUTH_TAG`, then open an owner-reviewed Agent draft. Approve those drafts in BUZZ Desktop and rerun the launcher once; the rerun discovers the approved identities and completes their room memberships.

The Human key is used for channel administration and membership only. PlotPickle Agents never sign or speak with the Human key. Credentials are passed to child processes through the current process environment and cleared in a `finally` block. They are not accepted as command-line arguments, printed, or written to source/configuration files.

For a read-only plan from PowerShell:

```powershell
.\scripts\setup-buzz-community.ps1 -PlanOnly
```

To supply a non-standard BUZZ executable:

```powershell
.\scripts\setup-buzz-community.ps1 -BuzzCli "C:\Tools\BUZZ\buzz.exe"
```
