import { useCallback, useEffect, useId, useRef, useState } from 'react';
import emblem from '../../assets/brand/th-emblem.png';
import { getCrew } from '../../domain/queries';
import { ROLE_LABEL, type User, type AppData } from '../../domain/types';
import { useDismiss } from '../../hooks/useDismiss';
import { unreadCount } from '../../domain/inbox';
import { useStore } from '../../state/AppStore';
import { COMMUNITY_BOARDS, CREW_SCREENS, crewMenu, globalMenu, type NavItem, type Route } from '../../state/routes';
import { DemoControls } from '../DemoControls/DemoControls';
import styles from './TopNav.module.css';

/** 크루 활동 펼침의 항목. 비로그인이면 크루를 모르므로 이름만 보이고 고르면 로그인 안내로 간다 */
const GUEST_CREW_ITEMS = ['크루 홈', '미션', '커뮤니티', ...COMMUNITY_BOARDS.map((b) => b.label)];

function scopeOf(data: AppData, user: User) {
  if (user.role === 'admin') return `${user.managedCrewIds.map((id) => getCrew(data, id)?.name).join('·')} 담당`;
  const crew = getCrew(data, user.crewId);
  return crew ? `${crew.name} 크루` : '배정된 크루 없음';
}

/**
 * GlobalHeader (v0.6 02 1장, 04 5장)
 *   [TH 심볼 CREW / by Treasure Hunter] [크루 활동 ▾] [이용 가이드] [운영 관리: 관리자]   [시연 도구] [이름·역할 · 로그아웃 | 로그인]
 * 768px 미만: 로고 + (로그인 | 시연 도구) + 메뉴 버튼 → 같은 항목을 세로로 펼친다.
 * 크루 안의 메뉴(크루 홈·미션·소통)는 크루 업무 화면에서 CrewNav 가 함께 보여준다.
 */
