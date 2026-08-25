import Link from "next/link";
import styles from "./legal.module.css";

const sourceRepository = "https://github.com/BryanHarrisScripts/PlotPickle";
const agplLicense = "https://www.gnu.org/licenses/agpl-3.0.html";
const creativeCommonsLicense = "https://creativecommons.org/licenses/by-sa/4.0/";

const legalSections = [
  ["#ownership", "Your work"],
  ["#software", "Software"],
  ["#privacy", "Privacy"],
  ["#community", "Community"],
  ["#hosting", "Server operators"],
  ["#legal-help", "Help"],
] as const;

export default function LegalPage() {
  return (
    <>
      <a className={styles.skipLink} href="#legal-main">Skip to main content</a>
      <main className={`${styles.page} standalone-studio-surface`} id="legal-main" tabIndex={-1}>
        <header className={styles.header}>
          <Link href="/?workspace=settings" className={styles.backLink}>← Back to Settings</Link>
          <p className={styles.eyebrow}>Copyright, licensing, and ownership</p>
          <h1>Open software. Shared method. Your story remains yours.</h1>
          <p>
            PlotPickle is officially distributed as a downloadable local-server application. A local Human profile requires no email, phone number, PlotPickle cloud account, BUZZ identity, GitHub account, or Google account. Optional external connections act only when the Human deliberately configures and uses them.
          </p>
        </header>

        <nav className={styles.sectionNav} aria-label="Licensing page sections">
          {legalSections.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
        </nav>

        <section className={styles.notice} aria-label="Legal notice">
          <strong>Copyright © 2026 Bryan Harris and PlotPickle contributors.</strong>
          <span>PlotPickle software is provided without warranty under the GNU Affero General Public License version 3 or later.</span>
          <div>
            <a href={sourceRepository} target="_blank" rel="noreferrer" aria-label="Corresponding source (opens in a new tab)">Corresponding source</a>
            <a href={agplLicense} target="_blank" rel="noreferrer" aria-label="AGPLv3 licence (opens in a new tab)">AGPLv3 licence</a>
            <a href={creativeCommonsLicense} target="_blank" rel="noreferrer" aria-label="CC BY-SA 4.0 licence (opens in a new tab)">CC BY-SA 4.0 licence</a>
            <a href={`${sourceRepository}/blob/main/PRIVACY.md`} target="_blank" rel="noreferrer" aria-label="Privacy Notice (opens in a new tab)">Privacy Notice</a>
            <a href={`${sourceRepository}/blob/main/COMMUNITY_GUIDELINES.md`} target="_blank" rel="noreferrer" aria-label="Community Guidelines (opens in a new tab)">Community Guidelines</a>
          </div>
        </section>

        <div className={styles.grid}>
          <section id="ownership">
            <span>01</span>
            <h2>User stories and project files</h2>
            <p>
              Humans retain any copyright and other rights they hold in their stories, characters, dialogue, images, research, notes, PPF projects, and exports. Using PlotPickle does not transfer ownership of that material to Bryan Harris, PlotPickle, a server operator, or a contributor.
            </p>
            <p>
              The PlotPickle software licences do not automatically apply to creative output merely because it was created, stored, imported, or exported through the application. PlotPickle does not decide or promise whether any particular work, including AI-assisted output, qualifies for copyright protection.
            </p>
          </section>

          <section id="software">
            <span>02</span>
            <h2>PlotPickle software code</h2>
            <p>
              The application source code, build scripts, local launcher, updater, server code, and software-specific interface components are licensed under the <strong>GNU Affero General Public License, version 3 or any later version</strong>.
            </p>
            <p>
              People may run, study, copy, modify, and redistribute the software under that licence. Distributed modified versions must remain under the same software licence and preserve required notices.
            </p>
          </section>

          <section id="hosting">
            <span>03</span>
            <h2>Operator-run server mode</h2>
            <p>
              The software includes an advanced <code>server-network</code> mode for an operator who deliberately configures trusted HTTPS, exact Host and Origin allowlists, the intended bind address, trusted-proxy handling, and the first-profile bootstrap boundary. The official project does not provide a hosted PlotPickle SaaS or promise compatibility with a particular hosting control panel or CMS.
            </p>
            <p>
              An operator is responsible for deployment security and for accurate privacy, retention, deletion, support, and jurisdiction terms for that service. When a modified PlotPickle version is made available over a network, its users must be offered the corresponding source code as required by AGPLv3 section 13.
            </p>
          </section>

          <section>
            <span>04</span>
            <h2>24 Blocks method and documentation</h2>
            <p>
              The written 24 Blocks method, explanatory documentation, diagrams, educational descriptions, and reusable non-software instructional material identified by PlotPickle are licensed under <strong>Creative Commons Attribution-ShareAlike 4.0 International</strong>, unless a file states otherwise.
            </p>
            <p>
              Adaptations must provide appropriate credit, link to the licence, identify changes, and distribute the adapted instructional material under the same or a compatible ShareAlike licence.
            </p>
          </section>

          <section>
            <span>05</span>
            <h2>Contributions</h2>
            <p>
              Contributors retain copyright in their original contributions. By knowingly submitting code, they agree to license that contribution under AGPL-3.0-or-later. By submitting documentation or method material, they agree to license that contribution under CC BY-SA 4.0.
            </p>
            <p>
              A contributor owns their contribution, not the entire combined PlotPickle project. Git history, release notes, and contributor records may be used to provide attribution.
            </p>
          </section>

          <section>
            <span>06</span>
            <h2>Brand and third-party material</h2>
            <p>
              The PlotPickle name, PlotPickle Playhouse name, logos, and identifying brand assets are not granted for misleading endorsement or for presenting a modified version as the official edition. Modified public versions should be clearly identified as modified.
            </p>
            <p>
              Third-party libraries, fonts, images, and other included material remain subject to their own licences and notices.
            </p>
          </section>

          <section id="privacy">
            <span>07</span>
            <h2>Local-first privacy</h2>
            <p>
              Human profiles, private projects, LEARN answers, PLAN decisions, BUILD artifacts, credentials, and local files stay within the selected PlotPickle Node by default. Local storage and backups are controlled by the Human&apos;s computer account and configured retention settings; archiving is not deletion.
            </p>
            <p>
              A deliberate BUZZ post, cloud-AI request, GitHub action, Google action, or manual export sends only the content selected for that action to the chosen external service. That service&apos;s own privacy and retention terms then apply. PlotPickle does not silently upload a project or silently fall back from local AI to a paid cloud route.
            </p>
          </section>

          <section id="community">
            <span>08</span>
            <h2>BUZZ Community conduct</h2>
            <p>
              PlotPickle is a storytelling environment. Fictional, historical, educational, or analytical discussion may include difficult subjects and is not misconduct merely because it contains a sensitive word. Real-world harassment, credible threats, operational harm instructions, privacy violations, credential sharing, and deliberate disruption are not acceptable.
            </p>
            <p>
              Merrin Bellwarden may welcome, redirect, de-escalate, make a supportive safety intervention, or surface a concern for Human review. Merrin cannot delete messages, ban or block members, alter permissions, investigate people, read private project state, or make a final enforcement decision.
            </p>
          </section>
        </div>

        <section className={styles.operatorChecklist} id="operators">
          <div>
            <p className={styles.eyebrow}>Server operator checklist</p>
            <h2>Before making an operator-run edition available</h2>
          </div>
          <ol>
            <li>Keep the copyright, licence, warranty, and attribution notices visible.</li>
            <li>Clearly identify modifications and the date or version of those changes.</li>
            <li>Provide remote users with a working source-code link when the hosted version is modified.</li>
            <li>Keep modified software under AGPL-3.0-or-later.</li>
            <li>Keep adapted instructional material under CC BY-SA 4.0 and provide attribution.</li>
            <li>Do not claim ownership of user-created stories or imply official endorsement of a modified edition.</li>
            <li>Publish privacy and service terms that match the operator&apos;s real storage, backup, access, retention, deletion, support, and jurisdiction practices.</li>
          </ol>
        </section>

        <section className={styles.helpPanel} id="legal-help" aria-labelledby="legal-help-title">
          <div>
            <p className={styles.eyebrow}>Questions or problems</p>
            <h2 id="legal-help-title">Use the right support path</h2>
            <p>Use Suggest / Report for a product or documentation problem. Use the Community&apos;s available report or block path for conduct concerns. Questions involving a particular business, contributor agreement, commercial deployment, privacy obligation, or jurisdiction should be reviewed by a qualified professional.</p>
          </div>
          <div>
            <Link className={styles.primaryAction} href="/suggest-report">Open Suggest / Report</Link>
            <Link href="/about">Return to About PlotPickle</Link>
          </div>
        </section>

        <footer className={styles.footer}>
          <strong>This page is a practical project summary, not legal advice.</strong>
          <p>Licensing, privacy, platform, and Community questions involving a particular business, deployment, or jurisdiction should be reviewed by an appropriately qualified professional.</p>
          <div>
            <a href={sourceRepository} target="_blank" rel="noreferrer" aria-label="Source repository (opens in a new tab)">Source repository</a>
            <a href={`${sourceRepository}/blob/main/LICENSES.md`} target="_blank" rel="noreferrer" aria-label="Licence scope file (opens in a new tab)">Licence scope file</a>
            <a href={`${sourceRepository}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer" aria-label="Contribution terms (opens in a new tab)">Contribution terms</a>
          </div>
        </footer>
      </main>
    </>
  );
}
