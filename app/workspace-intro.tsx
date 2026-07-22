import styles from "./workspace-intro.module.css";

type WorkspaceIntroProps = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  sideEyebrow: string;
  sideTitle: string;
  sideDescription: string;
};

export default function WorkspaceIntro({
  id,
  eyebrow,
  title,
  description,
  sideEyebrow,
  sideTitle,
  sideDescription,
}: WorkspaceIntroProps) {
  return (
    <section className={styles.wrap} aria-labelledby={id}>
      <div className={styles.hero}>
        <div className={styles.primaryCard}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 id={id}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
        <aside className={styles.sideCard}>
          <span>{sideEyebrow}</span>
          <strong>{sideTitle}</strong>
          <p>{sideDescription}</p>
        </aside>
      </div>
    </section>
  );
}
