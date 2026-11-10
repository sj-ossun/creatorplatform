import type { StatusCounts } from '../../domain/aggregate';
import { STATUS_LABEL, SUBMISSION_STATUSES } from '../../domain/status';
import { formatCount } from '../../domain/time';
import styles from './Distribution.module.css';

/**
 * 집계 분포 (디자인 6.12). 숫자는 공통 집계 함수 결과로만 그린다.
 * size="row" 는 8px 막대의 작은 표시.
 */
export function Distribution({ result, scope, size = 'full' }: { result: StatusCounts; scope?: string; size?: 'full' | 'row' }) {
  const { total, counts, unit } = result;
  const label = describeCounts(result);
  return (
    <section className={styles.dist} data-size={size} aria-label="제출 상태 분포">
      <div className={styles.head}>
        <p className={styles.total}>
          대상 <span className="num">{formatCount(total)}</span>
          {unit}
        </p>
        {scope && <p className={styles.scope}>{scope}</p>}
      </div>
      <StatusBar result={result} label={label} />
      <ul className={styles.legend} aria-hidden="true">
        {SUBMISSION_STATUSES.map((s) => (
          <li key={s} className={styles.item}>
            <span className={styles.itemLabel}>
              <span className="status-glyph" data-status={s} />
              {STATUS_LABEL[s]}
            </span>
            <span className={styles.figure}>
              <span className={`${styles.figureNum} num`}>{formatCount(counts[s])}</span>
              <span className={styles.unit}>{unit}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function describeCounts({ total, counts, unit }: StatusCounts) {
  return `대상 ${total}${unit}: ${SUBMISSION_STATUSES.map((s) => `${STATUS_LABEL[s]} ${counts[s]}${unit}`).join(', ')}`;
}

/** 상태 순서대로 나눈 막대. 미제출은 빗금 */
export function StatusBar({ result, label, thin }: { result: StatusCounts; label?: string; thin?: boolean }) {
  return (
    <div className={styles.bar} data-thin={thin || undefined} role="img" aria-label={label ?? describeCounts(result)}>
      {result.total > 0 &&
        SUBMISSION_STATUSES.filter((s) => result.counts[s] > 0).map((s) => (
          <span key={s} className={styles.seg} data-status={s} style={{ flexGrow: result.counts[s] }} />
        ))}
    </div>
  );
}

/** 0건인 상태를 뺀 개수 목록 (크루별 행) */
export function StatusCountList({ result }: { result: StatusCounts }) {
  const shown = SUBMISSION_STATUSES.filter((s) => result.counts[s] > 0);
  if (shown.length === 0) return <span className={styles.none}>대상 없음</span>;
  return (
    <span className={styles.counts}>
      {shown.map((s) => (
        <span key={s}>
          <span className="status-glyph" data-status={s} aria-hidden="true" />
          {STATUS_LABEL[s]} <span className="num">{result.counts[s]}</span>
        </span>
      ))}
    </span>
  );
}
