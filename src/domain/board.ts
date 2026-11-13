/**
 * 전체 크루 게시판 1차 (UI 개선 D, 사용자 확정).
 * - 보고 쓰는 사람: 로그인한 크루 구성원(크루원·크루장)과 관리자. 비로그인에게는 보이지 않는다.
 * - 첫 글을 쓸 때 운영 정책에 한 번 동의한다.
 * - 말머리 대신 '질문이에요' 표시 하나 (목록에 [질문], 질문만 보기).
 * - 신고: 누구나(자기 글 제외) 사유를 골라 신고. 크루장은 신고만 한다.
 * - 숨김: 관리자만. 숨기면 작성자 알림함에 사유가 간다. 숨김 해제도 관리자만.
 * 크루 안 글(공지·자유·Q&A)과 비공개 질문·피드백은 섞지 않는다.
 */
import { FORM_ERROR, type CommandResult, type FieldErrors } from './commands';
import { getUser } from './queries';
import type { AppData, GlobalComment, GlobalPost, Hidden, ID, Instant, Report, ReportReason, User } from './types';

export const BOARD_TITLE_MAX = 60;
export const BOARD_BODY_MAX = 2000;
export const BOARD_COMMENT_MAX = 500;
export const PREVIEW_CHARS = 40;

export const BOARD_ERR = {
  notAllowed: '로그인한 크루 구성원과 관리자만 쓸 수 있어요.',
  title: '제목을 입력해 주세요.',
  titleLong: `제목은 ${BOARD_TITLE_MAX}자 이내로 써 주세요.`,
  body: '본문을 입력해 주세요.',
  bodyLong: `본문은 ${BOARD_BODY_MAX}자 이내로 써 주세요.`,
  agree: '처음 글을 쓸 때는 운영 정책에 동의해 주세요.',
  comment: '댓글 내용을 입력해 주세요.',
  commentLong: `댓글은 ${BOARD_COMMENT_MAX}자 이내로 써 주세요.`,
  notAuthor: '작성자만 고치거나 지울 수 있어요.',
  gone: '삭제되었거나 숨겨진 글이에요.',
  ownReport: '내 글은 신고할 수 없어요.',
  reported: '이미 신고했어요. 운영팀이 확인해요.',
  reason: '신고 사유를 고르세요.',
  reasonNote: '기타 사유를 적어 주세요.',
  adminOnly: '숨김 처리는 관리자만 할 수 있어요.',
  hideReason: '숨기는 사유를 고르세요.',
  notHidden: '숨겨진 글이 아니에요.',
} as const;

/** 본문 앞부분 + … (뒤에 더 있다는 표시, 사용자 확정) */
export function excerpt(text: string, max = PREVIEW_CHARS): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

export function canUseBoard(user: User | null | undefined): user is User {
  return !!user && (user.role === 'member' || user.role === 'leader' || user.role === 'admin');
}

export function hasAgreed(data: AppData, userId: ID): boolean {
  return !!data.boardConsents[userId];
}

export interface BoardPostInput {
  title: string;
  body: string;
  question: boolean;
  /** 처음 쓸 때 운영 정책 동의 */
  agree?: boolean;
}

function validatePost(input: BoardPostInput): FieldErrors {
  const e: FieldErrors = {};
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) e.title = BOARD_ERR.title;
  else if (title.length > BOARD_TITLE_MAX) e.title = BOARD_ERR.titleLong;
  if (!body) e.body = BOARD_ERR.body;
  else if (body.length > BOARD_BODY_MAX) e.body = BOARD_ERR.bodyLong;
  return e;
}

