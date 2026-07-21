# PlotPickle Local

PlotPickle Local is the portable, private edition of PlotPickle Playhouse. It opens in your browser but runs entirely from the folder on your computer.

## Windows quick start

1. Download `PlotPickle-Windows.zip` from the [latest PlotPickle release](https://github.com/BryanHarrisScripts/PlotPickle/releases/latest).
2. Choose **Extract all**. Do not run PlotPickle from inside the ZIP.
3. Open the extracted `PlotPickle-Windows` folder.
4. Double-click `START-PLOTPICKLE.bat`.
5. Keep the PlotPickle Local Server window open while using the app.
6. Close that window when you are finished.

The Windows ZIP contains the application and its own verified PHP runtime. You do not install PHP, Node.js, or any developer tools.

## Where your work is saved

```text
PlotPickle-Windows/
├── START-PLOTPICKLE.bat
├── README-FIRST.txt
├── data/
│   ├── projects/
│   └── backups/
├── runtime/
├── server/
└── web/
```

Current project files are stored in `data/projects`. Timestamped safety copies are stored in `data/backups`, with the newest 20 backups kept for each project.

When updating PlotPickle:

1. Close the server window.
2. Extract the fresh ZIP into a new folder.
3. Copy the entire `data` folder from the old PlotPickle folder into the new one.
4. Start the new copy.

Do not delete the old folder until you have confirmed that your projects appear in the fresh copy.

## What the server window does

The server window runs a private local address: `http://127.0.0.1:48721`. It must stay open while PlotPickle is running. Server activity and useful error messages appear there. Closing the window safely stops the local edition.

The server listens only on `127.0.0.1`; it is not exposed to your local network or the internet.

## Troubleshooting

If PlotPickle does not open automatically, leave the server window open and visit `http://127.0.0.1:48721` in your browser.

If Windows says files are missing, confirm that you extracted the complete ZIP instead of opening the launcher inside the compressed folder.

If a previous PlotPickle server is already running, close its server window before launching the new copy.

## Technical details

The local runtime provides health, project-list, project-load, and project-save endpoints. Saves use a temporary file and atomic rename, and existing projects receive rolling timestamped backups.

The same canonical `.plotpickle.json` schema powers the hosted and local editions. The local runtime bridge restores the newest disk project and mirrors browser autosaves into real project files.

## Building from source

```bash
npm ci
npm run build:local
npm run package:local
```

To provide a bundled runtime during manual packaging, set `PLOTPICKLE_WINDOWS_PHP_DIR` to a complete Windows PHP runtime folder. GitHub Actions uses `scripts/fetch-windows-php.sh` to download and verify the approved Windows runtime automatically.

Security requirements:

- Keep the server bound to `127.0.0.1`, never `0.0.0.0`.
- Keep API keys out of browser bundles and release archives.
- Preserve filename sanitization, restricted static-file reads, atomic saves, and rolling backups.
