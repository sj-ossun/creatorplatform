/**
 * 우수 사례 (v0.6 4.5단계, 6-C 두 단계 공개, 사용자 결정).
 * 대상: 검토 완료 + 게시 기록이 있는 결과물. 지정: 그 크루의 크루장 또는 담당 관리자.
 * 지정하는 사람이 성과 한 줄(공개 홈 배너)과 학습 포인트(크루 전용 우수 사례 페이지)를 쓰고,
 * 크리에이터가 두 문구를 보고 동의해야 공개된다. 동의를 철회하면 두 곳에서 바로 내려간다.
 *   공개 홈 배너 (누구나): 카테고리·크루, 성과 한 줄, 숫자가 있으면 출처·확인일
 *   우수 사례 페이지 (로그인한 크루 구성원 모두): 크리에이터, 미션, 게시 URL, 조회수·확인일, 학습 포인트
 * 시연 데이터는 가상 사례다.
 */
import { FORM_ERROR, type CommandResult } from './commands';
import { metricOf, postOf, type MetricKind } from './performance';
import { getCrew, getDeliverable, getMission, getUser } from './queries';
import type { AppData, Crew, Deliverable, ID, Instant, Mission, Post, Showcase, ShowcaseConsent, User } from './types';

export const SHOWCASE_COMMENT_MAX = 80;
export const SHOWCASE_HEADLINE_MAX = 40;

export const SHOWCASE_ERR = {
  notAllowed: '이 결과물을 사례로 지정할 수 있는 계정이 아니에요.',
  notEligible: '검토가 끝나고 게시 기록이 있는 결과물만 사례로 소개할 수 있어요.',
  duplicate: '이미 사례로 소개 중인 결과물이에요.',
  comment: '학습 포인트를 입력해 주세요.',
  commentLong: `학습 포인트는 ${SHOWCASE_COMMENT_MAX}자 이내로 써 주세요.`,
  headline: '성과 한 줄을 입력해 주세요.',
  headlineLong: `성과 한 줄은 ${SHOWCASE_HEADLINE_MAX}자 이내로 써 주세요.`,
  notCreator: '이 사례의 크리에이터만 공개 여부를 정할 수 있어요.',
  notPending: '이미 답한 요청이에요.',
  notAgreed: '공개 중인 사례만 동의를 철회할 수 있어요.',
} as const;

export function consentOf(s: Showcase): ShowcaseConsent {
  return s.consent ?? 'pending';
}

/** 지정·해제 권한: 그 크루의 크루장, 그 크루를 담당하는 관리자 */
export function canCurate(data: AppData, user: User, deliverable: Deliverable): boolean {
  const mission = getMission(data, deliverable.missionId);
  if (!mission) return false;
  if (user.role === 'leader') return user.crewId === mission.crewId;
  if (user.role === 'admin') return user.managedCrewIds.includes(mission.crewId);
  return false;
}

export function isEligible(data: AppData, deliverable: Deliverable): boolean {
  return deliverable.status === 'completed' && !!postOf(data, deliverable.id);
}

export function showcaseOf(data: AppData, deliverableId: ID): Showcase | undefined {
  return data.showcases.find((s) => s.deliverableId === deliverableId);
}

export function designateShowcase(
  data: AppData,
  actorId: ID,
  deliverableId: ID,
  comment: string,
  now: Instant,
  headline = '',
): CommandResult<Showcase> {
  const actor = getUser(data, actorId);
  const deliverable = getDeliverable(data, deliverableId);
  if (!actor || !deliverable || !canCurate(data, actor, deliverable)) return { ok: false, errors: { [FORM_ERROR]: SHOWCASE_ERR.notAllowed } };
  if (!isEligible(data, deliverable)) return { ok: false, errors: { [FORM_ERROR]: SHOWCASE_ERR.notEligible } };
  if (showcaseOf(data, deliverableId)) return { ok: false, errors: { [FORM_ERROR]: SHOWCASE_ERR.duplicate } };
  const text = comment.trim();
  const head = headline.trim();
  const errors: Record<string, string> = {};
  if (!head) errors.headline = SHOWCASE_ERR.headline;
  else if (head.length > SHOWCASE_HEADLINE_MAX) errors.headline = SHOWCASE_ERR.headlineLong;
  if (!text) errors.comment = SHOWCASE_ERR.comment;
  else if (text.length > SHOWCASE_COMMENT_MAX) errors.comment = SHOWCASE_ERR.commentLong;
  if (Object.keys(errors).length) return { ok: false, errors };
  const seq = data.seq + 1;
  // 크리에이터가 동의하기 전까지는 어디에도 공개하지 않는다
  const showcase: Showcase = { id: `showcase-${seq}`, deliverableId, comment: text, headline: head, consent: 'pending', authorId: actor.id, createdAt: now };
  return { ok: true, data: { ...data, seq, showcases: [...data.showcases, showcase] }, value: showcase };
}

