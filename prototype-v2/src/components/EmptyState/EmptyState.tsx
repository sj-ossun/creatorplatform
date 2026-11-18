import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

/** 빈 상태: 왼쪽 정렬 제목 + 다음 행동 한 문장 + 필요하면 버튼. 그림 없음. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <h3 className={styles.title}>{title}</h3>
      {children && <p className={styles.text}>{children}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
