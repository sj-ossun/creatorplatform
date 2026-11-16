import { adminNoticesForCrew } from '../domain/adminNotices';
import { canUseBoard, canViewBoardPost } from '../domain/board';
import { canManageMission, canViewNotification, canWorkOnMission } from '../domain/access';
import { canViewPost } from '../domain/community';
import { canAdminSee } from '../domain/offers';
import { getFeedback, getMission, getDeliverable } from '../domain/queries';
import type { SubmissionStatus } from '../domain/status';
import type { AppData, ID, User } from '../domain/types';

/**
 * 화면 이동 상태 (v0.6 01장). 업무 데이터가 아니며 저장하지 않는다.
 * 공개 홈 → 시연 로그인 → 같은 홈 → 상단 메뉴 → 기능 페이지.
 *   공개: P-01 home(로그인 전후 같은 페이지), P-12 login, P-13 guide
 *   보호: P-02 crew, P-03 missions, P-04 mission, P-05 review, P-06 mission-create,
 *         P-08 community, P-09·10 overview, P-11 notifications(시연 도구의 알림 예시)
 * 퀵 리뷰(P-05)는 특정 미션에 속한 작업 페이지다. missionId 없이 들어가지 않는다.
 * 주소창 경로와 연결하지 않는 명시적 페이지 상태다 (직접 URL 진입은 지원하지 않는다).
 */
export type Route =
  | { screen: 'home' }
  /** P-12. from: 취소 시 돌아갈 곳. reason: 로그인 안내 문구 (대상의 이름·제목은 넣지 않는다) */
  | { screen: 'login'; from?: Route; reason?: LoginReason }
  | { screen: 'guide' }
  /** 우수 사례 소개 [공개] (4.5단계) */
  | { screen: 'showcases' }
  /** 알림함 [로그인한 모든 역할] (4.5단계) */
  | { screen: 'inbox' }
  /** D: 전체 크루 게시판 [로그인한 크루 구성원·관리자] */
  | { screen: 'board'; postId?: ID; writing?: boolean; editing?: boolean; questionsOnly?: boolean }
  | { screen: 'board-policy' }
  /** 내 제안 [크루원 본인, 읽기 전용] (4.5단계) */
  /** 크루원 '내 제안' · 크루장 '받은 제안' (6-B: 받은 광고 제안에 수락·거절) */
  | { screen: 'my-proposals'; offerId?: ID }
  /** 5단계: 크루원 내 성과 */
  | { screen: 'my-performance' }
  /** 5단계: 크루장 크루 성과 관리 [크루원 성과 | 대시보드], 크루원 보기(읽기 전용) */
  | { screen: 'crew-performance'; crewId: ID; tab?: 'members' | 'dashboard'; memberId?: ID; detailTab?: 'activity' | 'performance' }
  | { screen: 'crew'; crewId: ID }
  | { screen: 'missions'; crewId: ID }
  /** 크루원은 단일 본문(feedbackId: 알림에서 연 피드백), 크루장은 기준·대상·현황 + 퀵 리뷰 열기 */
  | { screen: 'mission'; missionId: ID; feedbackId?: ID; /** E4: 크루장 미션 고치기 */ editing?: boolean }
  | { screen: 'mission-create'; crewId: ID }
  /** P-07 게시·성과 기록: 본인의 검토 완료 결과물. 미션 상세의 하위 페이지 */
  | { screen: 'record'; missionId: ID }
  | { screen: 'review'; missionId: ID; filter?: SubmissionStatus; memberId?: ID }
  | { screen: 'notifications'; notificationId?: ID; tab?: 'feedback' | 'unsubmitted'; missionId?: ID }
  | { screen: 'community'; crewId: ID; postId?: ID; writing?: boolean; editing?: boolean }
  /** 공지 게시판: 크루장 공지(글) + 운영 공지(관리자, 읽기 전용) */
  | { screen: 'notice'; crewId: ID; postId?: ID; adminNoticeId?: ID; writing?: boolean; editing?: boolean }
  /** 6-A: Q&A게시판 (크루원 → 크루장). 비공개 질문은 작성자·크루장·담당 관리자만. 관리자는 읽기만 */
  | { screen: 'qna'; crewId: ID; postId?: ID; writing?: boolean; editing?: boolean }
  | {
      screen: 'overview';
      filter?: OverviewFilter;
      /** 크루를 고르면 구성원 목록, 구성원까지 고르면 개인 상세 */
      crewId?: ID;
      memberId?: ID;
      tab?: DetailTab;
      /** 5단계: 전체 크루 화면의 '대시보드' 탭, 6-B: '제안' 탭 */
      view?: 'status' | 'dashboard' | 'offers' | 'notices';
      /** 6-B: 제안 상세 ('new' 는 새 제안 쓰기) */
      offerId?: ID;
      /** 6-B: 조건 수정 화면 */
      offerEdit?: boolean;
      /** 6-B: 새 제안의 받는 사람 미리 고르기 (개인 상세에서) */
      presetRecipientId?: ID;
    };

