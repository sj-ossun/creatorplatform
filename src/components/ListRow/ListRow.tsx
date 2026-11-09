import type { ReactNode } from 'react';
import styles from './ListRow.module.css';

interface Props {
  selected?: boolean;
  onSelect: () => void;
  leading?: ReactNode;
  title: ReactNode;
  trailing?: ReactNode;
  meta?: ReactNode;
  /** 화면낭독기용 선택 안내 */
  selectedLabel?: string;
  leaving?: boolean;
}

/** 목록 행 (디자인 6.7). 각 행은 실제 버튼이다. */
export function ListRow({ selected, onSelect, leading, title, trailing, meta, selectedLabel = '선택됨', leaving }: Props) {
  return (
    <li className={`${styles.item} ${leaving ? styles.leaving : ''}`}>
      <button
        type="button"
        className={styles.row}
        data-selected={selected || undefined}
        aria-current={selected ? 'true' : undefined}
        onClick={onSelect}
      >
        <span className={styles.line1}>
          {leading}
          <span className={styles.title}>{title}</span>
          {trailing && <span className={styles.trailing}>{trailing}</span>}
        </span>
        {meta && <span className={styles.line2}>{meta}</span>}
        {selected && <span className="sr-only">, {selectedLabel}</span>}
      </button>
    </li>
  );
}

export function RowList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul className={styles.list} aria-label={label}>
      {children}
    </ul>
  );
}