export function removeShowcase(data: AppData, actorId: ID, deliverableId: ID): CommandResult<Showcase> {
  const actor = getUser(data, actorId);
  const deliverable = getDeliverable(data, deliverableId);
  const existing = showcaseOf(data, deliverableId);
  if (!actor || !deliverable || !existing || !canCurate(data, actor, deliverable)) {
    return { ok: false, errors: { [FORM_ERROR]: SHOWCASE_ERR.notAllowed } };
  }
  return { ok: true, data: { ...data, showcases: data.showcases.filter((s) => s.id !== existing.id) }, value: existing };
}

function creatorShowcase(data: AppData, actorId: ID, deliverableId: ID): { showcase: Showcase } | { error: string } {
  const deliverable = getDeliverable(data, deliverableId);
  const showcase = showcaseOf(data, deliverableId);
  if (!deliverable || !showcase || deliverable.memberId !== actorId) return { error: SHOWCASE_ERR.notCreator };
  return { showcase };
}

function replaceShowcase(data: AppData, next: Showcase): AppData {
  return { ...data, showcases: data.showcases.map((s) => (s.id === next.id ? next : s)) };
}

/** 크리에이터의 공개 동의 또는 거절 (동의 대기일 때만) */
export function answerShowcaseConsent(data: AppData, actorId: ID, deliverableId: ID, agree: boolean, now: Instant): CommandResult<Showcase> {
  const found = creatorShowcase(data, actorId, deliverableId);
  if ('error' in found) return { ok: false, errors: { [FORM_ERROR]: found.error } };
  if (consentOf(found.showcase) !== 'pending') return { ok: false, errors: { [FORM_ERROR]: SHOWCASE_ERR.notPending } };
  const next: Showcase = { ...found.showcase, consent: agree ? 'agreed' : 'declined', consentAt: now };
  return { ok: true, data: replaceShowcase(data, next), value: next };
}

/** 동의 철회: 공개 홈과 우수 사례 페이지에서 바로 내려간다. 기록은 남는다 */
export function withdrawShowcaseConsent(data: AppData, actorId: ID, deliverableId: ID, now: Instant): CommandResult<Showcase> {
  const found = creatorShowcase(data, actorId, deliverableId);
  if ('error' in found) return { ok: false, errors: { [FORM_ERROR]: found.error } };
  if (consentOf(found.showcase) !== 'agreed') return { ok: false, errors: { [FORM_ERROR]: SHOWCASE_ERR.notAgreed } };
  const next: Showcase = { ...found.showcase, consent: 'withdrawn', consentAt: now };
  return { ok: true, data: replaceShowcase(data, next), value: next };
}

export interface ShowcaseView {
  showcase: Showcase;
  creator: User;
  crew: Crew;
  mission: Mission;
  post: Post;
  metric: MetricKind;
  author: User;
}

/** 공개 사례 목록 (최근 지정순). 크리에이터가 동의한 사례만. 게시 기록이 없어진 결과물은 보여주지 않는다 */
export function showcaseViews(data: AppData): ShowcaseView[] {
  return data.showcases
    .filter((s) => consentOf(s) === 'agreed')
    .map((showcase) => {
      const deliverable = getDeliverable(data, showcase.deliverableId);
      const mission = deliverable && getMission(data, deliverable.missionId);
      const creator = deliverable && getUser(data, deliverable.memberId);
      const crew = mission && getCrew(data, mission.crewId);
      const post = deliverable && postOf(data, deliverable.id);
      const author = getUser(data, showcase.authorId);
      if (!deliverable || !mission || !creator || !crew || !post || !author || deliverable.status !== 'completed') return null;
      return { showcase, creator, crew, mission, post, metric: metricOf(data, deliverable.id), author };
    })
    .filter((v): v is ShowcaseView => !!v)
    .sort((a, b) => b.showcase.createdAt.localeCompare(a.showcase.createdAt));
}

/** 크루 둘러보기의 우수 사례 건수 (공개 중인 것만) */
export function publishedShowcaseCount(data: AppData, crewId: ID): number {
  return showcaseViews(data).filter((v) => v.crew.id === crewId).length;
}
