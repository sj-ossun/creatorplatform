import { useEffect, useId, useRef, useState } from 'react';
import { getCrew } from '../../domain/queries';
import { ROLE_LABEL, type AppData, type Role, type User } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import styles from './DemoControls.module.css';

const ROLES: Role[] = ['member', 'leader', 'admin'];

export function userOptionLabel(data: AppData, u: User) {
  if (u.role === 'admin') {
    return `${u.name} (${u.managedCrewIds.map((id) => getCrew(data, id)?.name).join('·')} 담당)`;
  }
  return `${u.name} (${getCrew(data, u.crewId)?.name ?? '소속 없음'})`;
}

/**
 * 진행자 시연 도구 (F-01). 상단 보조 영역의 접을 수 있는 도구 (UI_STRUCTURE 3장).
 * 접혀 있을 때는 본문을 가리지 않는다. 현재 예시 사용자·역할은 상단 메뉴에 항상 보인다.
 * 실제 로그인이 아니다.
 */
export function DemoControls() {
  const { data, user, switchUser, requestReset, busy, navigate } = useStore();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const usersOfRole = data.users.filter((u) => u.role === user.role);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="alertdialog"]')) {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    // 바깥을 누르면 닫는다 (확인 대화상자가 떠 있을 때는 그대로 둔다)
    const onDown = (e: MouseEvent) => {
      if (document.querySelector('[role="alertdialog"]')) return;
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  /** 예시 사용자를 바꾸면 도구를 접어 본문을 바로 보이게 한다 */
  async function change(userId: string) {
    if (await switchUser(userId)) setOpen(false);
  }

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
          <p className={styles.note}>진행자용 도구예요. 실제 로그인이 아니라 예시 사용자를 바꿔 보여줘요.</p>
          <label className={styles.control}>
            <span>역할</span>
            <select
              value={user.role}
              disabled={busy}
              onChange={(e) => {
                const first = data.users.find((u) => u.role === (e.target.value as Role));
                if (first) void change(first.id);
              }}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.control}>
            <span>예시 사용자</span>
            <select value={user.id} disabled={busy} onChange={(e) => void change(e.target.value)}>
              {usersOfRole.map((u) => (
                <option key={u.id} value={u.id}>
                  {userOptionLabel(data, u)}
                </option>
              ))}
            </select>
          </label>
          {(user.role === 'leader' || user.role === 'admin') && (
            // P-11 알림 미리보기: 시연 도구 안의 진입점. 실제 발송이 없는 시연 화면이다
            <button
              type="button"
              className={styles.link}
              disabled={busy}
              onClick={async () => {
                if (await navigate({ screen: 'notifications' })) setOpen(false);
              }}
            >
              알림 미리보기 (실제로 보내지 않아요)
            </button>
          )}
          <button type="button" className={styles.reset} onClick={() => void requestReset()} disabled={busy}>
            예시 데이터 초기화
          </button>
        </div>
      )}
    </aside>
  );
}
