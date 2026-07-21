import Link from "next/link";
import styles from "./legal.module.css";

const sourceRepository = "https://github.com/BryanHarrisScripts/PlotPickle";
const agplLicense = "https://www.gnu.org/licenses/agpl-3.0.html";
const creativeCommonsLicense = "https://creativecommons.org/licenses/by-sa/4.0/";

export default function LegalPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>← Return to PlotPickle</Link>
        <p className={styles.eyebrow}>Copyright, licensing, and ownership</p>
        <h1>Open software. Shared method. Your story remains yours.</h1>
        <p>
          PlotPickle is officially distributed as a downloadable local-server application. People may also run an unmodified or modified server edition, including on compatible Plesk or WordPress infrastructure, provided they follow the applicable software, content, attribution, and source-availability terms below.
        </p>
      </header>

      <section className={styles.notice} aria-label="Legal notice">
        <strong>Copyright © 2026 Bryan Harris and PlotPickle contributors.</strong>
        <span>PlotPickle software is provided without warranty under the GNU Affero General Public License version 3 or later.</span>
        <div>
          <a href={sourceRepository} target="_blank" rel="noreferrer">Corresponding source</a>
          <a href={agplLicense} target="_blank" rel="noreferrer">AGPLv3 licence</a>
          <a href={creativeCommonsLicense} target="_blank" rel="noreferrer">CC BY-SA 4.0 licence</a>
        </div>
      </section>

      <div className={styles.grid}>
        <section>
          <span>01</span>
          <h2>User stories and project files</h2>
          <p>
            Users retain copyright and all other rights they hold in their original stories, characters, dialogue, images, research, notes, and exported <code>.plotpickle.json</code> project files. Using PlotPickle does not transfer ownership of that material to Bryan Harris, PlotPickle, a server operator, or a contributor.
          </p>
          <p>
            The PlotPickle software licences do not automatically apply to a user’s creative output merely because it was created, stored, imported, or exported through the application.
          </p>
        </section>

        <section>
          <span>02</span>
          <h2>PlotPickle software code</h2>
          <p>
            The application source code, build scripts, local launcher, updater, server code, and software-specific interface components are licensed under the <strong>GNU Affero General Public License, version 3 or any later version</strong>.
          </p>
          <p>
            People may run, study, copy, modify, and redistribute the software under that licence. Distributed modified versions must remain under the same software licence and preserve required notices.
          </p>
        </section>

        <section>
          <span>03</span>
          <h2>Server and network editions</h2>
          <p>
            Self-hosting is allowed. A person or organization may install PlotPickle on compatible hosting, including a private server, Plesk environment, or a WordPress-connected architecture.
          </p>
          <p>
            When a modified PlotPickle version is made available to users over a network, those users must be prominently offered the corresponding source code for the modified version at no charge, as required by AGPLv3 section 13. The source offer must be practical and accessible to the users of that server.
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
      </div>

      <section className={styles.operatorChecklist}>
        <div>
          <p className={styles.eyebrow}>Server operator checklist</p>
          <h2>Before making a hosted edition available</h2>
        </div>
        <ol>
          <li>Keep the copyright, licence, warranty, and attribution notices visible.</li>
          <li>Clearly identify modifications and the date or version of those changes.</li>
          <li>Provide remote users with a working source-code link when the hosted version is modified.</li>
          <li>Keep modified software under AGPL-3.0-or-later.</li>
          <li>Keep adapted instructional material under CC BY-SA 4.0 and provide attribution.</li>
          <li>Do not claim ownership of user-created stories or imply official endorsement of a modified edition.</li>
        </ol>
      </section>

      <footer className={styles.footer}>
        <strong>This page is a practical project summary, not legal advice.</strong>
        <p>Licensing questions involving a particular business, contributor agreement, commercial deployment, or jurisdiction should be reviewed by a qualified intellectual-property professional.</p>
        <div>
          <a href={sourceRepository} target="_blank" rel="noreferrer">Source repository</a>
          <a href="/LICENSES.md">Licence scope file</a>
          <a href="/CONTRIBUTING.md">Contribution terms</a>
        </div>
      </footer>
    </main>
  );
}
