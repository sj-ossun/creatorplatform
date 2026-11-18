import type { ReactNode } from 'react';
import styles from './MetaParts.module.css';

/**
 * 보조 정보 줄: 항목 사이에 세로 구분선을 둔다 (사용자 결정: 쉼표 대신 확실히 구분되는 기호).
 * 예: 하늘 | 11월 11일 | 17:26 | 댓글 1
 */
export function MetaParts({ items, label }: { items: ReactNode[]; label?: string }) {
  return (
    <span className={styles.parts} aria-label={label}>
      {items.map((it, i) => (
        <span key={i} className={styles.part}>
          {i > 0 && (
            <span className={styles.sep} aria-hidden="true">
              |
            </span>
          )}
          {it}
        </span>
      ))}
    </span>
  );
}
