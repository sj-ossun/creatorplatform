import { canManageMission, canViewNotification, canWorkOnMission } from '../domain/access';
import { getFeedback, getMission, getDeliverable } from '../domain/queries';
import type { SubmissionStatus } from '../domain/status';
import type { AppData, ID, Role, User } from '../domain/types';

/**
 * 화면 이동 상태 (UI_STRUCTURE 6장). 업무 데이터가 아니며 저장하지 않는다.
 * 미션 목록 → 미션 상세(크루원)·미션 개요(크루장) → 퀵 리뷰 순서로 이동한다.
 */
export type Route =
  | { screen: 'home' }
  | { screen: 'missions' }
  /** 크루원은 미션 상세(UI-03), 크루장은 미션 개요(UI-04). feedbackId 는 알림에서 연 피드백 */
  | { screen: 'mission'; missionId: ID; feedbackId?: ID }
  | { screen: 'mission-create' }
  /** 퀵 리뷰는 미션을 고른 뒤 들어가는 작업 화면이다 */
  | { screen: 'review'; missionId: ID; filter?: SubmissionStatus; memberId?: ID }
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
  /** 시연 영역(실제 발송 없음)이면 표시 */
  sim?: boolean;
}

/** 이 화면에 있을 때 밝힐 메뉴 */
export function menuOf(screen: Screen): Screen {
  if (screen === 'mission' || screen === 'mission-create' || screen === 'review') return 'missions';
  return screen;
}

/** 역할별 상단 메뉴 (UI_STRUCTURE 3장). 퀵 리뷰는 미션을 고른 뒤 들어간다 */
export const MENUS: Record<Role, MenuItem[]> = {
  member: [
    { screen: 'home', label: '홈' },
    { screen: 'missions', label: '미션' },
    { screen: 'community', label: '크루 소통' },
  ],
  leader: [
    { screen: 'home', label: '홈' },
    { screen: 'missions', label: '미션' },
    { screen: 'community', label: '크루 소통' },
    { screen: 'notifications', label: '알림 미리보기', sim: true },
  ],
  admin: [
    { screen: 'overview', label: '전체 크루' },
    { screen: 'notifications', label: '알림 미리보기', sim: true },
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
  if (!MENUS[user.role].some((m) => m.screen === menuOf(route.screen))) return false;
  switch (route.screen) {
    case 'home':
    case 'missions':
      return true;
    case 'mission-create':
      return user.role === 'leader';
    case 'review': {
      const mission = getMission(data, route.missionId);
      if (!mission || !canManageMission(user, mission)) return false;
      if (route.memberId) return mission.targetIds.includes(route.memberId);
      return true;
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
