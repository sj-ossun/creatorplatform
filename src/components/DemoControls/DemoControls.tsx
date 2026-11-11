import { useCallback, useId, useRef, useState } from 'react';
import { useDismiss } from '../../hooks/useDismiss';
import { useStore } from '../../state/AppStore';
import styles from './DemoControls.module.css';

/**
 * P-11 진행자 시연 도구 (v0.6 02 16장). 로그인한 뒤에만 보이는 접을 수 있는 보조 영역.
 *   다른 계정 체험 → P-12 (선택을 마치기 전까지 지금 계정을 유지한다)
 *   알림 예시 → 현재 역할 범위의 예시만 (크루원 본인 · 크루장 자기 크루 · 관리자 담당 크루)
 *   예시 데이터 초기화 → 확인 후 이 앱의 가상 업무 데이터만 복원
 * 실제 서비스의 역할 변경 기능이 아니다. 자동 계정 전환은 없다.
 */
export function DemoControls() {
  const { session, route, requestReset, busy, navigate } = useStore();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, rootRef, close, toggleRef);
  if (!session) return null;

  const go = async (r: Parameters<typeof navigate>[0]) => {
    if (await navigate(r)) setOpen(false);
  };

  return (
    <aside className={styles.dock} aria-label="시연 도구" ref={rootRef}>
      <button
        ref={toggleRef}
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        시연 도구
        <span aria-hidden="true" className={styles.chev}>
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div className={styles.panel} id={panelId}>
          <p className={styles.note}>진행자용 도구예요. 실제 서비스 기능이 아니고, 알림은 실제로 보내지 않아요.</p>
          <button
            type="button"
            className={styles.link}
            disabled={busy}
            onClick={() => void go({ screen: 'login', from: route, reason: 'switch' })}
          >
            다른 계정 체험 (시연 로그인으로 이동)
          </button>
          <button type="button" className={styles.link} disabled={busy} onClick={() => void go({ screen: 'notifications' })}>
            알림 예시 보기 (실제로 보내지 않아요)
          </button>
          <button
            type="button"
            className={styles.reset}
            onClick={async () => {
              setOpen(false);
              await requestReset();
            }}
            disabled={busy}
          >
            예시 데이터 초기화
          </button>
        </div>
      )}
    </aside>
  );
}
