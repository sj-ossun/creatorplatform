import styles from './StatusChip.module.css';
import { STATUS_LABEL, type SubmissionStatus } from '../../domain/status';

export function StatusChip({ status }: { status: SubmissionStatus }) {
  return (
    <span className={styles.chip} data-status={status}>
      <span className="status-glyph" data-status={status} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** 기호만 (목록 행 등). 뜻은 옆 글자 또는 sr-only 로 전달한다. */
export function StatusGlyph({ status }: { status: SubmissionStatus }) {
  return (
    <>
      <span className="status-glyph" data-status={status} aria-hidden="true" />
      <span className="sr-only">{STATUS_LABEL[status]}</span>
    </>
  );
}
