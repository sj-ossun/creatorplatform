import styles from './SaveNotice.module.css';

/** 저장 성공 알림. role=status 영역은 항상 두고 문구만 바꾼다. */
export function SaveNotice({ message }: { message: string | null }) {
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {message && <div className={styles.notice}>{message}</div>}
    </div>
  );
}