/** 관리자 전체 크루 필터. 빈 값은 전체 */
export interface OverviewFilter {
  crewId: ID;
  from: string;
  to: string;
  missionId: ID;
}

export type DetailTab = 'activity' | 'performance' | 'proposals';

/** protected: 보호 페이지 요청 · crew: 비로그인으로 크루 활동 선택 · feedback: 알림의 피드백 연결 · switch: 다른 계정 체험 */
export type LoginReason = 'protected' | 'crew' | 'feedback' | 'switch';

/** 로그인 없이 볼 수 있는 페이지 (N-03) */
// 6-C: 우수 사례 페이지는 로그인한 크루 구성원 모두 (공개 홈에는 요약 배너만)
export const PUBLIC_SCREENS: Screen[] = ['home', 'login', 'guide'];

export function isPublic(route: Route): boolean {
  return PUBLIC_SCREENS.includes(route.screen);
}


export type Screen = Route['screen'];

/** 크루 공간에 속한 화면: 크루 메뉴(크루 홈 · 미션 · 소통)를 함께 보여준다 */
export const CREW_SCREENS: Screen[] = ['crew', 'missions', 'mission', 'mission-create', 'review', 'record', 'community', 'notice', 'qna', 'crew-performance'];

export interface NavItem {
  key: string;
  label: string;
  route: Route;
  /** 이 화면들에 있을 때 밝힌다 */
  activeOn: Screen[];
}

/**
 * 전역 메뉴 (v0.6 01장 3절).
 * 비로그인·크루원·크루장: 크루 활동(펼침) · 이용 가이드. 관리자: 이용 가이드 · 운영 관리.
 * 크루 활동 펼침의 항목은 crewMenu 를 그대로 쓴다. 로고는 언제나 홈.
 */
export interface GlobalMenu {
  /** 크루 활동 펼침을 보일지. 관리자에게는 소속 크루원 메뉴를 복사하지 않는다 */
  crewActivity: boolean;
  /** 크루 활동 항목을 고를 때 열 크루. 비로그인·소속 없음이면 null */
  crewId: ID | null;
  items: NavItem[];
}

export function globalMenu(user: User | null): GlobalMenu {
  const guide: NavItem = { key: 'guide', label: '이용 가이드', route: { screen: 'guide' }, activeOn: ['guide'] };
  // E1: 우수 사례는 로그인한 모든 역할의 상단 메뉴에서 바로 간다 (비로그인은 홈 요약 배너 → 로그인)
  const showcases: NavItem = { key: 'showcases', label: '우수 사례', route: { screen: 'showcases' }, activeOn: ['showcases'] };
  if (user?.role === 'admin') {
    return {
      crewActivity: false,
      crewId: null,
      // 사용자 확정 견본: 운영 관리를 맨 앞, 이용 가이드는 맨 뒤.
      // 커뮤니티: 담당 크루의 공지·자유게시판·Q&A(읽기 전용)와 전체 크루 게시판(글쓰기·숨김)을 한곳에서
      items: [
        { key: 'ops', label: '운영 관리', route: { screen: 'overview' }, activeOn: ['overview'] },
        {
          key: 'community',
          label: '커뮤니티',
          route: user.managedCrewIds[0] ? { screen: 'community', crewId: user.managedCrewIds[0] } : { screen: 'board' },
          activeOn: ['community', 'notice', 'qna', 'board', 'board-policy'],
        },
        showcases,
        guide,
      ],
    };
  }
  if (user?.role === 'member') {
    // 개인 기록: 내 제안 (사용자 결정: 크루원만, 읽기 전용)
    return {
      crewActivity: true,
      crewId: user.crewId,
      items: [
        { key: 'my-performance', label: '내 성과', route: { screen: 'my-performance' }, activeOn: ['my-performance'] },
        { key: 'my-proposals', label: '내 제안', route: { screen: 'my-proposals' }, activeOn: ['my-proposals'] },
        showcases,
        guide,
      ],
    };
  }
  if (user?.role === 'leader') {
    // 6-B: 크루장에게 온 광고 제안 (크루원 '내 제안'과 같은 위치)
    return {
      crewActivity: true,
      crewId: user.crewId,
      items: [{ key: 'my-proposals', label: '받은 제안', route: { screen: 'my-proposals' }, activeOn: ['my-proposals'] }, showcases, guide],
    };
  }
  return { crewActivity: true, crewId: user?.crewId ?? null, items: [guide] };
}

