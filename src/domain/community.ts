/**
 * 크루 소통 (F-10). 게시글·댓글은 같은 크루에 공개한다.
 * 개인 제출·피드백은 글에 자동으로 노출하지 않는다.
 * 관련 미션은 미션 대상자 또는 담당 크루장만 연다 (예시 접근 범위).
 */
import { canManageMission, canWorkOnMission } from './access';
import { FORM_ERROR, type CommandResult, type FieldErrors } from './commands';
import { getMission, getUser, missionsAssignedTo, missionsOfCrew } from './queries';
import type { AppData, CommunityComment, CommunityKind, CommunityPost, ID, Instant, Mission, User } from './types';

export const COMMUNITY_ERR = {
  kind: '글 구분을 고르세요.',
  noticeNotAllowed: '공지는 크루장만 쓸 수 있어요.',
  title: '제목을 입력해 주세요.',
  body: '본문을 입력해 주세요.',
  mission: '연결할 수 없는 미션이에요. 다른 미션을 고르거나 연결하지 마세요.',
  comment: '댓글 내용을 입력해 주세요.',
  notAllowed: '이 크루의 글에 참여할 수 있는 예시 사용자가 아니에요.',
} as const;

export interface CommunityPostInput {
  kind: CommunityKind | '';
  title: string;
  body: string;
  missionId: ID | '';
}

/** 크루 소통에 참여하는 사람: 그 크루의 크루장·크루원 */
export function isCrewParticipant(user: User | undefined, crewId: ID): user is User {
  return !!user && (user.role === 'leader' || user.role === 'member') && user.crewId === crewId;
}

/** 작성자 역할별로 고를 수 있는 글 구분 */
export function kindsFor(user: User): CommunityKind[] {
  return user.role === 'leader' ? ['notice', 'post', 'question'] : ['post', 'question'];
}

/** 공지가 먼저, 나머지(글·질문)는 최신순 */
export function postsOfCrew(data: AppData, crewId: ID): CommunityPost[] {
  const order: Record<CommunityKind, number> = { notice: 0, post: 1, question: 1 };
  return data.communityPosts
    .filter((p) => p.crewId === crewId)
    .sort((a, b) => order[a.kind] - order[b.kind] || b.createdAt.localeCompare(a.createdAt));
}

/** 댓글은 작성순 */
export function commentsOf(data: AppData, postId: ID): CommunityComment[] {
  return data.comments.filter((c) => c.postId === postId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** 작성자가 연결할 수 있는 미션: 자기에게 보이는 같은 크루 미션 */
export function linkableMissions(data: AppData, user: User): Mission[] {
  if (user.role === 'leader') return missionsOfCrew(data, user.crewId);
  if (user.role === 'member') return missionsAssignedTo(data, user.id).filter((m) => m.crewId === user.crewId);
  return [];
}

/** 연결 미션을 열 수 있는지: 미션 대상자 또는 담당 크루장 */
export function canOpenLinkedMission(user: User, mission: Mission): boolean {
  return canWorkOnMission(user, mission) || canManageMission(user, mission);
}

export function validateCommunityPost(data: AppData, author: User, input: CommunityPostInput): FieldErrors {
  const errors: FieldErrors = {};
  if (input.kind !== 'notice' && input.kind !== 'post' && input.kind !== 'question') errors.kind = COMMUNITY_ERR.kind;
  else if (input.kind === 'notice' && author.role !== 'leader') errors.kind = COMMUNITY_ERR.noticeNotAllowed;
  if (!input.title.trim()) errors.title = COMMUNITY_ERR.title;
  if (!input.body.trim()) errors.body = COMMUNITY_ERR.body;
  if (input.missionId && !linkableMissions(data, author).some((m) => m.id === input.missionId)) {
    errors.missionId = COMMUNITY_ERR.mission;
  }
  return errors;
}

export function createCommunityPost(
  data: AppData,
  actorId: ID,
  input: CommunityPostInput,
  now: Instant,
): CommandResult<CommunityPost> {
  const author = getUser(data, actorId);
  if (!author?.crewId || !isCrewParticipant(author, author.crewId)) {
    return { ok: false, errors: { [FORM_ERROR]: COMMUNITY_ERR.notAllowed } };
  }
  const errors = validateCommunityPost(data, author, input);
  if (Object.keys(errors).length) return { ok: false, errors };
  const seq = data.seq + 1;
  const post: CommunityPost = {
    id: `community-${seq}`,
    crewId: author.crewId,
    kind: input.kind as CommunityKind,
    title: input.title.trim(),
    body: input.body.trim(),
    missionId: input.missionId || null,
    authorId: author.id,
    createdAt: now,
  };
  return { ok: true, data: { ...data, seq, communityPosts: [...data.communityPosts, post] }, value: post };
}

export function addComment(
  data: AppData,
  actorId: ID,
  postId: ID,
  body: string,
  now: Instant,
): CommandResult<CommunityComment> {
  const author = getUser(data, actorId);
  const post = data.communityPosts.find((p) => p.id === postId);
  if (!post || !isCrewParticipant(author, post.crewId)) {
    return { ok: false, errors: { [FORM_ERROR]: COMMUNITY_ERR.notAllowed } };
  }
  if (!body.trim()) return { ok: false, errors: { body: COMMUNITY_ERR.comment } };
  const seq = data.seq + 1;
  const comment: CommunityComment = { id: `comment-${seq}`, postId, authorId: author.id, body: body.trim(), createdAt: now };
  return { ok: true, data: { ...data, seq, comments: [...data.comments, comment] }, value: comment };
}

/** 글 연결 미션 표시 정보. 열 수 없으면 제목·내용을 주지 않는다 */
export function linkedMissionView(
  data: AppData,
  user: User,
  post: CommunityPost,
): { kind: 'none' } | { kind: 'open'; mission: Mission } | { kind: 'locked' } {
  if (!post.missionId) return { kind: 'none' };
  const mission = getMission(data, post.missionId);
  if (!mission) return { kind: 'none' };
  return canOpenLinkedMission(user, mission) ? { kind: 'open', mission } : { kind: 'locked' };
}
