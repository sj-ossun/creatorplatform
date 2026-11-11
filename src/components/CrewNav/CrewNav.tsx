import { crewProfile } from '../../domain/crewProfile';
import { getCrew, getUser } from '../../domain/queries';
import { useStore } from '../../state/AppStore';
import { crewMenu, crewOfRoute } from '../../state/routes';
import styles from './CrewNav.module.css';

/**
 * 크루 맥락 (v0.6 02 1장: 크루 업무 화면에만 크루명·카테고리·내부 메뉴): 선택한 크루명과 크루 홈 · 미션 · 소통.
 * 크루 공간의 화면에서만 보인다. 크루 관리·편집 기능은 없다.
 */
export function CrewNav() {
  const { data, user, route, navigate } = useStore();
  const crewId = crewOfRoute(data, route);
  const crew = getCrew(data, crewId);
  if (!crew || user.crewId !== crew.id) return null;
  const { category } = crewProfile(crew);
  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        <p className={styles.crew}>
          <span className={styles.name}>{crew.name} 크루</span>
          {category && (
            <span className={styles.category}>
              <span className="sr-only">카테고리 </span>
              {category}
            </span>
          )}
          <span className={styles.leader}>크루장 {getUser(data, crew.leaderId)?.name}</span>
        </p>
        <nav aria-label="크루 메뉴" className={styles.nav}>
          <ul className={styles.list}>
            {crewMenu(crew.id, user).map((m) => (
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
      </div>
    </div>
  );
}
