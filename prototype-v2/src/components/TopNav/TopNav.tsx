import { useCallback, useEffect, useId, useRef, useState } from 'react';
import emblem from '../../assets/brand/th-emblem.png';
import { getCrew } from '../../domain/queries';
import { ROLE_LABEL, type User, type AppData } from '../../domain/types';
import { useDismiss } from '../../hooks/useDismiss';
import { unreadCount } from '../../domain/inbox';
import { useStore } from '../../state/AppStore';
import { CREW_SCREENS, crewMenu, globalMenu, type NavItem, type Route } from '../../state/routes';
import { DemoControls } from '../DemoControls/DemoControls';
import styles from './TopNav.module.css';

function scopeOf(data: AppData, user: User) {
  if (user.role === 'admin') return `${user.managedCrewIds.map((id) => getCrew(data, id)?.name).join('·')} 담당`;
  const crew = getCrew(data, user.crewId);
  return crew ? `${crew.name} 크루` : '배정된 크루 없음';
}

/**
 * 헤더 (v0.7 5.1·5.2, 사용자 확정 견본 v3).
 *   로그인 후: [TH 심볼 CREW / by Treasure Hunter] [크루 활동▾] [광고 제안] … [시연 도구] [알림] [계정]
 *     크루원: 크루 활동▾(크루방·미션·커뮤니티) · 광고 제안 · 내 성과 · 우수 사례 · 이용 가이드
 *     크루장: 크루 활동▾(크루방·미션·커뮤니티·성과) · 광고 제안 · 우수 사례 · 이용 가이드
 *     관리자: 운영 관리 · 커뮤니티 · 우수 사례 · 이용 가이드
 *   비로그인(공개 홈): 이번 주 미션 · 이용 방법 · 우수 사례 → 홈 안 구역, 오른쪽 검정 '로그인'
 * 960px 이하: 메뉴가 두 번째 줄로 내려가고 넘치면 줄바꿈한다(메뉴 버튼 없이 그대로 보인다).
 */
export function TopNav() {
  const { data, session, route, navigate, logout } = useStore();
  const menu = globalMenu(session);
  const [crewOpen, setCrewOpen] = useState(false);
  const crewBtnRef = useRef<HTMLButtonElement>(null);
  const crewRootRef = useRef<HTMLLIElement>(null);
  const crewListId = useId();
  const closeCrew = useCallback(() => setCrewOpen(false), []);
  useDismiss(crewOpen, crewRootRef, closeCrew, crewBtnRef);

  // 페이지가 바뀌면 펼친 메뉴를 닫는다
  useEffect(() => {
    setCrewOpen(false);
  }, [route]);

  const go = async (r: Route, anchor?: string) => {
    if (await navigate(r)) {
      setCrewOpen(false);
      if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
    }
  };

  const crewItems = menu.crewActivity && menu.crewId ? crewMenu(menu.crewId, session) : [];
  // 크루 공간(크루방·미션·커뮤니티·성과)에 있으면 '크루 활동'이 현재 위치
  const inCrew = CREW_SCREENS.includes(route.screen) || ((route.screen === 'board' || route.screen === 'board-policy') && (session?.role === 'member' || session?.role === 'leader'));

  const crewActivity = menu.crewActivity && (
    <li className={styles.crewRoot} ref={crewRootRef}>
      <button
        ref={crewBtnRef}
        type="button"
        className={styles.item}
        data-active={inCrew || undefined}
        aria-expanded={crewOpen}
        aria-controls={crewOpen ? crewListId : undefined}
        onClick={() => setCrewOpen((o) => !o)}
      >
        크루 활동
        <svg className={styles.chev} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {crewOpen && (
        <ul className={styles.dropdown} id={crewListId}>
          {crewItems.length === 0 ? (
            <li className={styles.emptyItem}>배정된 크루가 없어요</li>
          ) : (
            crewItems.map((it: NavItem) => (
              <li key={it.key}>
                <button type="button" className={styles.dropItem} aria-current={it.activeOn.includes(route.screen) ? 'page' : undefined} onClick={() => void go(it.route)}>
                  {it.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </li>
  );

  const plainItems = menu.items.map((m) => (
    <li key={m.key}>
      <button
        type="button"
        className={styles.item}
        aria-current={!m.anchor && m.activeOn.includes(route.screen) ? 'page' : undefined}
        onClick={() => void go(m.route, m.anchor)}
      >
        {m.label}
      </button>
    </li>
  ));

  const loginButton = (
    <button
      type="button"
      className={styles.login}
      aria-current={route.screen === 'login' ? 'page' : undefined}
      onClick={() => void go({ screen: 'login', from: route.screen === 'login' ? undefined : route })}
    >
      로그인
    </button>
  );

  return (
    <header className={styles.bar} data-public={!session || undefined}>
      <div className={styles.inner}>
        <button type="button" className={styles.logo} onClick={() => void go({ screen: 'home' })} aria-label="CREW 홈">
          <img src={emblem} alt="" className={styles.emblem} width={40} height={45} />
          <span className={styles.wordmark}>
            <span className={styles.crew}>CREW</span>
            <span className={styles.by}>by Treasure Hunter</span>
          </span>
        </button>

        <nav className={styles.nav} aria-label="주 메뉴">
          <ul className={styles.list}>
            {crewActivity}
            {plainItems}
          </ul>
        </nav>

        <div className={styles.right}>
          {session && <DemoControls />}
          {session && <InboxButton />}
          {session ? (
            <div className={styles.account}>
              <p className={styles.who} data-testid="current-account">
                <span className={styles.name}>
                  {session.name} · {ROLE_LABEL[session.role]}
                </span>
                <span className={styles.scope}>{scopeOf(data, session)}</span>
              </p>
              <button type="button" className={styles.logout} onClick={() => void logout()}>
                로그아웃
              </button>
            </div>
          ) : (
            loginButton
          )}
        </div>
      </div>
    </header>
  );
}

/** 알림함 버튼 (v0.7: 44×44, 새 알림 수는 먹색 원 배지). 앱 안 알림이며 외부 발송이 아니다 */
function InboxButton() {
  const { data, session, route, navigate } = useStore();
  if (!session) return null;
  const n = unreadCount(data, session);
  return (
    <button
      type="button"
      className={styles.bell}
      aria-current={route.screen === 'inbox' ? 'page' : undefined}
      aria-label={n > 0 ? `알림, 안 읽은 알림 ${n}개` : '알림'}
      onClick={() => void navigate({ screen: 'inbox' })}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {n > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {n > 99 ? '99+' : n}
        </span>
      )}
    </button>
  );
}
