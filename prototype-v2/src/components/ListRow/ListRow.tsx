import type { ReactNode } from 'react';
import styles from './ListRow.module.css';

interface Props {
  selected?: boolean;
  onSelect: () => void;
  leading?: ReactNode;
  /** 행 왼쪽 그림 (제출물 커버 등). 두 줄 전체 높이를 차지한다 */
  media?: ReactNode;
  title: ReactNode;
  trailing?: ReactNode;
  meta?: ReactNode;
  /** 화면낭독기용 선택 안내 */
  selectedLabel?: string;
  leaving?: boolean;
  /** 둘째 줄을 상태 기호 폭만큼 들일지. 생략하면 leading 이 있을 때 들인다 */
  indentMeta?: boolean;
}

/** 목록 행 (디자인 6.7). 각 행은 실제 버튼이다. */
export function ListRow({ selected, onSelect, leading, media, title, trailing, meta, selectedLabel = '선택됨', leaving, indentMeta }: Props) {
  // 기본: 앞에 상태 기호가 있을 때만 둘째 줄을 들인다
  const indent = indentMeta ?? leading !== undefined;
  return (
    <li className={`${styles.item} ${leaving ? styles.leaving : ''}`}>
      <button
        type="button"
        className={styles.row}
        data-selected={selected || undefined}
        data-media={media ? true : undefined}
        aria-current={selected ? 'true' : undefined}
        onClick={onSelect}
      >
        {media && <span className={styles.media}>{media}</span>}
        <span className={styles.body}>
        <span className={styles.line1}>
          {leading}
          <span className={styles.title}>{title}</span>
          {trailing && <span className={styles.trailing}>{trailing}</span>}
        </span>
        {meta && <span className={`${styles.line2} ${indent ? styles.indent : ''}`}>{meta}</span>}
        </span>
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
