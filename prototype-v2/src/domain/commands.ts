/**
 * 업무 명령. 계산만 하고 저장 부작용은 없다 (명세 11.2).
 * 입력·현재 상태를 검증하고 다음 데이터 전체를 돌려준다.
 * 저장과 화면 확정은 state/commit.ts 가 맡는다.
 */
import { canManageMission, canWorkOnMission } from './access';
import { crewMembers, deliverableOf, getDeliverable, getMission, getUser } from './queries';
import type { ReviewResult } from './status';
import { isAfter, parseKstLocal } from './time';
import type {
  AppData,
  Deliverable,
  Feedback,
  ID,
  Instant,
  Mission,
  NotificationExample,
  SubmissionFormat,
  SubmissionVersion,
  User,
} from './types';

export type FieldErrors = Record<string, string>;

/** 폼 전체에 해당하는 오류 키 */
export const FORM_ERROR = '_form';

export type CommandResult<T = undefined> =
  | { ok: true; data: AppData; value: T }
  | { ok: false; errors: FieldErrors };

function fail(errors: FieldErrors): { ok: false; errors: FieldErrors } {
  return { ok: false, errors };
}

function nextId(data: AppData, prefix: string): [string, number] {
  const seq = data.seq + 1;
  return [`${prefix}-${seq}`, seq];
}

export const ERR = {
  urlFormat: 'http:// 또는 https:// 로 시작하는 주소를 넣어 주세요.',
  revisionComment: '어떻게 고치면 되는지 적어 주세요.',
  changeNote: '이전 제출에서 무엇을 바꿨는지 적어 주세요.',
  noTargets: '대상자를 한 명 이상 고르세요.',
  dueAt: '마감 일시를 다시 확인해 주세요.',
  pickResult: '처리 결과를 고르세요.',
  alreadyReviewed: '이미 처리한 제출물이에요. 목록에서 다시 골라 주세요.',
  notAllowed: '이 작업을 할 수 있는 예시 사용자가 아니에요.',
} as const;


/** 조사까지 맞춘 필수 문구 */
export const REQUIRED = {
  title: '제목을 입력해 주세요.',
  criteria: '목표·제출 기준을 입력해 주세요.',
  textContent: '제출 내용을 입력해 주세요.',
  linkContent: '영상 링크를 입력해 주세요.',
  format: '제출 형식을 고르세요.',
} as const;

