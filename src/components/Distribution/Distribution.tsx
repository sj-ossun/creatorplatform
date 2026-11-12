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

/**
 * 상태별 숫자 (6-A, 테스터 피드백): 막대 없이 '대상 n · 검토 대기 n · 보완 요청 n · 완료 n · 미제출 n'.
 * onPick 이 있으면 숫자를 눌러 그 상태의 크루원 목록(퀵 리뷰 필터)으로 간다. 0건인 상태는 누를 수 없다.
 */
export function StatusNumbers({
  result,
  onPick,
  label = '상태별 인원',
}: {
  result: StatusCounts;
  onPick?: (s: (typeof SUBMISSION_STATUSES)[number]) => void;
  label?: string;
}) {
  return (
    <div className={styles.sc} aria-label={label} role="group">
      <span className={styles.scTotal}>
        대상 <span className="num">{formatCount(result.total)}</span>
        {result.unit}
      </span>
      {SUBMISSION_STATUSES.map((s) => {
        const n = result.counts[s];
        const body = (
          <>
            <span className="status-glyph" data-status={s} aria-hidden="true" />
            <span>{STATUS_LABEL[s]}</span>
            <span className={`${styles.scNum} num`}>{formatCount(n)}</span>
          </>
        );
        return onPick && n > 0 ? (
          <button key={s} type="button" className={styles.scItem} data-link onClick={() => onPick(s)} aria-label={`${STATUS_LABEL[s]} ${n}${result.unit} 보기`}>
            {body}
          </button>
        ) : (
          <span key={s} className={styles.scItem} data-zero={n === 0 || undefined}>
            {body}
          </span>
        );
      })}
    </div>
  );
}