export function createGlobalPost(data: AppData, actorId: ID, input: BoardPostInput, now: Instant): CommandResult<GlobalPost> {
  const actor = getUser(data, actorId);
  if (!canUseBoard(actor)) return { ok: false, errors: { [FORM_ERROR]: BOARD_ERR.notAllowed } };
  const errors = validatePost(input);
  const agreed = hasAgreed(data, actorId);
  if (!agreed && !input.agree) errors.agree = BOARD_ERR.agree;
  if (Object.keys(errors).length) return { ok: false, errors };
  const seq = data.seq + 1;
  const post: GlobalPost = { id: `global-post-${seq}`, authorId: actorId, title: input.title.trim(), body: input.body.trim(), question: !!input.question, createdAt: now };
  return {
    ok: true,
    data: { ...data, seq, globalPosts: [...data.globalPosts, post], boardConsents: agreed ? data.boardConsents : { ...data.boardConsents, [actorId]: now } },
    value: post,
  };
}

function ownPost(data: AppData, actorId: ID, postId: ID): GlobalPost | string {
  const post = data.globalPosts.find((p) => p.id === postId);
  if (!post || post.deletedAt) return BOARD_ERR.gone;
  if (post.authorId !== actorId) return BOARD_ERR.notAuthor;
  return post;
}

export function updateGlobalPost(data: AppData, actorId: ID, postId: ID, input: BoardPostInput, now: Instant): CommandResult<GlobalPost> {
  const post = ownPost(data, actorId, postId);
  if (typeof post === 'string') return { ok: false, errors: { [FORM_ERROR]: post } };
  if (post.hidden) return { ok: false, errors: { [FORM_ERROR]: BOARD_ERR.gone } };
  const errors = validatePost(input);
  if (Object.keys(errors).length) return { ok: false, errors };
  const next: GlobalPost = { ...post, title: input.title.trim(), body: input.body.trim(), question: !!input.question, updatedAt: now };
  return { ok: true, data: { ...data, globalPosts: data.globalPosts.map((p) => (p.id === postId ? next : p)) }, value: next };
}

export function deleteGlobalPost(data: AppData, actorId: ID, postId: ID, now: Instant): CommandResult<GlobalPost> {
  const post = ownPost(data, actorId, postId);
  if (typeof post === 'string') return { ok: false, errors: { [FORM_ERROR]: post } };
  const next: GlobalPost = { ...post, deletedAt: now };
  return { ok: true, data: { ...data, globalPosts: data.globalPosts.map((p) => (p.id === postId ? next : p)) }, value: next };
}

export function addGlobalComment(data: AppData, actorId: ID, postId: ID, body: string, now: Instant): CommandResult<GlobalComment> {
  const actor = getUser(data, actorId);
  if (!canUseBoard(actor)) return { ok: false, errors: { [FORM_ERROR]: BOARD_ERR.notAllowed } };
  const post = data.globalPosts.find((p) => p.id === postId);
  if (!post || post.deletedAt || post.hidden) return { ok: false, errors: { [FORM_ERROR]: BOARD_ERR.gone } };
  const text = body.trim();
  if (!text) return { ok: false, errors: { body: BOARD_ERR.comment } };
  if (text.length > BOARD_COMMENT_MAX) return { ok: false, errors: { body: BOARD_ERR.commentLong } };
  const seq = data.seq + 1;
  const comment: GlobalComment = { id: `global-comment-${seq}`, postId, authorId: actorId, body: text, createdAt: now };
  return { ok: true, data: { ...data, seq, globalComments: [...data.globalComments, comment] }, value: comment };
}

export function deleteGlobalComment(data: AppData, actorId: ID, commentId: ID, now: Instant): CommandResult<GlobalComment> {
  const c = data.globalComments.find((x) => x.id === commentId);
  if (!c || c.deletedAt) return { ok: false, errors: { [FORM_ERROR]: BOARD_ERR.gone } };
  if (c.authorId !== actorId) return { ok: false, errors: { [FORM_ERROR]: BOARD_ERR.notAuthor } };
  const next = { ...c, deletedAt: now };
  return { ok: true, data: { ...data, globalComments: data.globalComments.map((x) => (x.id === commentId ? next : x)) }, value: next };
}

type Target = { type: 'post'; item: GlobalPost } | { type: 'comment'; item: GlobalComment };

