import { aggregateStatuses } from '../../domain/aggregate';
import { useStore } from '../../state/AppStore';
import { MENUS, type Route } from '../../state/routes';
import styles from './Nav.module.css';

/** 왼쪽 메뉴. 1200px 미만에서는 헤더 아래 가로 스크롤 메뉴 */
export function Nav() {
  const { data, user, route, navigate } = useStore();
  const pending =
    user.role === 'leader' && user.crewId
      ? aggregateStatuses(data, { crewIds: [user.crewId] }).counts.pending_review
      : 0;
  return (
    <nav className={styles.nav} aria-label="메뉴">
      <ul className={styles.list}>
        {MENUS[user.role].map((m) => {
          const current = route.screen === m.screen;
          const count = m.screen === 'review' ? pending : 0;
          return (
            <li key={m.screen}>
              <button
                type="button"
                className={styles.item}
                aria-current={current ? 'page' : undefined}
                onClick={() => void navigate({ screen: m.screen } as Route)}
              >
                <span>{m.label}</span>
                {count > 0 && (
                  <span className={`${styles.count} num`}>
                    {count}
                    <span className="sr-only">건 검토 대기</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
