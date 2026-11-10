import { getCrew } from '../../domain/queries';
import { ROLE_LABEL } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import { MENUS, menuOf, type Route } from '../../state/routes';
import { DemoControls } from '../DemoControls/DemoControls';
import styles from './TopNav.module.css';

/**
 * 상단 공통 메뉴 (UI_STRUCTURE 3장): CREW | 메뉴 | 현재 예시 사용자·소속.
 * 메뉴가 적은 첫 버전이라 고정 사이드바를 쓰지 않는다.
 */
export function TopNav() {
  const { data, user, route, navigate } = useStore();
  const current = menuOf(route.screen);
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
            {MENUS[user.role].map((m) => (
              <li key={m.screen}>
                <button
                  type="button"
                  className={styles.item}
                  aria-current={current === m.screen ? 'page' : undefined}
                  onClick={() => void navigate({ screen: m.screen } as Route)}
                >
                  {m.label}
                  {m.sim && <span className={styles.simMark}>시연</span>}
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
