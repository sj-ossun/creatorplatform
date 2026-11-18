import { DUE_STATE_LABEL, type DueState } from '../../domain/due';
import styles from './DueBadge.module.css';

/** '마감 지남'(빨강, !) · '마감 임박'(갈색, 시계). 색만이 아니라 글자·기호로 구분한다 */
export function DueBadge({ state }: { state: DueState }) {
  if (!state) return null;
  return (
    <span className={styles.badge} data-state={state}>
      <svg viewBox="0 0 12 12" aria-hidden="true">
        {state === 'late' ? (
          <path d="M6 2.5v4M6 9.2v.1" />
        ) : (
          <>
            <circle cx="6" cy="6" r="4.5" />
            <path d="M6 3.5V6l1.6 1" />
          </>
        )}
      </svg>
      {DUE_STATE_LABEL[state]}
    </span>
  );
}
