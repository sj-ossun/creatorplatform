import { SUBMISSION_STATUSES, type SubmissionStatus } from './status';
import { parseKstLocal } from './time';
import type { AppData, ID, Mission } from './types';
import { statusOf } from './queries';

export interface StatusCounts {
  /** 분모: 선택된 미션들의 대상자-미션 조합 수 */
  total: number;
  counts: Record<SubmissionStatus, number>;
  /** 개별 미션 하나면 '명', 여러 미션이면 '건' */
  unit: '명' | '건';
}

export interface AggregateFilter {
  /** 없으면 데이터 전체 크루 */
  crewIds?: ID[];
  /** 없으면 전체 미션 */
  missionIds?: ID[];
  /** 미션 마감일 기준 기간 (YYYY-MM-DD, 한국 시간). 시작일 00:00 이상, 종료일 다음 날 00:00 미만 */
  from?: string;
  to?: string;
}

function emptyCounts(): Record<SubmissionStatus, number> {
  return Object.fromEntries(SUBMISSION_STATUSES.map((s) => [s, 0])) as Record<SubmissionStatus, number>;
}

export function selectMissions(data: AppData, filter: AggregateFilter = {}): Mission[] {
  const fromIso = filter.from ? parseKstLocal(`${filter.from}T00:00`) : null;
  let toIso: string | null = null;
  if (filter.to) {
    const start = parseKstLocal(`${filter.to}T00:00`);
    toIso = start ? new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000).toISOString() : null;
  }
  return data.missions.filter((m) => {
    if (filter.crewIds && !filter.crewIds.includes(m.crewId)) return false;
    if (filter.missionIds && !filter.missionIds.includes(m.id)) return false;
    const due = new Date(m.dueAt).getTime();
    if (fromIso && due < new Date(fromIso).getTime()) return false;
    if (toIso && due >= new Date(toIso).getTime()) return false;
    return true;
  });
}

/**
 * 공통 상태 집계 (F-08 계산 부분).
 * 각 대상자-미션 조합의 최신 상태만 센다. 재제출 버전 수는 더하지 않는다.
 */
export function aggregateStatuses(data: AppData, filter: AggregateFilter = {}): StatusCounts {
  const missions = selectMissions(data, filter);
  const counts = emptyCounts();
  let total = 0;
  for (const m of missions) {
    for (const memberId of m.targetIds) {
      counts[statusOf(data, m.id, memberId)] += 1;
      total += 1;
    }
  }
  const single = filter.missionIds?.length === 1;
  return { total, counts, unit: single ? '명' : '건' };
}
