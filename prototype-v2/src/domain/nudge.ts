/**
 * 마감 임박 알림 (6-A, 사용자 결정). 앱 안 알림이며 외부로 보내지 않는다.
 * - 자동: 마감 24시간 전부터 아직 제출하지 않은 대상자 알림함에 '마감 임박'이 보인다 (기록에서 계산, 저장 없음)
 * - 크루장 재촉: 마감 전 미제출자에게 '재촉 알림'을 보낸다. 같은 미션에 하루(한국 시간) 한 번
 */
import { FORM_ERROR, type CommandResult } from './commands';
import { getMission, getUser, statusOf } from './queries';
import { isAfter, todayKst } from './time';
import type { AppData, ID, Instant, Mission, Nudge } from './types';

export const DUE_SOON_MS = 24 * 60 * 60 * 1000;

export const NUDGE_ERR = {
  notAllowed: '이 미션의 대상자에게 알림을 보낼 수 있는 계정이 아니에요.',
  closed: '마감이 지난 미션은 재촉하지 않아요. 미제출 안내 미리보기를 써 주세요.',
  none: '아직 제출하지 않은 대상자가 없어요.',
  today: '오늘 이미 재촉 알림을 보냈어요. 같은 미션에는 하루 한 번 보낼 수 있어요.',
} as const;

/** 마감 전이고 아직 첫 제출이 없는 대상자 */
export function pendingTargets(data: AppData, mission: Mission): ID[] {
  return mission.targetIds.filter((id) => statusOf(data, mission.id, id) === 'not_submitted');
}

export function isDueSoon(mission: Mission, now: Instant): boolean {
  const left = new Date(mission.dueAt).getTime() - new Date(now).getTime();
  return left > 0 && left <= DUE_SOON_MS;
}

export function nudgedToday(data: AppData, missionId: ID, now: Instant): boolean {
  const today = todayKst(now);
  return data.nudges.some((n) => n.missionId === missionId && n.sentOn === today);
}

export function sendNudge(data: AppData, actorId: ID, missionId: ID, now: Instant): CommandResult<Nudge> {
  const actor = getUser(data, actorId);
  const mission = getMission(data, missionId);
  if (!actor || !mission || actor.role !== 'leader' || actor.crewId !== mission.crewId) return { ok: false, errors: { [FORM_ERROR]: NUDGE_ERR.notAllowed } };
  if (isAfter(now, mission.dueAt)) return { ok: false, errors: { [FORM_ERROR]: NUDGE_ERR.closed } };
  const memberIds = pendingTargets(data, mission);
  if (memberIds.length === 0) return { ok: false, errors: { [FORM_ERROR]: NUDGE_ERR.none } };
  if (nudgedToday(data, missionId, now)) return { ok: false, errors: { [FORM_ERROR]: NUDGE_ERR.today } };
  const seq = data.seq + 1;
  const nudge: Nudge = { id: `nudge-${seq}`, missionId, memberIds, sentBy: actor.id, sentOn: todayKst(now), createdAt: now };
  return { ok: true, data: { ...data, seq, nudges: [...data.nudges, nudge] }, value: nudge };
}
