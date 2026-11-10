import type { ReactNode } from 'react';
import { Button } from '../Button/Button';
import styles from './MissionCard.module.css';

interface Props {
  title: string;
  /** 상태 칩 또는 인원 요약 */
  status?: ReactNode;
  meta: ReactNode;
  actionLabel: string;
  onOpen: () => void;
  /** 주요 행동이면 주황 */
  primary?: boolean;
}

/** 같은 미션을 홈·목록에서 표현하는 카드 (UI_STRUCTURE 5장 MissionCard) */
export function MissionCard({ title, status, meta, actionLabel, onOpen, primary }: Props) {
  return (
    <li className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      {status && <div className={styles.status}>{status}</div>}
      <div className={styles.meta}>{meta}</div>
      <div className={styles.action}>
        <Button variant={primary ? 'action' : 'secondary'} onClick={onOpen} aria-label={`${title} ${actionLabel}`}>
          {actionLabel}
        </Button>
      </div>
    </li>
  );
}

export function MissionCardGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul className={styles.grid} aria-label={label}>
      {children}
    </ul>
  );
}
