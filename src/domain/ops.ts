/**
 * 운영 관리 › 크루 현황 '확인할 것' (6-B 후속, 사용자 확정 견본).
 * 같은 필터(크루·기간·미션) 범위의 업무 기록에서 계산한다. 단위는 '미션 배정 건'(크루원 1명 × 미션 1개 = 1건).
 */
import { selectMissions, type AggregateFilter } from './aggregate';
import { isStale } from './offers';
import { deliverableOf, statusOf } from './queries';
import type { AppData, ID, Instant, User } from './types';

export const REVIEW_DELAY_MS = 2 * 24 * 60 * 60 * 1000;

export interface OpsAlert {
  count: number;
  crewIds: ID[];
}

export interface OpsAlerts {
  /** 2일 넘게 검토를 기다리는 제출 */
  delayed: OpsAlert;
  /** 마감이 지났는데 첫 제출이 없음 */
  overdue: OpsAlert;
  /** 보완 요청을 받고 아직 다시 내지 않음 */
  revision: OpsAlert;
  /** 2일 넘게 응답이 없는 광고 제안 (받는 사람 수) */
  staleOffers: number;
  /** 크루별 2일 넘게 기다린 검토 대기 수 (표 강조용) */
  delayedByCrew: Record<ID, number>;
}

export function opsAlerts(data: AppData, admin: User, filter: AggregateFilter, now: Instant = new Date().toISOString()): OpsAlerts {
  const delayed = new Map<ID, number>();
  const overdue = new Map<ID, number>();
  const revision = new Map<ID, number>();
  const add = (m: Map<ID, number>, k: ID) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const mission of selectMissions(data, filter)) {
    for (const memberId of mission.targetIds) {
      const s = statusOf(data, mission.id, memberId);
      if (s === 'pending_review') {
        const d = deliverableOf(data, mission.id, memberId);
        const v = d && data.versions.find((x) => x.id === d.latestVersionId);
        if (v && new Date(now).getTime() - new Date(v.submittedAt).getTime() > REVIEW_DELAY_MS) add(delayed, mission.crewId);
      } else if (s === 'not_submitted' && now > mission.dueAt) add(overdue, mission.crewId);
      else if (s === 'revision_requested') add(revision, mission.crewId);
    }
  }
  const toAlert = (m: Map<ID, number>): OpsAlert => ({ count: [...m.values()].reduce((a, b) => a + b, 0), crewIds: [...m.keys()] });
  const visibleOffers = data.offers.filter((o) =>
    data.offerRecipients
      .filter((r) => r.offerId === o.id)
      .every((r) => {
        const u = data.users.find((x) => x.id === r.userId);
        return !!u?.crewId && admin.managedCrewIds.includes(u.crewId);
      }),
  );
  const staleOffers = data.offerRecipients.filter((r) => {
    const o = visibleOffers.find((x) => x.id === r.offerId);
    return !!o && isStale(r, o, now);
  }).length;
  return { delayed: toAlert(delayed), overdue: toAlert(overdue), revision: toAlert(revision), staleOffers, delayedByCrew: Object.fromEntries(delayed) };
}

/** 범위 설명용: 크루 수·크루원 수(서로 다른 대상자)·미션 수 */
export function scopeSize(data: AppData, filter: AggregateFilter): { crews: number; members: number; missions: number } {
  const missions = selectMissions(data, filter);
  const members = new Set<ID>();
  for (const m of missions) for (const id of m.targetIds) if (!filter.memberId || id === filter.memberId) members.add(id);
  return { crews: new Set(missions.map((m) => m.crewId)).size, members: members.size, missions: missions.length };
}
