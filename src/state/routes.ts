import { canManageMission, canViewNotification, canWorkOnMission } from '../domain/access';
import { getFeedback, getMission, getDeliverable } from '../domain/queries';
import type { SubmissionStatus } from '../domain/status';
import type { AppData, ID, Role, User } from '../domain/types';

export type Route =
  | { screen: 'missions'; missionId?: ID; creating?: boolean }
  | { screen: 'review'; missionId?: ID; filter?: SubmissionStatus; memberId?: ID }
  | { screen: 'my-missions'; missionId?: ID; feedbackId?: ID }
  | { screen: 'notifications'; notificationId?: ID; tab?: 'feedback' | 'unsubmitted'; missionId?: ID }
  | { screen: 'community'; postId?: ID; writing?: boolean }
  | {
      screen: 'overview';
      filter?: OverviewFilter;
      /** 크루를 고르면 구성원 목록 | 개인 상세 (SC-07) */
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

export interface MenuItem {
  screen: Screen;
  label: string;
}

/** 역할별 메뉴 (디자인 6.2) */
export const MENUS: Record<Role, MenuItem[]> = {
  member: [
    { screen: 'my-missions', label: '내 미션' },
    { screen: 'community', label: '크루 소통' },
  ],
  leader: [
    { screen: 'missions', label: '미션' },
    { screen: 'review', label: '퀵 리뷰' },
    { screen: 'community', label: '크루 소통' },
    { screen: 'notifications', label: '알림 미리보기' },
  ],
  admin: [
    { screen: 'overview', label: '전체 크루' },
    { screen: 'notifications', label: '알림 미리보기' },
  ],
};

export function startRoute(user: User): Route {
  return { screen: MENUS[user.role][0].screen } as Route;
}

/**
 * 화면 이동마다 예시 접근 범위를 확인한다 (명세 F-10, 11.2).
 * 메뉴 숨김만으로 데이터 분리를 대신하지 않는다. 실제 서버 보안이 아니다.
 */
export function canOpen(data: AppData, user: User, route: Route): boolean {
  if (!MENUS[user.role].some((m) => m.screen === route.screen)) return false;
  switch (route.screen) {
    case 'missions':
    case 'review': {
      if (!route.missionId) return true;
      const mission = getMission(data, route.missionId);
      if (!mission || !canManageMission(user, mission)) return false;
      if (route.screen === 'review' && route.memberId) return mission.targetIds.includes(route.memberId);
      return true;
    }
    case 'my-missions': {
      if (!route.missionId) return true;
      const mission = getMission(data, route.missionId);
      if (!mission || !canWorkOnMission(user, mission)) return false;
      if (route.feedbackId) {
        const fb = getFeedback(data, route.feedbackId);
        const del = fb && getDeliverable(data, fb.deliverableId);
        return !!del && del.memberId === user.id && del.missionId === mission.id;
      }
      return true;
    }
    case 'notifications': {
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
      if (!route.postId) return true;
      const post = data.communityPosts.find((p) => p.id === route.postId);
      return !!post && post.crewId === user.crewId;
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
