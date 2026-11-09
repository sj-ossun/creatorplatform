import type { SubmissionStatus } from './status';
import type {
  AppData,
  Crew,
  Deliverable,
  Feedback,
  ID,
  Mission,
  NotificationExample,
  SubmissionVersion,
  User,
} from './types';

export function getUser(data: AppData, id: ID): User | undefined {
  return data.users.find((u) => u.id === id);
}

export function getCrew(data: AppData, id: ID | null): Crew | undefined {
  return id ? data.crews.find((c) => c.id === id) : undefined;
}

export function getMission(data: AppData, id: ID): Mission | undefined {
  return data.missions.find((m) => m.id === id);
}

export function getDeliverable(data: AppData, id: ID): Deliverable | undefined {
  return data.deliverables.find((d) => d.id === id);
}

export function deliverableOf(data: AppData, missionId: ID, memberId: ID): Deliverable | undefined {
  return data.deliverables.find((d) => d.missionId === missionId && d.memberId === memberId);
}

/** 대상자-미션 조합의 최신 상태. 결과물이 없으면 미제출. */
export function statusOf(data: AppData, missionId: ID, memberId: ID): SubmissionStatus {
  return deliverableOf(data, missionId, memberId)?.status ?? 'not_submitted';
}

/** 최신 버전이 먼저 오도록 정렬 */
export function versionsOf(data: AppData, deliverableId: ID): SubmissionVersion[] {
  return data.versions
    .filter((v) => v.deliverableId === deliverableId)
    .sort((a, b) => b.number - a.number);
}

export function latestVersion(data: AppData, deliverable: Deliverable): SubmissionVersion | undefined {
  return data.versions.find((v) => v.id === deliverable.latestVersionId);
}

export function feedbacksForVersion(data: AppData, versionId: ID): Feedback[] {
  return data.feedbacks
    .filter((f) => f.versionId === versionId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getFeedback(data: AppData, id: ID): Feedback | undefined {
  return data.feedbacks.find((f) => f.id === id);
}

/** 크루장이 관리하는 미션: 자기 크루 미션, 최근 등록순 */
export function missionsOfCrew(data: AppData, crewId: ID | null): Mission[] {
  return data.missions
    .filter((m) => m.crewId === crewId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 크루원에게 배정된 미션: 최근 등록순 */
export function missionsAssignedTo(data: AppData, memberId: ID): Mission[] {
  return data.missions
    .filter((m) => m.targetIds.includes(memberId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 크루 구성원 중 크루원(크루장 제외) */
export function crewMembers(data: AppData, crewId: ID | null): User[] {
  const crew = getCrew(data, crewId);
  if (!crew) return [];
  return crew.memberIds
    .map((id) => getUser(data, id))
    .filter((u): u is User => !!u && u.role === 'member');
}

export interface ReviewEntry {
  member: User;
  status: SubmissionStatus;
  deliverable?: Deliverable;
  latest?: SubmissionVersion;
}

const nameCollator = new Intl.Collator('ko-KR');

/**
 * 미션 대상자별 최신 상태. 검토 대기는 제출 시각이 빠른 순서,
 * 그 밖의 상태는 이름순.
 */
export function reviewEntries(data: AppData, mission: Mission): ReviewEntry[] {
  return mission.targetIds
    .map((id) => getUser(data, id))
    .filter((u): u is User => !!u)
    .map((member) => {
      const deliverable = deliverableOf(data, mission.id, member.id);
      return {
        member,
        status: deliverable?.status ?? ('not_submitted' as const),
        deliverable,
        latest: deliverable ? latestVersion(data, deliverable) : undefined,
      };
    })
    .sort((a, b) => {
      if (a.status === 'pending_review' && b.status === 'pending_review') {
        return (a.latest?.submittedAt ?? '').localeCompare(b.latest?.submittedAt ?? '');
      }
      return nameCollator.compare(a.member.name, b.member.name);
    });
}

/** 지금 처리 중인 사람을 빼고 가장 먼저 제출한 검토 대기 */
export function nextPending(data: AppData, mission: Mission, excludeMemberId?: ID): ReviewEntry | undefined {
  return reviewEntries(data, mission).find(
    (e) => e.status === 'pending_review' && e.member.id !== excludeMemberId,
  );
}

export function notificationOfFeedback(data: AppData, feedbackId: ID): NotificationExample | undefined {
  return data.notifications.find((n) => n.feedbackId === feedbackId);
}
