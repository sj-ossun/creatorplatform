import { canManageMission, canViewNotification, canWorkOnMission } from '../domain/access';
import { getFeedback, getMission, getDeliverable } from '../domain/queries';
import type { SubmissionStatus } from '../domain/status';
import type { AppData, ID, User } from '../domain/types';

/**
 * 화면 이동 상태 (v0.4 01장). 업무 데이터가 아니며 저장하지 않는다.
 * 서비스 전체 → 크루 공간 → 개별 미션 → 작업 의 네 계층을 따른다.
 *   P-01 home, P-02 crew, P-03 missions, P-04 mission, P-05 review, P-06 mission-create,
 *   P-08 community(크루 소통), P-09·10 overview(운영 관리), P-11 notifications(시연 도구)
 * 퀵 리뷰(P-05)는 특정 미션에 속한 작업 페이지다. missionId 없이 들어가지 않는다.
 */
export type Route =
  | { screen: 'home' }
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

/** 전역 메뉴 (v0.4 01장 3절): 크루장·크루원은 CREW 홈 · 내 크루, 관리자는 운영 관리 */
export function globalMenu(user: User): NavItem[] {
  if (user.role === 'admin') {
    return [{ key: 'ops', label: '운영 관리', route: { screen: 'overview' }, activeOn: ['overview'] }];
  }
  const crewId = user.crewId ?? '';
  return [
    { key: 'home', label: '홈', route: { screen: 'home' }, activeOn: ['home'] },
    { key: 'crew', label: '내 크루', route: { screen: 'crew', crewId }, activeOn: CREW_SCREENS },
  ];
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

export function startRoute(user: User): Route {
  return user.role === 'admin' ? { screen: 'overview' } : { screen: 'home' };
}

/**
 * 화면 이동마다 예시 접근 범위를 확인한다 (v0.4 01장 7절, 02 F-10).
 * 메뉴 숨김만으로 데이터 분리를 대신하지 않는다. 실제 서버 보안이 아니다.
 */
export function canOpen(data: AppData, user: User, route: Route): boolean {
  const inOwnCrew = (crewId: ID) => (user.role === 'leader' || user.role === 'member') && user.crewId === crewId;
  switch (route.screen) {
    case 'home':
      return user.role === 'leader' || user.role === 'member';
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
      // 시연 도구의 알림 미리보기: 크루장(자기 크루)·관리자(담당 크루)
      if (user.role !== 'leader' && user.role !== 'admin') return false;
      if (route.missionId) {
        const mission = getMission(data, route.missionId);
        if (!mission) return false;
        const allowed = user.role === 'leader' ? user.crewId === mission.crewId : user.managedCrewIds.includes(mission.crewId);
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
