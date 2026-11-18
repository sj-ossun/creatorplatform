import styles from './Breadcrumbs.module.css';

export interface Crumb {
  label: string;
  /** 없으면 현재 위치 */
  onClick?: () => void;
}

/** 현재 위치와 돌아갈 경로 (UI_STRUCTURE UI-03·05) */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="현재 위치" className={styles.crumbs}>
      <ol>
        {items.map((c, i) => (
          <li key={i}>
            {c.onClick ? (
              <button type="button" onClick={c.onClick}>
                {c.label}
              </button>
            ) : (
              <span aria-current="page">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
