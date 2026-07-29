
# Windows “Unknown Publisher” warning

`Start-PlotPickle.bat` is a readable Windows batch launcher, not a signed executable. Windows may attach **Mark of the Web** to a downloaded ZIP and every extracted file, producing an **Unknown Publisher** warning even when the files came from the official PlotPickle repository.

## Safest fix for the downloaded ZIP

1. Delete the already extracted PlotPickle folder.
2. Right-click the original PlotPickle ZIP and choose **Properties**.
3. On the **General** tab, check **Unblock** near the bottom.
4. Choose **Apply**, then **OK**.
5. Extract the ZIP again and run `Start-PlotPickle.bat`.

This removes the download-zone flag before Windows copies it to every extracted file.

## Fix an existing extracted folder

Open PowerShell in the parent folder and run:

```powershell
Get-ChildItem -LiteralPath ".\\PlotPickle-main" -Recurse -File | Unblock-File
```

Change the folder name if required. Do not disable Windows Security globally and do not run unknown copies from untrusted sources.

## Why it does not show Bryan Harris as publisher

Windows displays a verified publisher only when the launched application has an Authenticode signature chained to a trusted code-signing certificate. A `.bat` file cannot carry the same signed-publisher experience as a signed `.exe`, MSIX or installer package.

The long-term product fix is a signed launcher or installer using an organization-validated or extended-validation code-signing certificate. Until that release exists, verify that the ZIP came from the official PlotPickle GitHub repository, unblock the ZIP before extraction, and inspect the readable batch file when desired.
