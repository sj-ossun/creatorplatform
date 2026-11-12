/**
 * 관리자 공지 (6-C, 사용자 결정). 관리자가 담당 크루를 골라 올리면 그 크루의 크루방 공지 카드와
 * 구성원 알림함에 보인다. 앱 안에서만 보이고 외부로 보내지 않는다. 지우면 '삭제됨'으로 남기고 화면에서 내린다.
 */
import { FORM_ERROR, type CommandResult, type FieldErrors } from './commands';
import { getUser } from './queries';
import type { AdminNotice, AppData, ID, Instant } from './types';

export const ADMIN_NOTICE_TITLE_MAX = 40;
export const ADMIN_NOTICE_BODY_MAX = 300;

export const ADMIN_NOTICE_ERR = {
  notAllowed: '관리자만 운영 공지를 올리고 지울 수 있어요.',
  title: '제목을 입력해 주세요.',
  titleLong: `제목은 ${ADMIN_NOTICE_TITLE_MAX}자 이내로 써 주세요.`,
  body: '내용을 입력해 주세요.',
  bodyLong: `내용은 ${ADMIN_NOTICE_BODY_MAX}자 이내로 써 주세요.`,
  crews: '공지를 볼 크루를 하나 이상 골라 주세요.',
} as const;

export interface AdminNoticeInput {
  title: string;
  body: string;
  crewIds: ID[];
}

export function validateAdminNotice(data: AppData, actorId: ID, input: AdminNoticeInput): FieldErrors {
  const actor = getUser(data, actorId);
  const errors: FieldErrors = {};
  if (!actor || actor.role !== 'admin') return { [FORM_ERROR]: ADMIN_NOTICE_ERR.notAllowed };
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) errors.title = ADMIN_NOTICE_ERR.title;
  else if (title.length > ADMIN_NOTICE_TITLE_MAX) errors.title = ADMIN_NOTICE_ERR.titleLong;
  if (!body) errors.body = ADMIN_NOTICE_ERR.body;
  else if (body.length > ADMIN_NOTICE_BODY_MAX) errors.body = ADMIN_NOTICE_ERR.bodyLong;
  const crews = input.crewIds.filter((id) => actor.managedCrewIds.includes(id));
  if (crews.length === 0) errors.crewIds = ADMIN_NOTICE_ERR.crews;
  return errors;
}

export function createAdminNotice(data: AppData, actorId: ID, input: AdminNoticeInput, now: Instant): CommandResult<AdminNotice> {
  const errors = validateAdminNotice(data, actorId, input);
  if (Object.keys(errors).length) return { ok: false, errors };
  const actor = getUser(data, actorId)!;
  const seq = data.seq + 1;
  const notice: AdminNotice = {
    id: `admin-notice-${seq}`,
    authorId: actorId,
    title: input.title.trim(),
    body: input.body.trim(),
    crewIds: [...new Set(input.crewIds.filter((id) => actor.managedCrewIds.includes(id)))],
    createdAt: now,
  };
  return { ok: true, data: { ...data, seq, adminNotices: [...data.adminNotices, notice] }, value: notice };
}

export function deleteAdminNotice(data: AppData, actorId: ID, noticeId: ID, now: Instant): CommandResult<AdminNotice> {
  const actor = getUser(data, actorId);
  const notice = data.adminNotices.find((n) => n.id === noticeId);
  if (!actor || actor.role !== 'admin' || !notice || notice.deletedAt || !notice.crewIds.some((id) => actor.managedCrewIds.includes(id))) {
    return { ok: false, errors: { [FORM_ERROR]: ADMIN_NOTICE_ERR.notAllowed } };
  }
  const next = { ...notice, deletedAt: now };
  return { ok: true, data: { ...data, adminNotices: data.adminNotices.map((n) => (n.id === noticeId ? next : n)) }, value: next };
}

/** 크루가 볼 운영 공지 (최신순, 지운 것 제외) */
export function adminNoticesForCrew(data: AppData, crewId: ID | null): AdminNotice[] {
  if (!crewId) return [];
  return data.adminNotices.filter((n) => !n.deletedAt && n.crewIds.includes(crewId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 관리자가 관리하는 운영 공지 (담당 크루에 걸친 것, 최신순) */
export function adminNoticesFor(data: AppData, adminId: ID): AdminNotice[] {
  const admin = getUser(data, adminId);
  if (!admin) return [];
  return data.adminNotices
    .filter((n) => !n.deletedAt && n.crewIds.some((id) => admin.managedCrewIds.includes(id)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
