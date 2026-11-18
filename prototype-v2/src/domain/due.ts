/**
 * 검토 1번 (사용자 확정 견본): 아직 내야 하는 미션의 마감 상태.
 * - late(마감 지남): 마감이 지났는데 아직 내지 않았다 (이미 늦음)
 * - soon(마감 임박): 마감까지 24시간 안, 아직 기간 안 (제출 재촉 알림 대상)
 * 내야 하는 상태(미제출·보완 요청)에서만 붙는다. 관리자 '마감 지난 미제출'과 같은 기준이다.
 */
import { DUE_SOON_MS } from './nudge';
import type { SubmissionStatus } from './status';
import type { Instant, Mission } from './types';

export type DueState = 'late' | 'soon' | null;

export function dueState(mission: Mission, status: SubmissionStatus, now: Instant): DueState {
  if (status !== 'not_submitted' && status !== 'revision_requested') return null;
  const left = new Date(mission.dueAt).getTime() - new Date(now).getTime();
  if (left <= 0) return 'late';
  if (left <= DUE_SOON_MS) return 'soon';
  return null;
}

export const DUE_STATE_LABEL: Record<Exclude<DueState, null>, string> = { late: '마감 지남', soon: '마감 임박' };
