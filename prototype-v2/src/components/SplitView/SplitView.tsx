import { forwardRef, type ReactNode } from 'react';
import styles from './SplitView.module.css';

interface Props {
  list: ReactNode;
  detail: ReactNode;
  listLabel: string;
  detailLabel: string;
  detailId?: string;
}

/**
 * 목록 | 상세 (디자인 6.8). 본문 가용 폭 800px 이상이면 병렬,
 * 부족하면 목록 위·상세 아래로 쌓인다 (컨테이너 기준).
 */
export const SplitView = forwardRef<HTMLElement, Props>(function SplitView(
  { list, detail, listLabel, detailLabel, detailId },
  detailRef,
) {
  return (
    <div className={styles.container}>
      <div className={styles.split}>
        <section className={styles.list} aria-label={listLabel}>
          {list}
        </section>
        <section className={styles.detail} aria-label={detailLabel} ref={detailRef} id={detailId} tabIndex={-1}>
          {detail}
        </section>
      </div>
    </div>
  );
});

export function PanelHead({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <div className={styles.head}>
      <h2 className={styles.headTitle}>{title}</h2>
      {aside && <div className={styles.headAside}>{aside}</div>}
    </div>
  );
}

/** 좁은 화면에서만 보이는 `목록으로` */
export function BackToList({ onClick }: { onClick: () => void }) {
  return (
    <div className={styles.back}>
      <button type="button" className={styles.backBtn} onClick={onClick}>
        목록으로
      </button>
    </div>
  );
}

export const splitStyles = styles;
