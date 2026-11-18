import type { ReactNode } from 'react';
import { getCrew } from '../../domain/queries';
import type { AppData, Crew, User } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import { COMMUNITY_BOARDS, crewMenu, crewOfRoute, type Route } from '../../state/routes';
import styles from './CrewNav.module.css';

/** 크루 공간 화면이면 그 크루 (내 크루만). 퀵 리뷰는 넓게 쓰려고 왼쪽 메뉴 없이 연다 */
export function crewSpaceOf(data: AppData, user: User, route: Route): Crew | null {
  if (route.screen === 'review') return null;
  const onBoard = (route.screen === 'board' || route.screen === 'board-policy') && (user.role === 'member' || user.role === 'leader');
  const crewId = crewOfRoute(data, route) ?? (onBoard ? user.crewId : null);
  const crew = getCrew(data, crewId);
  if (!crew || user.crewId !== crew.id) return null;
  return crew;
}

const ICON: Record<string, ReactNode> = {
  'crew-home': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20H4z" />
      <path d="M10 20v-5h4v5" />
    </svg>
  ),
  'crew-missions': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 21V4h11l-2 4 2 4H5" />
    </svg>
  ),
  'crew-community': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v11H9l-5 4z" />
    </svg>
  ),
  'crew-performance': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  ),
};

/**
 * 크루 메뉴 카드 (v0.7 6.3, 사용자 확정 견본): 크루 공간 화면의 왼쪽 흰 카드.
 * 크루 이름 · 크루방 · 미션 · 커뮤니티(· 성과: 크루장). 커뮤니티에 있으면 아래에 게시판 4개를 들여 쓴다.
 * 아래에 이용 가이드 카드. 데스크톱에서는 스크롤해도 위에 붙어 있다.
 * 767px 이하: 위쪽 가로 탭(게시판·가이드 카드는 숨김. 게시판은 커뮤니티 화면 위 칩으로).
 */
export function CrewNav({ crew }: { crew: Crew }) {
  const { user, route, navigate } = useStore();
  const items = crewMenu(crew.id, user);
  const inCommunity = ['community', 'notice', 'qna', 'board', 'board-policy'].includes(route.screen);
  const boardCurrent = (b: string) => (b === 'global' ? route.screen === 'board' || route.screen === 'board-policy' : route.screen === b);
  return (
    <nav className={styles.card} aria-label="크루 메뉴">
      <div>
        <p className={styles.crewName}>{crew.name} 크루</p>
        <ul className={styles.list}>
          {items.map((m) => (
            <li key={m.key}>
              <button type="button" className={styles.item} aria-current={m.activeOn.includes(route.screen) ? 'page' : undefined} onClick={() => void navigate(m.route)}>
                {ICON[m.key]}
                {m.label}
              </button>
              {m.key === 'crew-community' && inCommunity && (
                <ul className={styles.subs} aria-label="커뮤니티 게시판">
                  {[...COMMUNITY_BOARDS.map((b) => ({ key: b.board as string, label: b.label })), { key: 'global', label: '전체 크루 게시판' }].map((b) => (
                    <li key={b.key}>
                      <button
                        type="button"
                        className={styles.sub}
                        aria-current={boardCurrent(b.key) ? 'page' : undefined}
                        onClick={() => void navigate(b.key === 'global' ? { screen: 'board' } : ({ screen: b.key, crewId: crew.id } as Route))}
                      >
                        {b.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
      <aside className={styles.guide} aria-label="이용 가이드 안내">
        <svg viewBox="0 0 90 70" aria-hidden="true" className={styles.guideArt}>
          <ellipse cx="44" cy="64" rx="30" ry="4" fill="#F4D7BE" />
          <rect x="22" y="22" width="44" height="38" rx="6" fill="#fff" stroke="#20232B" strokeWidth="2.5" />
          <path d="M44 22v38" stroke="#20232B" strokeWidth="2.5" />
          <path d="M28 32h10M28 40h10M50 32h10M50 40h8" stroke="#C9CED8" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="72" cy="16" r="8" fill="#FFC9A0" stroke="#20232B" strokeWidth="2" />
        </svg>
        <b>처음이라면 이용 가이드부터</b>
        <p>제출부터 피드백까지 순서대로 정리했어요.</p>
        <button type="button" className={styles.guideLink} onClick={() => void navigate({ screen: 'guide' })}>
          이용 가이드 보기
        </button>
      </aside>
    </nav>
  );
}

/** 휴대폰: 커뮤니티 화면 위 게시판 칩 (옆으로 밀기). 데스크톱에서는 왼쪽 크루 메뉴 카드에 있어서 숨긴다 */
export function BoardChips({ crewId }: { crewId: string }) {
  const { route, navigate } = useStore();
  const boards = [...COMMUNITY_BOARDS.map((b) => ({ key: b.board as string, label: b.label })), { key: 'global', label: '전체 크루 게시판' }];
  const current = (b: string) => (b === 'global' ? route.screen === 'board' || route.screen === 'board-policy' : route.screen === b);
  return (
    <nav className={styles.chips} aria-label="커뮤니티 게시판 고르기">
      {boards.map((b) => (
        <button
          key={b.key}
          type="button"
          className={styles.chip}
          aria-current={current(b.key) ? 'page' : undefined}
          onClick={() => void navigate(b.key === 'global' ? { screen: 'board' } : ({ screen: b.key, crewId } as Route))}
        >
          {b.label}
        </button>
      ))}
    </nav>
  );
}
