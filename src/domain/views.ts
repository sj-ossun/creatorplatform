/**
 * 화면용 조회 (UI_STRUCTURE 6장). 접근 범위를 적용해 원본 기록에서 계산만 한다.
 * 홈·미션 목록·상세·퀵 리뷰가 같은 함수를 재사용하며, 결과를 따로 저장하지 않는다.
 */
import { aggregateStatuses, type StatusCounts } from './aggregate';
import { missionsAssignedTo, missionsOfCrew, statusOf } from './queries';
import type { SubmissionStatus } from './status';
import type { AppData, Mission, User } from './types';

export type ListFilter = 'all' | 'todo' | 'done';

/** 사용자에게 보이는 미션: 크루장은 자기 크루 미션, 크루원은 배정된 미션 (원본 정렬: 최근 등록순) */
export function visibleMissions(data: AppData, user: User): Mission[] {
  if (user.role === 'leader') return missionsOfCrew(data, user.crewId);
  if (user.role === 'member') return missionsAssignedTo(data, user.id);
  return [];
}

/** 미션별 대상자 상태 개수 (단위: 명) */
export function missionCounts(data: AppData, missionId: string): StatusCounts {
  return aggregateStatuses(data, { missionIds: [missionId] });
}

/** 크루원의 그 미션 최신 상태 */
export function memberStatus(data: AppData, mission: Mission, user: User): SubmissionStatus {
  return statusOf(data, mission.id, user.id);
}

/** 홈 정렬 (제작 가정): 마감 오름차순, 같으면 ID 순서. 지난 마감도 숨기지 않는다 */
function byDueThenId(a: Mission, b: Mission) {
  return a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id);
}

/** 크루원 홈: 보완 요청·미제출인 배정 미션 */
export function memberTodo(data: AppData, user: User): { mission: Mission; status: SubmissionStatus }[] {
  return missionsAssignedTo(data, user.id)
    .map((mission) => ({ mission, status: statusOf(data, mission.id, user.id) }))
    .filter((x) => x.status === 'revision_requested' || x.status === 'not_submitted')
    .sort((a, b) => byDueThenId(a.mission, b.mission));
}

/** 크루장 홈: 검토 대기가 있는 자기 크루 미션 */
export function leaderReviewTodo(data: AppData, user: User): { mission: Mission; counts: StatusCounts }[] {
  return missionsOfCrew(data, user.crewId)
    .map((mission) => ({ mission, counts: missionCounts(data, mission.id) }))
    .filter((x) => x.counts.counts.pending_review > 0)
    .sort((a, b) => byDueThenId(a.mission, b.mission));
}

/**
 * 미션 목록 조회 필터.
 * 크루원: 할 일 = 미제출·보완 요청, 완료 = 내 결과물 완료.
 * 크루장: 검토할 미션 = 검토 대기 1명 이상, 완료 = 대상자 전원 완료.
 */
export function filterMissions(data: AppData, user: User, filter: ListFilter): Mission[] {
  const missions = visibleMissions(data, user);
  if (filter === 'all') return missions;
  return missions.filter((m) => {
    if (user.role === 'member') {
      const s = statusOf(data, m.id, user.id);
      return filter === 'todo' ? s === 'not_submitted' || s === 'revision_requested' : s === 'completed';
    }
    const c = missionCounts(data, m.id);
    return filter === 'todo' ? c.counts.pending_review > 0 : c.total > 0 && c.counts.completed === c.total;
  });
}