export function isHttpUrl(value: string): boolean {
  const v = value.trim();
  if (!/^https?:\/\//i.test(v)) return false;
  try {
    const u = new URL(v);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.length > 0;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ F-02 */

export interface CreateMissionInput {
  title: string;
  criteria: string;
  format: SubmissionFormat | '';
  /** datetime-local 값. 한국 시간으로 해석한다. */
  dueLocal: string;
  targetIds: ID[];
}

export function validateMission(data: AppData, actor: User, input: CreateMissionInput, now: Instant): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.title.trim()) errors.title = REQUIRED.title;
  if (!input.criteria.trim()) errors.criteria = REQUIRED.criteria;
  if (input.format !== 'text' && input.format !== 'link') errors.format = REQUIRED.format;
  const due = parseKstLocal(input.dueLocal);
  if (!due || !isAfter(due, now)) errors.dueAt = ERR.dueAt;
  const allowed = new Set(crewMembers(data, actor.crewId).map((u) => u.id));
  const targets = input.targetIds.filter((id) => allowed.has(id));
  if (targets.length === 0) errors.targetIds = ERR.noTargets;
  return errors;
}

export function createMission(
  data: AppData,
  actorId: ID,
  input: CreateMissionInput,
  now: Instant,
): CommandResult<Mission> {
  const actor = getUser(data, actorId);
  if (!actor || actor.role !== 'leader' || !actor.crewId) return fail({ [FORM_ERROR]: ERR.notAllowed });
  const errors = validateMission(data, actor, input, now);
  if (Object.keys(errors).length) return fail(errors);

  const allowed = new Set(crewMembers(data, actor.crewId).map((u) => u.id));
  const [id, seq] = nextId(data, 'mission');
  const mission: Mission = {
    id,
    crewId: actor.crewId,
    title: input.title.trim(),
    criteria: input.criteria.trim(),
    format: input.format as SubmissionFormat,
    dueAt: parseKstLocal(input.dueLocal)!,
    demoDue: false,
    createdBy: actor.id,
    createdAt: now,
    // 생성 시점 명단으로 고정 (A-04)
    targetIds: [...new Set(input.targetIds)].filter((tid) => allowed.has(tid)),
  };
  return { ok: true, data: { ...data, seq, missions: [...data.missions, mission] }, value: mission };
}

/* ------------------------------------------------------------- F-03, F-06 */

export interface SubmitInput {
  missionId: ID;
  content: string;
  description: string;
  /** 재제출에서만 필수 */
  changeNote?: string;
}

export function validateSubmission(mission: Mission, input: SubmitInput, isResubmit: boolean): FieldErrors {
  const errors: FieldErrors = {};
  const content = input.content.trim();
  if (mission.format === 'text') {
    if (!content) errors.content = REQUIRED.textContent;
  } else if (!content) {
    errors.content = REQUIRED.linkContent;
  } else if (!isHttpUrl(content)) {
    errors.content = ERR.urlFormat;
  }
  if (isResubmit && !(input.changeNote ?? '').trim()) errors.changeNote = ERR.changeNote;
  return errors;
}

export interface SubmitValue {
  deliverable: Deliverable;
  version: SubmissionVersion;
}

/**
 * 최초 제출(미제출 → 검토 대기)과 수정본 제출(보완 요청 → 검토 대기).
 * 검토 대기 중 임의 수정·완료 후 재제출은 막는다.
 */
export function submit(data: AppData, actorId: ID, input: SubmitInput, now: Instant): CommandResult<SubmitValue> {
  const actor = getUser(data, actorId);
  const mission = getMission(data, input.missionId);
  if (!actor || !mission || !canWorkOnMission(actor, mission)) return fail({ [FORM_ERROR]: ERR.notAllowed });

  const existing = deliverableOf(data, mission.id, actor.id);
  if (existing && existing.status !== 'revision_requested') {
    return fail({
      [FORM_ERROR]:
        existing.status === 'pending_review'
          ? '이미 제출했어요. 크루장의 검토를 기다리고 있어요.'
          : '검토가 끝난 결과물은 다시 제출할 수 없어요.',
    });
  }
  const isResubmit = !!existing;
  const errors = validateSubmission(mission, input, isResubmit);
  if (Object.keys(errors).length) return fail(errors);

  let seq = data.seq;
  const deliverableId = existing?.id ?? `deliverable-${++seq}`;
  const versionId = `version-${++seq}`;
  const prevNumber = existing
    ? Math.max(...data.versions.filter((v) => v.deliverableId === existing.id).map((v) => v.number))
    : 0;

  const version: SubmissionVersion = {
    id: versionId,
    deliverableId,
    number: prevNumber + 1,
    content: input.content.trim(),
    description: input.description.trim(),
    changeNote: isResubmit ? (input.changeNote ?? '').trim() : '',
    submittedAt: now,
    late: isAfter(now, mission.dueAt),
  };
  const deliverable: Deliverable = {
    id: deliverableId,
    missionId: mission.id,
    memberId: actor.id,
    status: 'pending_review',
    latestVersionId: versionId,
  };
  const deliverables = existing
    ? data.deliverables.map((d) => (d.id === existing.id ? deliverable : d))
    : [...data.deliverables, deliverable];

  return {
    ok: true,
    data: { ...data, seq, deliverables, versions: [...data.versions, version] },
    value: { deliverable, version },
  };
}

/* ----------------------------------------------------------- F-05, F-11A */

export interface ReviewInput {
  deliverableId: ID;
  /** 화면에서 검토한 버전. 최신 검토 대기 버전과 같아야 한다. */
  versionId: ID;
  result: ReviewResult | '';
  comment: string;
}

export function validateReview(input: ReviewInput): FieldErrors {
  const errors: FieldErrors = {};
  if (input.result !== 'completed' && input.result !== 'revision_requested') errors.result = ERR.pickResult;
  if (input.result === 'revision_requested' && !input.comment.trim()) errors.comment = ERR.revisionComment;
  return errors;
}

export interface ReviewValue {
  feedback: Feedback;
  notification: NotificationExample;
}

/** 피드백·처리 결과와 알림 예시를 함께 만든다. 최신 검토 대기 버전만 처리한다. */
export function review(data: AppData, actorId: ID, input: ReviewInput, now: Instant): CommandResult<ReviewValue> {
  const actor = getUser(data, actorId);
  const deliverable = getDeliverable(data, input.deliverableId);
  const mission = deliverable && getMission(data, deliverable.missionId);
  if (!actor || !deliverable || !mission || !canManageMission(actor, mission)) {
    return fail({ [FORM_ERROR]: ERR.notAllowed });
  }
  if (deliverable.status !== 'pending_review' || deliverable.latestVersionId !== input.versionId) {
    return fail({ [FORM_ERROR]: ERR.alreadyReviewed });
  }
  const errors = validateReview(input);
  if (Object.keys(errors).length) return fail(errors);

  let seq = data.seq;
  const feedback: Feedback = {
    id: `feedback-${++seq}`,
    deliverableId: deliverable.id,
    versionId: input.versionId,
    result: input.result as ReviewResult,
    comment: input.comment.trim(),
    authorId: actor.id,
    createdAt: now,
  };
  if (data.notifications.some((n) => n.eventId === feedback.id)) {
    return fail({ [FORM_ERROR]: ERR.alreadyReviewed });
  }
  const notification: NotificationExample = {
    id: `notification-${++seq}`,
    eventId: feedback.id,
    kind: 'feedback',
    recipientId: deliverable.memberId,
    missionId: mission.id,
    deliverableId: deliverable.id,
    feedbackId: feedback.id,
    createdAt: now,
  };
  const updated: Deliverable = { ...deliverable, status: feedback.result };
  return {
    ok: true,
    data: {
      ...data,
      seq,
      deliverables: data.deliverables.map((d) => (d.id === deliverable.id ? updated : d)),
      feedbacks: [...data.feedbacks, feedback],
      notifications: [...data.notifications, notification],
    },
    value: { feedback, notification },
  };
}