export function TopNav() {
  const { data, session, route, navigate, logout } = useStore();
  const menu = globalMenu(session);
  const [crewOpen, setCrewOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const crewBtnRef = useRef<HTMLButtonElement>(null);
  const crewRootRef = useRef<HTMLLIElement>(null);
  const mobileBtnRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const crewListId = useId();
  const mobileId = useId();
  const closeCrew = useCallback(() => setCrewOpen(false), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  useDismiss(crewOpen, crewRootRef, closeCrew, crewBtnRef);
  useDismiss(mobileOpen, headerRef, closeMobile, mobileBtnRef);

  // 페이지가 바뀌면 펼친 메뉴를 닫는다
  useEffect(() => {
    setCrewOpen(false);
    setMobileOpen(false);
  }, [route]);

  const go = async (r: Route) => {
    if (await navigate(r)) {
      setCrewOpen(false);
      setMobileOpen(false);
    }
  };

  // 커뮤니티는 묶음 이름(누르지 않음) 아래에 게시판을 들여 쓴다
  type CrewItem = { key: string; label: string; onSelect: () => void; current: boolean; group?: boolean; sub?: boolean };
  const crewItems: CrewItem[] = (() => {
    if (!menu.crewActivity) return [];
    if (!session) {
      return GUEST_CREW_ITEMS.map((label) => ({
        key: label,
        label,
        current: false,
        group: label === '커뮤니티',
        sub: COMMUNITY_BOARDS.some((b) => b.label === label),
        onSelect: () => void go({ screen: 'login', reason: 'crew' }),
      }));
    }
    if (!menu.crewId) return [];
    const crewId = menu.crewId;
    return crewMenu(crewId, session).flatMap((m: NavItem): CrewItem[] =>
      m.key === 'crew-community'
        ? [
            { key: 'community-group', label: m.label, current: false, group: true, onSelect: () => {} },
            ...COMMUNITY_BOARDS.map((b) => ({
              key: b.key,
              label: b.label,
              sub: true,
              current: route.screen === b.board,
              onSelect: () => void go({ screen: b.board, crewId }),
            })),
          ]
        : [{ key: m.key, label: m.label, current: m.activeOn.includes(route.screen), onSelect: () => void go(m.route) }],
    );
  })();
  const inCrew = CREW_SCREENS.includes(route.screen);

  const crewActivity = (variant: 'desktop' | 'mobile') =>
    menu.crewActivity && (
      <li className={styles.crewRoot} ref={variant === 'desktop' ? crewRootRef : undefined}>
        {variant === 'desktop' ? (
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
            <span aria-hidden="true" className={styles.chev}>
              ▾
            </span>
          </button>
        ) : (
          <p className={styles.groupLabel}>크루 활동</p>
        )}
        {(variant === 'mobile' || crewOpen) && (
          <ul className={variant === 'desktop' ? styles.dropdown : styles.subList} id={variant === 'desktop' ? crewListId : undefined}>
            {crewItems.length === 0 ? (
              <li className={styles.emptyItem}>배정된 크루가 없어요</li>
            ) : (
              crewItems.map((it) =>
                it.group ? (
                  <li key={it.key} className={styles.dropGroup}>
                    {it.label}
                  </li>
                ) : (
                <li key={it.key}>
                  <button
                    type="button"
                    className={`${styles.dropItem} ${it.sub ? styles.dropSub : ''}`}
                    aria-current={it.current ? 'page' : undefined}
                    onClick={it.onSelect}
                  >
                    {it.label}
                  </button>
                </li>
                ),
              )
            )}
            {!session && <li className={styles.dropNote}>로그인하면 내 크루로 바로 가요</li>}
          </ul>
        )}
      </li>
    );

  const plainItems = menu.items.map((m) => (
    <li key={m.key}>
      <button
        type="button"
        className={styles.item}
        aria-current={m.activeOn.includes(route.screen) ? 'page' : undefined}
        onClick={() => void go(m.route)}
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
    <header className={styles.bar} ref={headerRef}>
      <div className={styles.inner}>
        <button type="button" className={styles.logo} onClick={() => void go({ screen: 'home' })} aria-label="CREW 홈">
          <img src={emblem} alt="" className={styles.emblem} width={30} height={34} />
          <span className={styles.wordmark}>
            <span className={styles.crew}>CREW</span>
            <span className={styles.by}>by Treasure Hunter</span>
          </span>
        </button>

        <nav className={styles.nav} aria-label="주 메뉴">
          <ul className={styles.list}>
            {crewActivity('desktop')}
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
            <span className={styles.desktopOnly}>{loginButton}</span>
          )}
          {!session && <span className={styles.mobileOnly}>{loginButton}</span>}
          <button
            ref={mobileBtnRef}
            type="button"
            className={styles.menuToggle}
            aria-expanded={mobileOpen}
            aria-controls={mobileOpen ? mobileId : undefined}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <span className={styles.burger} aria-hidden="true" />
            <span className={styles.menuText}>메뉴</span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className={styles.mobilePanel} id={mobileId} aria-label="모바일 메뉴">
          <ul className={styles.mobileList}>
            <li>
              <button
                type="button"
                className={styles.item}
                aria-current={route.screen === 'home' ? 'page' : undefined}
                onClick={() => void go({ screen: 'home' })}
              >
                홈
              </button>
            </li>
            {crewActivity('mobile')}
            {plainItems}
          </ul>
          {session ? (
            <div className={styles.mobileAccount}>
              <p className={styles.who}>
                <span className={styles.name}>
                  {session.name} · {ROLE_LABEL[session.role]}
                </span>
                <span className={styles.scope}>{scopeOf(data, session)}</span>
              </p>
              <button type="button" className={styles.logout} onClick={() => void logout()}>
                로그아웃
              </button>
            </div>
          ) : null}
        </nav>
      )}
    </header>
  );
}

/** 알림함 버튼 (4.5단계): 안 읽은 알림 수. 앱 안 알림이며 외부 발송이 아니다 */
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
      <svg width="18" height="18" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M3.5 9.5V6.3a3.5 3.5 0 0 1 7 0v3.2l1 1.2h-9z" />
        <path d="M5.8 12.2a1.3 1.3 0 0 0 2.4 0" />
      </svg>
      <span className={styles.bellText}>알림</span>
      {n > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {n > 99 ? '99+' : n}
        </span>
      )}
    </button>
  );
}