export function findTarget(data: AppData, type: 'post' | 'comment', id: ID): Target | undefined {
  if (type === 'post') {
    const item = data.globalPosts.find((p) => p.id === id);
    return item ? { type, item } : undefined;
  }
  const item = data.globalComments.find((c) => c.id === id);
  return item ? { type, item } : undefined;
}

export function reportTarget(data: AppData, actorId: ID, type: 'post' | 'comment', id: ID, reason: ReportReason | '', note: string, now: Instant): CommandResult<Report> {
  const actor = getUser(data, actorId);
  if (!canUseBoard(actor)) return { ok: false, errors: { [FORM_ERROR]: BOARD_ERR.notAllowed } };
  const target = findTarget(data, type, id);
  if (!target || target.item.deletedAt || target.item.hidden) return { ok: false, errors: { [FORM_ERROR]: BOARD_ERR.gone } };
  if (target.item.authorId === actorId) return { ok: false, errors: { [FORM_ERROR]: BOARD_ERR.ownReport } };
  if (data.reports.some((r) => r.targetType === type && r.targetId === id && r.reporterId === actorId)) return { ok: false, errors: { [FORM_ERROR]: BOARD_ERR.reported } };
  if (!reason) return { ok: false, errors: { reason: BOARD_ERR.reason } };
  if (reason === 'other' && !note.trim()) return { ok: false, errors: { note: BOARD_ERR.reasonNote } };
  const seq = data.seq + 1;
  const report: Report = { id: `report-${seq}`, targetType: type, targetId: id, reporterId: actorId, reason, note: note.trim(), createdAt: now };
  return { ok: true, data: { ...data, seq, reports: [...data.reports, report] }, value: report };
}

export function hasReported(data: AppData, userId: ID, type: 'post' | 'comment', id: ID): boolean {
  return data.reports.some((r) => r.targetType === type && r.targetId === id && r.reporterId === userId);
}

function resolveReports(reports: Report[], type: 'post' | 'comment', id: ID, adminId: ID, now: Instant, resolution: 'hidden' | 'dismissed'): Report[] {
  return reports.map((r) => (r.targetType === type && r.targetId === id && !r.resolvedAt ? { ...r, resolvedAt: now, resolvedBy: adminId, resolution } : r));
}

function setHidden(data: AppData, type: 'post' | 'comment', id: ID, hidden: Hidden | undefined): AppData {
  if (type === 'post') return { ...data, globalPosts: data.globalPosts.map((p) => (p.id === id ? { ...p, hidden } : p)) };
  return { ...data, globalComments: data.globalComments.map((c) => (c.id === id ? { ...c, hidden } : c)) };
}

/** 관리자 숨김: 작성자 알림함에 사유가 가고, 그 대상의 열린 신고는 '숨김'으로 처리된다 */
export function hideTarget(data: AppData, adminId: ID, type: 'post' | 'comment', id: ID, reason: ReportReason | '', note: string, now: Instant): CommandResult<Hidden> {
  const admin = getUser(data, adminId);
  if (!admin || admin.role !== 'admin') return { ok: false, errors: { [FORM_ERROR]: BOARD_ERR.adminOnly } };
  const target = findTarget(data, type, id);
  if (!target || target.item.deletedAt || target.item.hidden) return { ok: false, errors: { [FORM_ERROR]: BOARD_ERR.gone } };
  if (!reason) return { ok: false, errors: { reason: BOARD_ERR.hideReason } };
  const hidden: Hidden = { at: now, by: adminId, reason, note: note.trim() };
  const next = setHidden({ ...data, reports: resolveReports(data.reports, type, id, adminId, now, 'hidden') }, type, id, hidden);
  return { ok: true, data: next, value: hidden };
}

export function unhideTarget(data: AppData, adminId: ID, type: 'post' | 'comment', id: ID): CommandResult<null> {
  const admin = getUser(data, adminId);
  if (!admin || admin.role !== 'admin') return { ok: false, errors: { [FORM_ERROR]: BOARD_ERR.adminOnly } };
  const target = findTarget(data, type, id);
  if (!target?.item.hidden) return { ok: false, errors: { [FORM_ERROR]: BOARD_ERR.notHidden } };
  return { ok: true, data: setHidden(data, type, id, undefined), value: null };
}

