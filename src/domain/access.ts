/**
 * 예시 접근 범위 (A-07, 6.1, 14장).
 * 시연용 검사다. 실제 서버 권한 검사가 아니며 메뉴 숨김만으로 대신하지 않도록
 * 화면 이동과 렌더링에서 함께 호출한다.
 */
import { getDeliverable, getMission } from './queries';
import type { AppData, Deliverable, ID, Mission, NotificationExample, User } from './types';

/** 사용자가 업무 데이터를 볼 수 있는 크루 */
export function scopeCrewIds(user: User): ID[] {
  if (user.role === 'admin') return user.managedCrewIds;
  return user.crewId ? [user.crewId] : [];
}

export function isLeaderOf(user: User, crewId: ID) {
  return user.role === 'leader' && user.crewId === crewId;
}

/** 크루장: 자기 크루 미션만 관리 */
export function canManageMission(user: User, mission: Mission) {
  return isLeaderOf(user, mission.crewId);
}

/** 크루원: 대상자로 지정된 미션만 */
export function canWorkOnMission(user: User, mission: Mission) {
  return user.role === 'member' && mission.targetIds.includes(user.id);
}

/** 제출·피드백 열람: 본인, 담당 크루장, 담당 관리자 */
export function canViewDeliverable(data: AppData, user: User, deliverable: Deliverable) {
  const mission = getMission(data, deliverable.missionId);
  if (!mission) return false;
  if (user.role === 'member') return deliverable.memberId === user.id;
  if (user.role === 'leader') return isLeaderOf(user, mission.crewId);
  return user.managedCrewIds.includes(mission.crewId);
}

/** 알림 미리보기: 크루장은 자기 크루, 관리자는 담당 크루, 크루원은 받는 사람 본인 */
export function canViewNotification(data: AppData, user: User, n: NotificationExample) {
  const deliverable = getDeliverable(data, n.deliverableId);
  if (!deliverable) return false;
  if (user.role === 'member') return n.recipientId === user.id;
  return canViewDeliverable(data, user, deliverable);
}

export function notificationsVisibleTo(data: AppData, user: User): NotificationExample[] {
  return data.notifications
    .filter((n) => canViewNotification(data, user, n))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
