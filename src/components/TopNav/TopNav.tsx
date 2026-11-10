import { getCrew } from '../../domain/queries';
import { ROLE_LABEL } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import { globalMenu } from '../../state/routes';
import { DemoControls } from '../DemoControls/DemoControls';
import styles from './TopNav.module.css';

/**
 * 전역 헤더 (v0.4 01장 3절): CREW | 홈 · 내 크루 (관리자: 운영 관리) | 현재 예시 사용자·역할 | 시연 도구.
 * 크루 안의 메뉴는 CrewNav 가 맡는다.
 */
export function TopNav() {
  const { data, user, route, navigate } = useStore();

  const scope =
    user.role === 'admin'
      ? `${user.managedCrewIds.map((id) => getCrew(data, id)?.name).join('·')} 담당`
      : `${getCrew(data, user.crewId)?.name ?? ''} 크루`;
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <span className={styles.logo}>
          CREW<span className={styles.dot} aria-hidden="true" />
        </span>
        <nav className={styles.nav} aria-label="메뉴">
          <ul className={styles.list}>
            {globalMenu(user).map((m) => (
              <li key={m.key}>
                <button
                  type="button"
                  className={styles.item}
                  aria-current={m.activeOn.includes(route.screen) ? 'page' : undefined}
                  onClick={() => void navigate(m.route)}
                >
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.who}>
          <p className={styles.whoText}>
            <span className={styles.name}>
              {user.name} · {ROLE_LABEL[user.role]}
            </span>
            <span className={styles.role}>{scope}</span>
          </p>
          <DemoControls />
        </div>
      </div>
    </header>
  );
}
