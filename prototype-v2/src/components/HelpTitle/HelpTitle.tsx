import { useId, useState, type ReactNode } from 'react';
import styles from './HelpTitle.module.css';

/**
 * 제목 + 오른쪽 도움말(?) (UI 개선, 사용자 확정 검토안 '아이콘과 도움말 사용 원칙').
 * 화면을 설명하는 보조 문장만 접어 둔다. 마감·금액·필수 표시·오류처럼 꼭 봐야 하는 정보는 여기에 넣지 않는다.
 * 버튼에는 접근 가능한 이름(‘도움말’)과 펼침 상태를 둔다.
 */
export function HelpTitle({ title, help, className }: { title: ReactNode; help?: ReactNode; className: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <h1 className={className}>{title}</h1>
        {help && (
          <button type="button" className={styles.btn} aria-label="도움말" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6" />
              <path d="M12 16.8h.01" />
            </svg>
          </button>
        )}
      </div>
      {help && open && (
        <p className={styles.help} id={id}>
          {help}
        </p>
      )}
    </div>
  );
}