/** 크루 메뉴: 크루 홈 · 미션 · 커뮤니티 (구현된 기능만, 사용자 결정으로 '소통' → '커뮤니티') */
export function crewMenu(crewId: ID, user?: User | null): NavItem[] {
  const items: NavItem[] = [
    { key: 'crew-home', label: '크루방', route: { screen: 'crew', crewId }, activeOn: ['crew'] },
    {
      key: 'crew-missions',
      label: '미션',
      route: { screen: 'missions', crewId },
      activeOn: ['missions', 'mission', 'mission-create', 'review', 'record'],
    },
    // 사용자 결정: 커뮤니티 하나 안에 자유게시판 · Q&A게시판 (전체 크루 게시판은 만든 뒤 같은 줄에 더함)
    { key: 'crew-community', label: '커뮤니티', route: { screen: 'community', crewId }, activeOn: ['community', 'notice', 'qna', 'board', 'board-policy'] },
  ];
  // 5단계: 크루장의 크루 성과 관리 (크루원은 상단 '내 성과')
  if (user?.role === 'leader' && user.crewId === crewId) {
    items.push({ key: 'crew-performance', label: '성과', route: { screen: 'crew-performance', crewId }, activeOn: ['crew-performance'] });
  }
  return items;
}

/** 커뮤니티 안의 게시판 (탭·상단 크루 활동 펼침에서 같은 순서) */
export const COMMUNITY_BOARDS = [
  { key: 'board-notice', board: 'notice', label: '공지' },
  { key: 'board-free', board: 'community', label: '자유게시판' },
  { key: 'board-qna', board: 'qna', label: 'Q&A게시판' },
] as const;

/** E2: 커뮤니티 왼쪽 세로 메뉴 (크루 게시판 셋 + 전체 크루 게시판) */
export const COMMUNITY_SIDE_ITEMS: { key: string; label: string }[] = [...COMMUNITY_BOARDS.map((b) => ({ key: b.board as string, label: b.label })), { key: 'global', label: '전체 크루 게시판' }];

/** 화면이 속한 크루. 크루 공간이 아니면 null */
export function crewOfRoute(data: AppData, route: Route): ID | null {
  switch (route.screen) {
    case 'crew':
    case 'missions':
    case 'mission-create':
    case 'community':
    case 'notice':
    case 'qna':
    case 'crew-performance':
      return route.crewId;
    case 'mission':
    case 'review':
    case 'record':
      return getMission(data, route.missionId)?.crewId ?? null;
    default:
      return null;
  }
}

/** 로그인·로그아웃·초기화 뒤의 도착지: 역할과 관계없이 홈 (N-01) */
export const HOME: Route = { screen: 'home' };

/**
 * 화면 이동마다 예시 접근 범위를 확인한다 (v0.6 N-03, 03 F-10).
 * 메뉴 숨김만으로 데이터 분리를 대신하지 않는다. 실제 서버 보안이 아니다.
 */
