# PlotPickle licence scope

Copyright © 2026 Bryan Harris and PlotPickle contributors.

This file explains which licence applies to each category of material in the PlotPickle repository. It is a practical scope notice and does not replace the complete licence texts.

## 1. Software code — GNU AGPLv3 or later

Unless a file states otherwise, PlotPickle software is licensed under the **GNU Affero General Public License, version 3 or any later version** (`AGPL-3.0-or-later`).

This includes application source code, local-server code, launchers, update and repair scripts, build scripts, tests, schema-processing code, and software-specific interface components.

The complete AGPLv3 text is included in the repository as `LICENSE` and is also available from the GNU Project.

### Network use

A modified PlotPickle version made available to users through a computer network must prominently offer those users the corresponding source code for the modified version at no charge, as required by AGPLv3 section 13.

Server operators must also preserve applicable copyright, licence, attribution, modification, and warranty notices.

## 2. Method and documentation — CC BY-SA 4.0

Unless a file states otherwise, the written 24 Blocks method, educational explanations, diagrams, documentation, architecture notes, and reusable non-software instructional material are licensed under the **Creative Commons Attribution-ShareAlike 4.0 International licence** (`CC BY-SA 4.0`).

A person adapting or redistributing that material must:

- provide appropriate credit;
- provide a link to the CC BY-SA 4.0 licence;
- indicate whether changes were made;
- retain an indication of previous modifications where applicable; and
- distribute adapted material under CC BY-SA 4.0 or a compatible ShareAlike licence.

## 3. User-created stories are excluded

The PlotPickle software and documentation licences do **not** claim ownership of user-created material.

Humans retain any copyright and other rights they hold in:

- stories and screenplays;
- characters and worlds;
- dialogue and scene text;
- research and notes;
- uploaded or linked images;
- PPF projects and other exported project files; and
- other creative output.

Using PlotPickle does not transfer that material to Bryan Harris, PlotPickle, a contributor, or a server operator.

PlotPickle does not determine or promise whether any particular material, including AI-assisted output, qualifies for copyright protection. Provider terms, source material, collaboration agreements, Human authorship, and applicable law may affect the rights available in a specific output.

## 4. Contributions

Contributors retain copyright in their original contributions.

By knowingly submitting a contribution for inclusion in PlotPickle, a contributor agrees to license:

- software contributions under `AGPL-3.0-or-later`; and
- documentation, diagrams, and method contributions under `CC BY-SA 4.0`.

A contributor owns their contribution, not the entire combined project. Attribution may be recorded through Git history, release notes, acknowledgements, or another reasonable method.

See `CONTRIBUTING.md` for the contribution terms.

## 5. Brand and trademarks

The PlotPickle name, PlotPickle Playhouse name, logos, and identifying brand assets are not licensed for misleading endorsement, impersonation, or presenting a modified edition as the official edition.

Modified public editions should be clearly identified as modified and should not imply sponsorship or approval by Bryan Harris or the official PlotPickle project.

See `TRADEMARKS.md`.

## 6. Third-party material

Third-party dependencies, fonts, images, sample content, and other included material remain subject to their own copyright notices and licences. Their inclusion does not change those terms.

PlotPickle's Auth cryptographic contract uses `libsodium-wrappers-sumo` and its `libsodium-sumo` runtime under the ISC licence. That permissive licence is compatible with distribution in the AGPL-licensed application; the upstream copyright and licence notices remain applicable.

The direct JavaScript runtime dependencies declared for the current release use Apache-2.0, ISC, or MIT licences as recorded in `package-lock.json`. Development dependencies use Apache-2.0, MIT, or the `MIT OR Apache-2.0` expression recorded there. Transitive packages remain governed by their own package metadata and included notices.

The optional pinned BUZZ runtime bundle retains its separate upstream notice in `runtime/buzz/LICENSE.buzz.txt`.

## 7. No warranty and no legal advice

PlotPickle is provided without warranty to the extent permitted by the applicable licences and law.

This scope summary is not legal advice. Specific contributor agreements, commercial deployments, hosted services, trademark questions, or jurisdiction-specific concerns should be reviewed by a qualified intellectual-property professional.
