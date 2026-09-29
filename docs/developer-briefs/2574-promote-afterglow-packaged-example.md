# #2574 — Promote current local Afterglow into the packaged GitHub example

## Purpose

Keep the immutable `afterglow-v9-complete-baseline` as source evidence, while allowing a Human-approved current PlotPickle working state to become the example that every clean install receives.

The promoted example is a normal repository snapshot plus normal repository media files. **Do not use base64/data URLs.** Do not commit profile-private storage, local machine paths, credentials, caches, or `/api/local-ai/assets/...` URLs into the packaged snapshot.

## Repository outputs

The promotion command writes only reviewable repository artifacts:

- `data/afterglow-packaged-current/snapshot.json`
- `data/afterglow-packaged-current/manifest.json`
- `public/assets/library/examples/afterglow/current/**`

Local preparation files stay ignored:

- `data/afterglow-packaged-current/input.local.ppf.json`
- `data/afterglow-packaged-current/asset-map.local.json`

## Windows promotion procedure

### 1. Confirm the Afterglow state you want to publish

Open your profile-local Afterglow and confirm the story state you want new users to receive. For generated media, Save and Lock the approved versions first.

### 2. Export the current story

In PlotPickle:

`Library → Import Export → Export story`

PlotPickle downloads a `.ppf.json` Library backup. Local image bytes remain separate.

From the PlotPickle repo in PowerShell, copy the export into the ignored promotion input path:

```powershell
Copy-Item "$HOME\Downloads\afterglow-reflections-of-sentience.ppf.json" ".\data\afterglow-packaged-current\input.local.ppf.json"
```

If the browser used a different filename, substitute that filename.

### 3. Generate the local-asset mapping template

PlotPickle's generated media lives under:

```text
%LOCALAPPDATA%\PlotPickle\assets
```

Generate a mapping template from every `/api/local-ai/assets/...` URL referenced by the exported Afterglow project:

```powershell
npm run afterglow:package-example -- --project ".\data\afterglow-packaged-current\input.local.ppf.json" --scan |
  Set-Content -Encoding utf8 ".\data\afterglow-packaged-current\asset-map.local.json"
```

The generated map contains:

- `sourceUrl`: the saved PlotPickle local asset URL;
- `sourceFile`: the expected file under `%LOCALAPPDATA%\PlotPickle\assets`;
- `target`: the repository-relative destination under the packaged Afterglow asset directory.

You may edit `target` to organize files into clearer folders such as:

```text
characters/ren/generation-1/front.webp
characters/ren/generation-1/right-45.webp
characters/amy/generation-1/front.webp
characters/summer/generation-1/front.webp
posters/poster-01.webp
storyboard/block-01/mini-01/shot-01.webp
```

Do not change `sourceUrl` unless the exported project itself points somewhere else.

### 4. Validate without writing

Run a check-only promotion first:

```powershell
npm run afterglow:package-example -- `
  --project ".\data\afterglow-packaged-current\input.local.ppf.json" `
  --asset-map ".\data\afterglow-packaged-current\asset-map.local.json"
```

Validation fails if the input is not the Afterglow project rooted in `afterglow-v9-complete-baseline`, if a base64/data URL is present, if a local asset is unmapped, if targets collide or escape the approved root, or if a mapped source file cannot be read during the write pass.

### 5. Generate the packaged snapshot and copy media

When validation passes:

```powershell
npm run afterglow:package-example -- `
  --project ".\data\afterglow-packaged-current\input.local.ppf.json" `
  --asset-map ".\data\afterglow-packaged-current\asset-map.local.json" `
  --write
```

The command copies mapped image files into:

```text
public/assets/library/examples/afterglow/current/
```

It rewrites promoted media references to:

```text
/assets/library/examples/afterglow/current/...
```

The original local URLs and local filesystem paths are not written into the packaged snapshot.

### 6. Review before committing

```powershell
git status --short
git diff -- data/afterglow-packaged-current
```

Review the copied files under `public/assets/library/examples/afterglow/current/` as normal files. Do not commit the ignored local input or local mapping.

Run the focused regression:

```powershell
node --test tests/issue-2574-afterglow-packaged-promotion.test.mjs
```

Then run the normal changed-code/local gates before creating the promotion PR.

## Runtime behavior

- Before a promoted snapshot exists, **Open Example** falls back to the deterministic v9/Foundations reference.
- After the generated snapshot is committed with `status: "promoted"`, **Open Example** loads that full current packaged state.
- The original v9 screenplay/source identity remains unchanged as evidence.
- **Open Example with Your Changes** remains profile-local.
- Local media whose byte hashes are already in the packaged manifest are ignored during restore, preventing the same promoted image bytes from being re-attached under their old local URLs.

## Promotion discipline

Treat promotion as an explicit release action. A local experiment does not become the shared example merely because it was Saved or Locked. The Human first decides that the local Afterglow state is suitable as the new packaged example, then exports and promotes that state through this command.
