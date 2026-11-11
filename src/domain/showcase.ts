/**
 * 우수 사례 (v0.6 4.5단계, 사용자 결정).
 * 대상: 검토 완료 + 게시 기록이 있는 결과물. 지정: 그 크루의 크루장 또는 담당 관리자.
 * 보여주는 것: 실제 게시 URL, 최신 조회수·확인일, 지정한 사람의 한 줄 평. 시연 데이터는 가상 사례다.
 */
import { FORM_ERROR, type CommandResult } from './commands';
import { metricOf, postOf, type MetricKind } from './performance';
import { getCrew, getDeliverable, getMission, getUser } from './queries';
import type { AppData, Crew, Deliverable, ID, Instant, Mission, Post, Showcase, User } from './types';

export const SHOWCASE_COMMENT_MAX = 80;

export const SHOWCASE_ERR = {
  notAllowed: '이 결과물을 사례로 지정할 수 있는 계정이 아니에요.',
  notEligible: '검토가 끝나고 게시 기록이 있는 결과물만 사례로 소개할 수 있어요.',
  duplicate: '이미 사례로 소개 중인 결과물이에요.',
  comment: '한 줄 평을 입력해 주세요.',
  commentLong: `한 줄 평은 ${SHOWCASE_COMMENT_MAX}자 이내로 써 주세요.`,
} as const;

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
): CommandResult<Showcase> {
  const actor = getUser(data, actorId);
  const deliverable = getDeliverable(data, deliverableId);
  if (!actor || !deliverable || !canCurate(data, actor, deliverable)) return { ok: false, errors: { [FORM_ERROR]: SHOWCASE_ERR.notAllowed } };
  if (!isEligible(data, deliverable)) return { ok: false, errors: { [FORM_ERROR]: SHOWCASE_ERR.notEligible } };
  if (showcaseOf(data, deliverableId)) return { ok: false, errors: { [FORM_ERROR]: SHOWCASE_ERR.duplicate } };
  const text = comment.trim();
  if (!text) return { ok: false, errors: { comment: SHOWCASE_ERR.comment } };
  if (text.length > SHOWCASE_COMMENT_MAX) return { ok: false, errors: { comment: SHOWCASE_ERR.commentLong } };
  const seq = data.seq + 1;
  const showcase: Showcase = { id: `showcase-${seq}`, deliverableId, comment: text, authorId: actor.id, createdAt: now };
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

export interface ShowcaseView {
  showcase: Showcase;
  creator: User;
  crew: Crew;
  mission: Mission;
  post: Post;
  metric: MetricKind;
  author: User;
}

/** 공개 사례 목록 (최근 지정순). 게시 기록이 없어진 결과물은 보여주지 않는다 */
export function showcaseViews(data: AppData): ShowcaseView[] {
  return data.showcases
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
