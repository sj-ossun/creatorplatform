import type { ReactNode } from 'react';
import type { StatusCounts } from '../../domain/aggregate';
import { STATUS_LABEL, SUBMISSION_STATUSES } from '../../domain/status';
import styles from './StatusTable.module.css';

export interface StatusTableColumn {
  label: string;
  /** 숫자 열은 오른쪽 정렬 */
  numeric?: boolean;
}

export interface StatusTableRow {
  id: string;
  title: ReactNode;
  /** 화면낭독기용 행 열기 버튼 이름 (예: `미션명 미션 보기`) */
  openLabel: string;
  onOpen: () => void;
  /** 제목 아래 작은 줄 */
  sub?: ReactNode;
  cells: ReactNode[];
  counts: StatusCounts;
}

/**
 * 상태별 개수 표 (구조안 v0.2: 크루장 미션 목록, 관리자 구성원 목록).
 * 제목 | 추가 열 | 검토 대기 | 보완 요청 | 완료 | 미제출. 행을 누르면 상세로 간다.
 * 좁은 화면에서는 행이 카드처럼 쌓인다.
 */
export function StatusTable({
  label,
  titleHeader,
  columns,
  rows,
}: {
  label: string;
  titleHeader: string;
  columns: StatusTableColumn[];
  rows: StatusTableRow[];
}) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table} aria-label={label}>
        <thead>
          <tr>
            <th scope="col">{titleHeader}</th>
            {columns.map((c) => (
              <th key={c.label} scope="col" className={c.numeric ? styles.num : undefined}>
                {c.label}
              </th>
            ))}
            {SUBMISSION_STATUSES.map((s) => (
              <th key={s} scope="col" className={styles.num}>
                <span className={styles.statusHead}>
                  <span className="status-glyph" data-status={s} aria-hidden="true" />
                  {STATUS_LABEL[s]}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={styles.row} onClick={r.onOpen}>
              <th scope="row" className={styles.titleCell}>
                <button
                  type="button"
                  className={styles.open}
                  aria-label={r.openLabel}
                  onClick={(e) => {
                    e.stopPropagation();
                    r.onOpen();
                  }}
                >
                  {r.title}
                </button>
                {r.sub && <span className={styles.sub}>{r.sub}</span>}
              </th>
              {r.cells.map((cell, i) => (
                <td key={i} className={columns[i]?.numeric ? styles.num : undefined} data-label={columns[i]?.label}>
                  {cell}
                </td>
              ))}
              {SUBMISSION_STATUSES.map((s) => (
                <td key={s} className={`${styles.num} ${styles.count}`} data-label={STATUS_LABEL[s]} data-zero={r.counts.counts[s] === 0 || undefined}>
                  <span className={styles.mobileLabel} aria-hidden="true">
                    <span className="status-glyph" data-status={s} />
                    {STATUS_LABEL[s]}
                  </span>
                  <span className="num">{r.counts.counts[s]}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
