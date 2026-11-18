/**
 * 게시·성과·회고 기록 (F-07). 계산만 하고 저장 부작용은 없다.
 * 완료 상태와 독립적으로 저장한다: 게시·성과를 입력해도 제출 상태는 바뀌지 않는다.
 */
import { FORM_ERROR, isHttpUrl, type CommandResult, type FieldErrors } from './commands';
import { getDeliverable, getUser } from './queries';
import { formatDay, isValidDay } from './time';
import type { AppData, ID, Instant, Observation, Post } from './types';

export const PLATFORMS = ['유튜브', '인스타그램', '틱톡', '네이버 클립', '기타'] as const;

export const PERF_ERR = {
  platform: '플랫폼을 고르세요.',
  url: '게시 URL을 입력해 주세요.',
  urlFormat: 'http:// 또는 https:// 로 시작하는 주소를 넣어 주세요.',
  reviewLink: '검토용 공유 링크와 같은 주소예요. 실제 게시물 주소를 넣어 주세요.',
  publishedOn: '게시일을 입력해 주세요.',
  publishedOnInvalid: '게시일을 다시 확인해 주세요.',
  views: '0 이상의 정수로 입력하거나 비워 두세요.',
  checkedOnRequired: '조회수나 회고를 남기려면 확인일이 필요해요.',
  checkedOnInvalid: '확인일을 다시 확인해 주세요.',
  nothingToSave: '조회수나 회고 중 하나를 입력해 주세요.',
  notAllowed: '이 작업을 할 수 있는 예시 사용자가 아니에요.',
  notCompleted: '검토가 끝난 결과물에만 게시 기록을 남길 수 있어요.',
  noPost: '게시 기록을 먼저 저장해 주세요.',
} as const;

export const checkedBeforePublished = (publishedOn: string) =>
  `확인일은 게시일(${formatDay(publishedOn)})보다 빠를 수 없어요.`;

export interface PostInput {
  platform: string;
  url: string;
  publishedOn: string;
}

export interface ObservationInput {
  checkedOn: string;
  /** 입력값 그대로. 빈 값은 미집계(null) */
  views: string;
  retrospective: string;
}

export function postOf(data: AppData, deliverableId: ID): Post | undefined {
  return data.posts.find((p) => p.deliverableId === deliverableId);
}

/** 최신 확인일이 먼저 */
export function observationsOf(data: AppData, postId: ID): Observation[] {
  return data.observations.filter((o) => o.postId === postId).sort((a, b) => b.checkedOn.localeCompare(a.checkedOn));
}

/** 빈 조회수는 null. 0 이상의 정수만 허용 (천 단위 쉼표는 허용) */
export function parseViews(raw: string): { ok: true; value: number | null } | { ok: false } {
  const v = raw.trim().replace(/,/g, '');
  if (v === '') return { ok: true, value: null };
  if (!/^\d+$/.test(v)) return { ok: false };
  const n = Number(v);
  return Number.isSafeInteger(n) ? { ok: true, value: n } : { ok: false };
}

function hasObservationValues(input: ObservationInput) {
  return input.views.trim() !== '' || input.retrospective.trim() !== '';
}

export function validatePost(data: AppData, deliverableId: ID, input: PostInput, existing?: Post): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.platform.trim()) errors.platform = PERF_ERR.platform;
  const url = input.url.trim();
  if (!url) errors.url = PERF_ERR.url;
  else if (!isHttpUrl(url)) errors.url = PERF_ERR.urlFormat;
  else if (data.versions.some((v) => v.deliverableId === deliverableId && v.content.trim() === url)) {
    errors.url = PERF_ERR.reviewLink;
  }
  if (!input.publishedOn) errors.publishedOn = PERF_ERR.publishedOn;
  else if (!isValidDay(input.publishedOn)) errors.publishedOn = PERF_ERR.publishedOnInvalid;
  else if (existing) {
    const earliest = observationsOf(data, existing.id).at(-1);
    if (earliest && earliest.checkedOn < input.publishedOn) {
      errors.publishedOn = `이미 남긴 확인일(${formatDay(earliest.checkedOn)})보다 늦은 게시일은 고를 수 없어요.`;
    }
  }
  return errors;
}

/** @param requireValue 성과 기록만 따로 저장할 때는 값이 하나는 있어야 한다 */
export function validateObservation(input: ObservationInput, publishedOn: string, requireValue: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (!parseViews(input.views).ok) errors.views = PERF_ERR.views;
  const hasValues = hasObservationValues(input);
  if (!hasValues) {
    if (requireValue) errors.views = PERF_ERR.nothingToSave;
    return errors;
  }
  if (!input.checkedOn) errors.checkedOn = PERF_ERR.checkedOnRequired;
  else if (!isValidDay(input.checkedOn)) errors.checkedOn = PERF_ERR.checkedOnInvalid;
  else if (isValidDay(publishedOn) && input.checkedOn < publishedOn) errors.checkedOn = checkedBeforePublished(publishedOn);
  return errors;
}

