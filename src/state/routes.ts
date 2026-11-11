import { canManageMission, canViewNotification, canWorkOnMission } from '../domain/access';
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
  | { screen: 'crew'; crewId: ID }
  | { screen: 'missions'; crewId: ID }
  /** 크루원은 단일 본문(feedbackId: 알림에서 연 피드백), 크루장은 기준·대상·현황 + 퀵 리뷰 열기 */
  | { screen: 'mission'; missionId: ID; feedbackId?: ID }
  | { screen: 'mission-create'; crewId: ID }
  | { screen: 'review'; missionId: ID; filter?: SubmissionStatus; memberId?: ID }
  | { screen: 'notifications'; notificationId?: ID; tab?: 'feedback' | 'unsubmitted'; missionId?: ID }
  | { screen: 'community'; crewId: ID; postId?: ID; writing?: boolean }
  | {
      screen: 'overview';
      filter?: OverviewFilter;
      /** 크루를 고르면 구성원 목록, 구성원까지 고르면 개인 상세 */
      crewId?: ID;
      memberId?: ID;
      tab?: DetailTab;
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
export const PUBLIC_SCREENS: Screen[] = ['home', 'login', 'guide'];

export function isPublic(route: Route): boolean {
  return PUBLIC_SCREENS.includes(route.screen);
}


export type Screen = Route['screen'];

/** 크루 공간에 속한 화면: 크루 메뉴(크루 홈 · 미션 · 소통)를 함께 보여준다 */
export const CREW_SCREENS: Screen[] = ['crew', 'missions', 'mission', 'mission-create', 'review', 'community'];

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
  if (user?.role === 'admin') {
    return {
      crewActivity: false,
      crewId: null,
      items: [guide, { key: 'ops', label: '운영 관리', route: { screen: 'overview' }, activeOn: ['overview'] }],
    };
  }
  return { crewActivity: true, crewId: user?.crewId ?? null, items: [guide] };
}

/** 크루 메뉴: 크루 홈 · 미션 · 소통 (구현된 기능만) */
export function crewMenu(crewId: ID): NavItem[] {
  return [
    { key: 'crew-home', label: '크루 홈', route: { screen: 'crew', crewId }, activeOn: ['crew'] },
    {
      key: 'crew-missions',
      label: '미션',
      route: { screen: 'missions', crewId },
      activeOn: ['missions', 'mission', 'mission-create', 'review'],
    },
    { key: 'crew-community', label: '소통', route: { screen: 'community', crewId }, activeOn: ['community'] },
  ];
}

/** 화면이 속한 크루. 크루 공간이 아니면 null */
export function crewOfRoute(data: AppData, route: Route): ID | null {
  switch (route.screen) {
    case 'crew':
    case 'missions':
    case 'mission-create':
    case 'community':
      return route.crewId;
    case 'mission':
    case 'review':
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
    case 'home':
    case 'login':
    case 'guide':
      return true;
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
      if (!canWorkOnMission(user, mission)) return false;
      if (route.feedbackId) {
        const fb = getFeedback(data, route.feedbackId);
        const del = fb && getDeliverable(data, fb.deliverableId);
        return !!del && del.memberId === user.id && del.missionId === mission.id;
      }
      return true;
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
      if (!inOwnCrew(route.crewId)) return false;
      if (!route.postId) return true;
      const post = data.communityPosts.find((p) => p.id === route.postId);
      return !!post && post.crewId === route.crewId;
    }
    case 'overview': {
      if (user.role !== 'admin') return false;
      const crewIds = [route.crewId, route.filter?.crewId].filter(Boolean) as ID[];
      if (crewIds.some((id) => !user.managedCrewIds.includes(id))) return false;
      if (route.memberId) {
        const member = data.users.find((u) => u.id === route.memberId);
        if (!member || member.role !== 'member' || member.crewId !== route.crewId) return false;
      }
      return true;
    }
  }
}
