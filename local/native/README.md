# Native launcher wrappers

These wrappers are the source layer for polished public launchers. They all start the same localhost-only PHP runtime and open `http://127.0.0.1:48721`.

## Windows

`windows/PlotPickle.ps1` is suitable for packaging into `PlotPickle.exe` with a trusted PowerShell-to-EXE build step or replacing with a small signed native launcher later.

## macOS

`macos/PlotPickle` is the executable script placed inside `PlotPickle.app/Contents/MacOS/PlotPickle`. The final app bundle also requires an `Info.plist`, icon, Developer ID signature, and notarization.

## Linux

`linux/plotpickle` is the executable entry point for an AppDir/AppImage package.

The repository intentionally does not commit third-party PHP binaries, signing certificates, or notarization credentials.