function checkOwner(data: AppData, actorId: ID, deliverableId: ID): string | null {
  const actor = getUser(data, actorId);
  const deliverable = getDeliverable(data, deliverableId);
  if (!actor || !deliverable || actor.role !== 'member' || deliverable.memberId !== actor.id) return PERF_ERR.notAllowed;
  if (deliverable.status !== 'completed') return PERF_ERR.notCompleted;
  return null;
}

/** 같은 확인일은 고치고, 다른 확인일은 새로 추가한다 */
function upsertObservation(
  data: AppData,
  postId: ID,
  input: ObservationInput,
  now: Instant,
): { data: AppData; observation: Observation; mode: 'added' | 'updated' } {
  const views = (parseViews(input.views) as { ok: true; value: number | null }).value;
  const existing = data.observations.find((o) => o.postId === postId && o.checkedOn === input.checkedOn);
  if (existing) {
    const updated: Observation = { ...existing, views, retrospective: input.retrospective.trim(), updatedAt: now };
    return {
      data: { ...data, observations: data.observations.map((o) => (o.id === existing.id ? updated : o)) },
      observation: updated,
      mode: 'updated',
    };
  }
  const seq = data.seq + 1;
  const observation: Observation = {
    id: `observation-${seq}`,
    postId,
    checkedOn: input.checkedOn,
    views,
    retrospective: input.retrospective.trim(),
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  };
  return { data: { ...data, seq, observations: [...data.observations, observation] }, observation, mode: 'added' };
}

export interface SavePostValue {
  post: Post;
  observation?: Observation;
}

/**
 * 게시 기록 저장. 성과 값(조회수·회고)이 하나라도 있으면 관찰 기록도 함께 저장한다.
 * 둘 다 비어 있으면 관찰 기록을 만들지 않는다 (T-12).
 */
export function savePost(
  data: AppData,
  actorId: ID,
  deliverableId: ID,
  post: PostInput,
  observation: ObservationInput,
  now: Instant,
): CommandResult<SavePostValue> {
  const denied = checkOwner(data, actorId, deliverableId);
  if (denied) return { ok: false, errors: { [FORM_ERROR]: denied } };
  const existing = postOf(data, deliverableId);
  const errors = {
    ...validatePost(data, deliverableId, post, existing),
    ...validateObservation(observation, post.publishedOn, false),
  };
  if (Object.keys(errors).length) return { ok: false, errors };

  let next = data;
  let saved: Post;
  if (existing) {
    saved = { ...existing, platform: post.platform.trim(), url: post.url.trim(), publishedOn: post.publishedOn, updatedAt: now };
    next = { ...next, posts: next.posts.map((p) => (p.id === existing.id ? saved : p)) };
  } else {
    const seq = next.seq + 1;
    saved = {
      id: `post-${seq}`,
      deliverableId,
      platform: post.platform.trim(),
      url: post.url.trim(),
      publishedOn: post.publishedOn,
      createdAt: now,
      updatedAt: now,
    };
    next = { ...next, seq, posts: [...next.posts, saved] };
  }
  if (!hasObservationValues(observation)) return { ok: true, data: next, value: { post: saved } };
  const up = upsertObservation(next, saved.id, observation, now);
  return { ok: true, data: up.data, value: { post: saved, observation: up.observation } };
}

/** 성과 기록만 저장 (이미 게시 기록이 있을 때) */
export function saveObservation(
  data: AppData,
  actorId: ID,
  deliverableId: ID,
  input: ObservationInput,
  now: Instant,
): CommandResult<{ observation: Observation; mode: 'added' | 'updated' }> {
  const denied = checkOwner(data, actorId, deliverableId);
  if (denied) return { ok: false, errors: { [FORM_ERROR]: denied } };
  const post = postOf(data, deliverableId);
  if (!post) return { ok: false, errors: { [FORM_ERROR]: PERF_ERR.noPost } };
  const errors = validateObservation(input, post.publishedOn, true);
  if (Object.keys(errors).length) return { ok: false, errors };
  const up = upsertObservation(data, post.id, input, now);
  return { ok: true, data: up.data, value: { observation: up.observation, mode: up.mode } };
}

/** 성과 값 표시 종류 (디자인 5.3): 숫자, 미집계, 미게시 */
export type MetricKind =
  | { kind: 'unposted' }
  | { kind: 'uncounted'; post: Post; latest?: Observation }
  | { kind: 'views'; post: Post; latest: Observation };

export function metricOf(data: AppData, deliverableId: ID): MetricKind {
  const post = postOf(data, deliverableId);
  if (!post) return { kind: 'unposted' };
  const latest = observationsOf(data, post.id)[0];
  if (!latest || latest.views === null) return { kind: 'uncounted', post, latest };
  return { kind: 'views', post, latest };
}
