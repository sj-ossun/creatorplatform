import { getCrew } from '../../domain/queries';
import { ROLE_LABEL, type AppData, type Role, type User } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import styles from './SimBar.module.css';

const ROLES: Role[] = ['member', 'leader', 'admin'];

export function userOptionLabel(data: AppData, u: User) {
  if (u.role === 'admin') {
    return `${u.name} (${u.managedCrewIds.map((id) => getCrew(data, id)?.name).join('·')} 담당)`;
  }
  return `${u.name} (${getCrew(data, u.crewId)?.name ?? '소속 없음'})`;
}

/**
 * 진행자 시연 바 (디자인 6.1). 앱 바깥의 도구다.
 * 예시 사용자를 고르면 역할·소속·담당 크루가 함께 정해진다.
 */
export function SimBar() {
  const { data, user, switchUser, requestReset, busy } = useStore();
  const usersOfRole = data.users.filter((u) => u.role === user.role);

  return (
    <div className={styles.simbar} role="region" aria-label="시연 도구">
      <span className={styles.simTag}>시연 도구</span>
      <label className={styles.control}>
        <span>역할</span>
        <select
          value={user.role}
          disabled={busy}
          onChange={(e) => {
            const role = e.target.value as Role;
            const first = data.users.find((u) => u.role === role);
            if (first) void switchUser(first.id);
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
        <select value={user.id} disabled={busy} onChange={(e) => void switchUser(e.target.value)}>
          {usersOfRole.map((u) => (
            <option key={u.id} value={u.id}>
              {userOptionLabel(data, u)}
            </option>
          ))}
        </select>
      </label>
      <span className={styles.note}>실제 로그인이 아니에요</span>
      <button type="button" className={styles.reset} onClick={() => void requestReset()} disabled={busy}>
        예시 데이터 초기화
      </button>
    </div>
  );
}
