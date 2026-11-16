/**
 * E4 크루장 미션 고치기 (사용자 결정, 견본 2026-11-16).
 * - 그 크루 크루장만. 제목·목표·기준·마감 일시를 고치고 대상자는 더할 수만 있다 (이미 배정된 사람은 빼지 않는다).
 * - 마감은 지금보다 뒤로만 (앞당기기는 되지만 이미 지난 일시로는 안 된다). 제출 형식은 바꾸지 않는다.
 * - 고칠 때마다 이력을 남기고, 기존 대상자 알림함에 '미션 내용이 바뀌었어요', 더한 사람에게는 '새 미션 배정'이 간다.
 */
import { FORM_ERROR, REQUIRED, ERR, type CommandResult, type FieldErrors } from './commands';
import { crewMembers, getMission, getUser } from './queries';
import { formatDetail, isAfter, parseKstLocal, toKstLocal } from './time';
import type { AppData, ID, Instant, Mission, MissionChange, MissionRevision } from './types';

export interface EditMissionInput {
  title: string;
  criteria: string;
  /** datetime-local 값 (한국 시간) */
  dueLocal: string;
  /** 새로 더할 대상자 */
  addTargetIds: ID[];
}

export const MISSION_EDIT_ERR = {
  unchanged: '바뀐 내용이 없어요.',
  notAllowed: '이 크루의 크루장만 미션을 고칠 수 있어요.',
} as const;

export const FIELD_LABEL: Record<MissionChange['field'], string> = { title: '제목', criteria: '목표·기준', dueAt: '마감' };

export function editMission(data: AppData, actorId: ID, missionId: ID, input: EditMissionInput, now: Instant): CommandResult<Mission> {
  const actor = getUser(data, actorId);
  const mission = getMission(data, missionId);
  if (!actor || !mission || actor.role !== 'leader' || actor.crewId !== mission.crewId) return { ok: false, errors: { [FORM_ERROR]: MISSION_EDIT_ERR.notAllowed } };
  const errors: FieldErrors = {};
  const title = input.title.trim();
  const criteria = input.criteria.trim();
  if (!title) errors.title = REQUIRED.title;
  if (!criteria) errors.criteria = REQUIRED.criteria;
  // 마감 칸을 건드리지 않았으면(분 단위로 같으면) 원래 값 그대로
  const sameDue = input.dueLocal === toKstLocal(mission.dueAt);
  const due = sameDue ? mission.dueAt : parseKstLocal(input.dueLocal);
  if (!due) errors.dueAt = ERR.dueAt;
  else if (!sameDue && !isAfter(due, now)) errors.dueAt = '마감은 지금보다 뒤의 일시로 골라 주세요.';
  if (Object.keys(errors).length) return { ok: false, errors };
  const crew = new Set(crewMembers(data, mission.crewId).map((u) => u.id));
  const added = [...new Set(input.addTargetIds)].filter((id) => crew.has(id) && !mission.targetIds.includes(id));
  const changes: MissionChange[] = [];
  if (title !== mission.title) changes.push({ field: 'title', before: mission.title, after: title });
  if (criteria !== mission.criteria) changes.push({ field: 'criteria', before: mission.criteria, after: criteria });
  if (due && due !== mission.dueAt) changes.push({ field: 'dueAt', before: mission.dueAt, after: due });
  if (changes.length === 0 && added.length === 0) return { ok: false, errors: { [FORM_ERROR]: MISSION_EDIT_ERR.unchanged } };
  const revision: MissionRevision = { at: now, by: actorId, changes, added };
  const next: Mission = {
    ...mission,
    title,
    criteria,
    dueAt: due!,
    // 마감을 바꾸면 더 이상 예시용 기한이 아니다
    demoDue: due !== mission.dueAt ? false : mission.demoDue,
    targetIds: [...mission.targetIds, ...added],
    revisions: [...(mission.revisions ?? []), revision],
  };
  return { ok: true, data: { ...data, missions: data.missions.map((m) => (m.id === missionId ? next : m)) }, value: next };
}

/** 바뀐 항목 한 줄 요약: `마감 11월 18일(수) 18:00 → 11월 20일(금) 18:00 · 목표·기준` */
export function revisionSummary(rev: MissionRevision, now?: Instant): string {
  // 마감이 가장 중요해서 먼저
  return [...rev.changes]
    .sort((a, b) => (a.field === 'dueAt' ? -1 : b.field === 'dueAt' ? 1 : 0))
    .map((c) => (c.field === 'dueAt' ? `마감 ${formatDetail(c.before, now)} → ${formatDetail(c.after, now)}` : FIELD_LABEL[c.field]))
    .join(' · ');
}

/** 대상자가 이 미션에 처음 배정된 시각 (등록 때 대상이면 등록 시각, 나중에 더해졌으면 그 고친 시각) */
export function assignedAt(mission: Mission, userId: ID): Instant {
  return mission.revisions?.find((r) => r.added.includes(userId))?.at ?? mission.createdAt;
}
