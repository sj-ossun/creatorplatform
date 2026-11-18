import type { ReactNode } from 'react';
import type { SubmissionStatus } from '../../domain/status';
import { StatusChip } from '../StatusChip/StatusChip';
import styles from './NextUp.module.css';

interface Props {
  status: SubmissionStatus;
  missionTitle: string;
  title: string;
  children?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}

/** 지금 할 일 (디자인 6.11). 주황 막대는 미제출·보완 요청에만. */
export function NextUp({ status, missionTitle, title, children, meta, action }: Props) {
  const hasAction = status === 'not_submitted' || status === 'revision_requested';
  return (
    <section className={styles.nextup} data-action={hasAction || undefined} aria-labelledby="nextup-title">
      <div className={styles.top}>
        <StatusChip status={status} />
        <span className={styles.mission}>{missionTitle}</span>
      </div>
      <h3 className={styles.title} id="nextup-title" tabIndex={-1}>
        {title}
      </h3>
      {children && <div className={styles.body}>{children}</div>}
      {meta && <p className={styles.meta}>{meta}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </section>
  );
}
