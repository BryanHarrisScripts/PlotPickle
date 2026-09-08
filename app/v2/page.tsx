import { deriveBarebonesSurfaceTopology } from "../../lib/experience/surface-registry";

export default function BarebonesHomePage() {
  const topology = deriveBarebonesSurfaceTopology({ authenticated: true });

  return (
    <main className="pp-barebones-home" data-experience-surface={topology.defaultSurface}>
      <header className="pp-barebones-home__bar">
        <strong>PLOTPICKLE</strong>
        <span>HOME</span>
        <span>SKIN V2 / 16-BIT</span>
      </header>

      <section className="pp-barebones-home__blank" aria-label="PlotPickle Home">
        <p>HOME</p>
      </section>

      <footer className="pp-barebones-home__status">
        <span>EXPERIENCE CONTRACT: ONLINE</span>
        <span>ACTIVE SURFACES: {topology.activeSurfaces.join(", ")}</span>
      </footer>
    </main>
  );
}