export function canOpen(data: AppData, user: User | null, route: Route): boolean {
  if (isPublic(route)) return true;
  // 보호 페이지: 로그인하지 않았으면 열지 않는다 (미구현 단계도 같은 검사)
  if (!user) return false;
  const inOwnCrew = (crewId: ID) => (user.role === 'leader' || user.role === 'member') && user.crewId === crewId;
  switch (route.screen) {
    case 'board': {
      if (!canUseBoard(user)) return false;
      if (route.writing) return true;
      if (!route.postId) return !route.editing;
      if (!canViewBoardPost(data, user, route.postId)) return false;
      if (!route.editing) return true;
      const post = data.globalPosts.find((p) => p.id === route.postId);
      return !!post && post.authorId === user.id && !post.hidden;
    }
    case 'home':
    case 'login':
    case 'guide':
    case 'board-policy':
    case 'showcases':
    case 'inbox':
      return true;
    case 'my-performance':
      return user.role === 'member';
    case 'my-proposals': {
      if (user.role !== 'member' && user.role !== 'leader') return false;
      if (!route.offerId) return true;
      return data.offerRecipients.some((r) => r.offerId === route.offerId && r.userId === user.id);
    }
    case 'crew-performance': {
      if (user.role !== 'leader' || user.crewId !== route.crewId) return false;
      if (!route.memberId) return true;
      const member = data.users.find((x) => x.id === route.memberId);
      return !!member && member.role === 'member' && member.crewId === route.crewId;
    }
    case 'crew':
    case 'missions':
      return inOwnCrew(route.crewId);
    case 'mission-create':
      return user.role === 'leader' && inOwnCrew(route.crewId);
    case 'review': {
      const mission = getMission(data, route.missionId);
      if (!mission || !canManageMission(user, mission)) return false;
      return !route.memberId || mission.targetIds.includes(route.memberId);
    }
    case 'mission': {
      const mission = getMission(data, route.missionId);
      if (!mission) return false;
      if (user.role === 'leader') return canManageMission(user, mission) && !route.feedbackId;
      if (route.editing) return false;
      if (!canWorkOnMission(user, mission)) return false;
      if (route.feedbackId) {
        const fb = getFeedback(data, route.feedbackId);
        const del = fb && getDeliverable(data, fb.deliverableId);
        return !!del && del.memberId === user.id && del.missionId === mission.id;
      }
      return true;
    }
    case 'record': {
      // 본인 결과물이 검토 완료일 때만 (F-07)
      const mission = getMission(data, route.missionId);
      if (!mission || user.role !== 'member' || !canWorkOnMission(user, mission)) return false;
      return data.deliverables.some((d) => d.missionId === mission.id && d.memberId === user.id && d.status === 'completed');
    }
    case 'notifications': {
      // 시연 도구의 알림 예시 (F-11): 크루원은 본인이 받은 피드백 알림만, 미제출 안내(F-11B)는 크루장·관리자
      if (user.role === 'member' && (route.tab === 'unsubmitted' || route.missionId)) return false;
      if (route.missionId) {
        const mission = getMission(data, route.missionId);
        if (!mission) return false;
        const allowed = user.role === 'leader' ? user.crewId === mission.crewId : user.role === 'admin' && user.managedCrewIds.includes(mission.crewId);
        if (!allowed) return false;
      }
      if (!route.notificationId) return true;
      const n = data.notifications.find((x) => x.id === route.notificationId);
      return !!n && canViewNotification(data, user, n);
    }
    case 'community': {
      // 관리자: 담당 크루 자유게시판을 읽기만 (크루원에게 '운영팀도 볼 수 있어요' 안내)
      if (user.role === 'admin') {
        if (!user.managedCrewIds.includes(route.crewId) || route.writing || route.editing) return false;
        if (!route.postId) return true;
        const p = data.communityPosts.find((x) => x.id === route.postId);
        return !!p && p.crewId === route.crewId && p.kind === 'post';
      }
      if (!inOwnCrew(route.crewId)) return false;
      if (!route.postId) return !route.editing;
      const post = data.communityPosts.find((p) => p.id === route.postId);
      if (!post || post.crewId !== route.crewId || post.kind !== 'post') return false;
      return !route.editing || (post.authorId === user.id && !post.deletedAt);
    }
    case 'notice': {
      // E3: 관리자는 담당 크루의 공지를 크루가 보는 모습 그대로 읽기만 한다 (운영 공지 확인·크루장 공지 보기)
      if (user.role === 'admin') {
        if (!user.managedCrewIds.includes(route.crewId) || route.writing || route.editing) return false;
        if (route.adminNoticeId) return adminNoticesForCrew(data, route.crewId).some((n) => n.id === route.adminNoticeId);
        if (!route.postId) return true;
        const p = data.communityPosts.find((x) => x.id === route.postId);
        return !!p && p.crewId === route.crewId && p.kind === 'notice';
      }
      if (!inOwnCrew(route.crewId)) return false;
      if (route.writing && user.role !== 'leader') return false;
      if (route.adminNoticeId) return !route.editing && adminNoticesForCrew(data, route.crewId).some((n) => n.id === route.adminNoticeId);
      if (!route.postId) return !route.editing;
      const post = data.communityPosts.find((p) => p.id === route.postId);
      if (!post || post.crewId !== route.crewId || post.kind !== 'notice') return false;
      return !route.editing || (post.authorId === user.id && !post.deletedAt);
    }
    case 'qna': {
      const adminView = user.role === 'admin' && user.managedCrewIds.includes(route.crewId);
      if (!inOwnCrew(route.crewId) && !adminView) return false;
      if (adminView && (route.writing || route.editing)) return false;
      if (route.writing && user.role !== 'member') return false;
      if (!route.postId) return !route.editing;
      const post = data.communityPosts.find((p) => p.id === route.postId);
      if (!post || post.crewId !== route.crewId || post.kind !== 'question' || !canViewPost(data, user, post)) return false;
      return !route.editing || (post.authorId === user.id && !post.deletedAt);
    }
    case 'overview': {
      if (user.role !== 'admin') return false;
      const crewIds = [route.crewId, route.filter?.crewId].filter(Boolean) as ID[];
      if (crewIds.some((id) => !user.managedCrewIds.includes(id))) return false;
      if (route.memberId) {
        const member = data.users.find((u) => u.id === route.memberId);
        if (!member || member.role !== 'member' || member.crewId !== route.crewId) return false;
      }
      if (route.offerId && route.offerId !== 'new') {
        const offer = data.offers.find((o) => o.id === route.offerId);
        if (!offer || !canAdminSee(data, user, offer)) return false;
      }
      return true;
    }
  }
}

