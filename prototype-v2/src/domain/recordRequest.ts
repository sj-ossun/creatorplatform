/**
 * 성과 기록 요청 (5단계, 사용자 결정). 크루장은 크루원 성과를 보고 기록을 요청만 한다 (대신 고치지 않는다).
 * 요청 대상: 게시 후 7일 넘게 성과 기록이 없는 게시물. 같은 결과물에는 하루(한국 시간) 한 번.
 * 요청은 크루원 알림함에 '성과 기록 요청'으로 보인다.
 */
import { FORM_ERROR, type CommandResult } from './commands';
import { observationsOf } from './performance';
import { getDeliverable, getMission, getUser } from './queries';
import { needsRecord } from './stats';
import { todayKst } from './time';
import type { AppData, ID, Instant, RecordRequest } from './types';

export const REQUEST_ERR = {
  notAllowed: '이 크루원에게 기록을 요청할 수 있는 계정이 아니에요.',
  notNeeded: '게시 후 7일이 넘었는데 성과 기록이 없는 결과물만 요청할 수 있어요.',
  today: '오늘 이미 요청했어요. 같은 결과물에는 하루 한 번 요청할 수 있어요.',
} as const;

export function requestedToday(data: AppData, deliverableId: ID, now: Instant): boolean {
  const today = todayKst(now);
  return data.recordRequests.some((r) => r.deliverableId === deliverableId && r.requestedOn === today);
}

export function requestRecord(data: AppData, actorId: ID, deliverableId: ID, now: Instant): CommandResult<RecordRequest> {
  const actor = getUser(data, actorId);
  const d = getDeliverable(data, deliverableId);
  const m = d && getMission(data, d.missionId);
  if (!actor || !d || !m || actor.role !== 'leader' || actor.crewId !== m.crewId) return { ok: false, errors: { [FORM_ERROR]: REQUEST_ERR.notAllowed } };
  const post = data.posts.find((p) => p.deliverableId === d.id);
  if (!post || !needsRecord(post, observationsOf(data, post.id), todayKst(now))) return { ok: false, errors: { [FORM_ERROR]: REQUEST_ERR.notNeeded } };
  if (requestedToday(data, d.id, now)) return { ok: false, errors: { [FORM_ERROR]: REQUEST_ERR.today } };
  const seq = data.seq + 1;
  const req: RecordRequest = { id: `record-request-${seq}`, deliverableId: d.id, memberId: d.memberId, requestedBy: actor.id, requestedOn: todayKst(now), createdAt: now };
  return { ok: true, data: { ...data, seq, recordRequests: [...data.recordRequests, req] }, value: req };
}
