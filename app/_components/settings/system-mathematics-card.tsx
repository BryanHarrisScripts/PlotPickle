import styles from "./system-mathematics-card.module.css";

// Human-supplied planning targets, not generated-media counts or export settings.
export const SYSTEM_MATHEMATICS = [
  {
    "title": "1 Act",
    "lines": [
      "= 6 Blocks [3 Sequences × 2 Blocks = 6 Blocks]",
      "= 24 Mini-Blocks [6 Blocks × 4 Mini-Blocks = 24 Mini-Blocks]",
      "= 3 Sequences [6 Blocks ÷ 2 Blocks per Sequence = 3 Sequences]",
      "= 600 Shots (3 seconds per Shot) [24 Mini-Blocks × 25 Shots = 600 Shots]",
      "= 30 minutes [600 Shots × 3 seconds = 1,800 seconds ÷ 60 = 30 minutes]",
      "= 43,200 final video frames [1,800 seconds × 24 frames per second = 43,200 frames]"
    ]
  },
  {
    "title": "1 Block",
    "lines": [
      "= 4 Mini-Blocks [1 Block × 4 Mini-Blocks = 4 Mini-Blocks]",
      "= 100 Shots (3 seconds per Shot) [4 Mini-Blocks × 25 Shots = 100 Shots]",
      "= 5 minutes [100 Shots × 3 seconds = 300 seconds ÷ 60 = 5 minutes]",
      "= 7,200 final video frames [300 seconds × 24 frames per second = 7,200 frames]"
    ]
  },
  {
    "title": "1 Mini-Block",
    "lines": [
      "= 25 Shots (3 seconds per Shot) [1 Mini-Block × 25 Shots = 25 Shots]",
      "= 75 seconds [25 Shots × 3 seconds = 75 seconds]",
      "= 1,800 final video frames [75 seconds × 24 frames per second = 1,800 frames]"
    ]
  },
  {
    "title": "1 Sequence",
    "lines": [
      "= 2 Blocks [1 Sequence × 2 Blocks = 2 Blocks]",
      "= 8 Mini-Blocks [2 Blocks × 4 Mini-Blocks = 8 Mini-Blocks]",
      "= 200 Shots (3 seconds per Shot) [8 Mini-Blocks × 25 Shots = 200 Shots]",
      "= 10 minutes [200 Shots × 3 seconds = 600 seconds ÷ 60 = 10 minutes]",
      "= 14,400 final video frames [600 seconds × 24 frames per second = 14,400 frames]"
    ]
  },
  {
    "title": "1 Shot",
    "lines": [
      "= approximately 3 seconds [1 Shot × 3 seconds = 3 seconds]",
      "= 72 final video frames at 24 fps [3 seconds × 24 frames per second = 72 frames]"
    ]
  },
  {
    "title": "Complete movie — 4 Acts",
    "lines": [
      "= 24 Blocks [4 Acts × 6 Blocks = 24 Blocks]",
      "= 96 Mini-Blocks [24 Blocks × 4 Mini-Blocks = 96 Mini-Blocks]",
      "= 12 Sequences [4 Acts × 3 Sequences = 12 Sequences]",
      "= 2,400 Shots (3 seconds per Shot) [96 Mini-Blocks × 25 Shots = 2,400 Shots]",
      "= 2 hours [4 Acts × 30 minutes = 120 minutes ÷ 60 = 2 hours]",
      "= 120 minutes [4 Acts × 30 minutes = 120 minutes]",
      "= 7,200 seconds [120 minutes × 60 seconds = 7,200 seconds]",
      "= 1 Shot = 72 frames [24 frames per second × 3 seconds = 72 frames]",
      "= 172,800 final video frames [72 frames × 2,400 Shots = 172,800 frames]",
      "= 2,400 storyboard Shots become 172,800 actual video frames in a two-hour movie [2,400 Shots × 3 seconds × 24 frames per second = 172,800 frames]",
      "= 172,800 final video frames at 24 fps [7,200 seconds × 24 frames per second = 172,800 frames]"
    ]
  }
] as const;

export default function SystemMathematicsCard() {
  return <section className={styles.card} aria-labelledby="system-mathematics-title" data-system-mathematics="planning-targets">
    <h3 id="system-mathematics-title">System Mathematics</h3>
    <p>Planning targets: 25 shots per Mini-Block, approximately 3 seconds per shot, and 24 final video frames per second. These totals describe a two-hour target movie; actual video frame counts depend on the rendered shot durations and export frame rate.</p>
    <p>A storyboard shot is a planned shot. Final video frames are the individual frames in the rendered movie.</p>
    {SYSTEM_MATHEMATICS.map(({ title, lines }) => <section className={styles.section} key={title} aria-label={title}>
      <h4>{title}</h4>
      {lines.map((line) => <p key={line}>{line}</p>)}
    </section>)}
  </section>;
}