/**
 * E2 '이전 페이지': 앱 안에서 지나온 화면을 기억해 한 단계씩 돌아간다.
 * 주소창과 연결하지 않으므로(공유 링크 안에서는 주소를 바꿀 수 없음) 브라우저 뒤로 버튼과는 따로다.
 * 같은 페이지 안의 조회 조건(필터·질문만 보기·상세 탭)만 바뀌면 새 기록을 쌓지 않는다.
 */
const IN_PAGE_KEYS = new Set(['filter', 'questionsOnly', 'tab', 'detailTab']);

export function pageKey(route: Route): string {
  const r = route as Record<string, unknown>;
  return JSON.stringify(
    Object.keys(r)
      .filter((k) => !IN_PAGE_KEYS.has(k) && r[k] !== undefined)
      .sort()
      .map((k) => [k, r[k]]),
  );
}

/** 돌아갈 때 건너뛰는 입력 화면 (저장했거나 취소한 쓰기·고치기 화면으로 되돌아가지 않는다) */
export function isFormRoute(route: Route): boolean {
  const r = route as { screen: Screen; writing?: boolean; editing?: boolean; offerEdit?: boolean; offerId?: string };
  return r.screen === 'mission-create' || r.screen === 'login' || !!r.writing || !!r.editing || !!r.offerEdit || r.offerId === 'new';
}

export const HISTORY_MAX = 30;

/** 이동할 때: 다른 페이지로 가면 지금 화면을 기록에 쌓는다 */
export function pushHistory(history: Route[], current: Route, next: Route): Route[] {
  if (pageKey(current) === pageKey(next)) return history;
  return [...history, current].slice(-HISTORY_MAX);
}

/** 돌아갈 곳: 입력 화면·지금과 같은 화면·지금 열 수 없는 화면은 건너뛴다. 없으면 홈 */
export function popHistory(history: Route[], current: Route, openable: (r: Route) => boolean): { target: Route; rest: Route[] } {
  const rest = [...history];
  while (rest.length) {
    const prev = rest.pop()!;
    if (isFormRoute(prev) || pageKey(prev) === pageKey(current) || !openable(prev)) continue;
    return { target: prev, rest };
  }
  return { target: HOME, rest: [] };
}