/** 신고 무시: 숨기지 않고 열린 신고만 정리한다 */
export function dismissReports(data: AppData, adminId: ID, type: 'post' | 'comment', id: ID, now: Instant): CommandResult<null> {
  const admin = getUser(data, adminId);
  if (!admin || admin.role !== 'admin') return { ok: false, errors: { [FORM_ERROR]: BOARD_ERR.adminOnly } };
  return { ok: true, data: { ...data, reports: resolveReports(data.reports, type, id, adminId, now, 'dismissed') }, value: null };
}

/** 목록: 최신순. 지운 글은 빼고, 숨긴 글은 관리자와 작성자에게만 (표시와 함께) */
export function boardPosts(data: AppData, user: User, questionsOnly = false): GlobalPost[] {
  return data.globalPosts
    .filter((p) => !p.deletedAt)
    .filter((p) => !p.hidden || user.role === 'admin' || p.authorId === user.id)
    .filter((p) => !questionsOnly || p.question)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function boardComments(data: AppData, user: User, postId: ID): GlobalComment[] {
  return data.globalComments
    .filter((c) => c.postId === postId)
    .filter((c) => !c.hidden || user.role === 'admin' || c.authorId === user.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function canViewBoardPost(data: AppData, user: User, postId: ID): boolean {
  return boardPosts(data, user).some((p) => p.id === postId);
}

export interface ReportGroup {
  type: 'post' | 'comment';
  id: ID;
  /** 글 제목 또는 댓글 앞부분 */
  label: string;
  /** 댓글이면 달린 글 */
  postId: ID;
  authorId: ID;
  reports: Report[];
  latestAt: Instant;
}

/** 관리자 신고함: 아직 처리하지 않은 신고를 대상별로 묶어 최근순 */
export function reportQueue(data: AppData): ReportGroup[] {
  const groups = new Map<string, ReportGroup>();
  for (const r of data.reports.filter((x) => !x.resolvedAt)) {
    const t = findTarget(data, r.targetType, r.targetId);
    if (!t || t.item.deletedAt) continue;
    const key = `${r.targetType}:${r.targetId}`;
    const g =
      groups.get(key) ??
      {
        type: r.targetType,
        id: r.targetId,
        label: t.type === 'post' ? t.item.title : excerpt(t.item.body),
        postId: t.type === 'post' ? t.item.id : t.item.postId,
        authorId: t.item.authorId,
        reports: [],
        latestAt: r.createdAt,
      };
    g.reports.push(r);
    if (r.createdAt > g.latestAt) g.latestAt = r.createdAt;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

/** 숨긴 글·댓글 (관리자 신고함 아래 '숨긴 항목') */
export function hiddenItems(data: AppData): { type: 'post' | 'comment'; id: ID; label: string; postId: ID; hidden: Hidden }[] {
  return [
    ...data.globalPosts.filter((p) => p.hidden && !p.deletedAt).map((p) => ({ type: 'post' as const, id: p.id, label: p.title, postId: p.id, hidden: p.hidden! })),
    ...data.globalComments.filter((c) => c.hidden && !c.deletedAt).map((c) => ({ type: 'comment' as const, id: c.id, label: excerpt(c.body), postId: c.postId, hidden: c.hidden! })),
  ].sort((a, b) => b.hidden.at.localeCompare(a.hidden.at));
}

/** 작성자 표시: 이름 · 크루(관리자는 '운영팀') */
export function authorLabel(data: AppData, userId: ID): string {
  const u = getUser(data, userId);
  if (!u) return '';
  if (u.role === 'admin') return `${u.name} · 운영팀`;
  const crew = data.crews.find((c) => c.id === u.crewId);
  return `${u.name} · ${crew ? `${crew.name}` : ''}${u.role === 'leader' ? ' 크루장' : ''}`;
}
