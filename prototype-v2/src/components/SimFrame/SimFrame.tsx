import type { ReactNode } from 'react';
import { Icon } from '../Icon/Icon';
import { Tag } from '../Tag/Tag';
import styles from './SimFrame.module.css';

interface Props {
  message: ReactNode;
  action?: ReactNode;
  rows: { label: string; value: ReactNode }[];
  children?: ReactNode;
}

/** 알림 미리보기 (디자인 6.15). 실제로 보내지 않는다. */
export function SimFrame({ message, action, rows, children }: Props) {
  return (
    <section className={styles.frame} aria-label="알림 미리보기">
      <div className={styles.head}>
        <Tag variant="sim">알림 미리보기</Tag>
        <span className={styles.note}>실제로 보내지 않아요</span>
      </div>
      <div className={styles.bubble}>
        <p className={styles.app}>
          <Icon name="bell" />
          CREW
        </p>
        <p className={styles.message}>{message}</p>
        {action}
      </div>
      <dl className={styles.rows}>
        {rows.map((r) => (
          <div key={r.label} className={styles.row}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  );
}
