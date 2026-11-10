import type { ReactNode } from 'react';
import { observationsOf, type MetricKind } from '../../domain/performance';
import { formatCount, formatDay } from '../../domain/time';
import type { AppData } from '../../domain/types';
import { Tag } from '../Tag/Tag';
import styles from './MetricValue.module.css';

/**
 * 성과 값 (디자인 6.13). 숫자, 미집계, 미게시 중 하나.
 * 실제 관찰 기록이 있을 때만 확인일과 `수동 입력` 태그를 붙인다.
 */
export function MetricValue({ data, title, metric, extra }: { data: AppData; title: ReactNode; metric: MetricKind; extra?: ReactNode }) {
  const latest = metric.kind === 'unposted' ? undefined : metric.latest;
  const older = metric.kind === 'unposted' ? [] : observationsOf(data, metric.post.id).slice(1);

  let value;
  if (metric.kind === 'views') {
    value = (
      <>
        <span className={`${styles.figure} num`}>{formatCount(metric.latest.views!)}</span>
        <span className={styles.unit}>회</span>
      </>
    );
  } else {
    value = <span className={styles.none}>{metric.kind === 'unposted' ? '미게시' : '미집계'}</span>;
  }

  let meta;
  if (metric.kind === 'unposted') meta = <span>검토 완료, 게시 기록 없음</span>;
  else if (!latest) meta = <span>게시 {formatDay(metric.post.publishedOn)}, 조회수 확인 전</span>;
  else
    meta = (
      <>
        <span>확인일 {formatDay(latest.checkedOn)}</span>
        <Tag>수동 입력</Tag>
        {latest.views === null && <span>조회수 확인 전</span>}
      </>
    );

  return (
    <div className={styles.metric}>
      <span className={styles.title}>{title}</span>
      <span className={styles.value}>{value}</span>
      <span className={styles.meta}>{meta}</span>
      {latest?.retrospective && (
        <p className={styles.retro}>
          <span className={styles.retroLabel}>회고</span> {latest.retrospective}
        </p>
      )}
      {extra && <div className={styles.extra}>{extra}</div>}
      {older.length > 0 && (
        <details className={styles.history}>
          <summary>이전 확인 기록 {older.length}개</summary>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">확인일</th>
                  <th scope="col" className={styles.numCol}>
                    조회수
                  </th>
                  <th scope="col">회고</th>
                </tr>
              </thead>
              <tbody>
                {older.map((o) => (
                  <tr key={o.id}>
                    <td>{formatDay(o.checkedOn)}</td>
                    <td className={`${styles.numCol} num`}>{o.views === null ? '미집계' : `${formatCount(o.views)}회`}</td>
                    <td>{o.retrospective || '없음'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
