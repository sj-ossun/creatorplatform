/**
 * 광고 제안 (6-B, 사용자 결정).
 * - 관리자 → 크루원 여러 명 또는 크루장 여러 명 (한 제안에 섞지 않음). 담당 크루 안에서만.
 * - 받는 사람별 수락·거절 (거절 사유 선택). 수락 후 철회 없음.
 * - 크루장: 조회, 자기 크루원 여러 명에게 전달 기록(카톡 등), 추천(여러 명, 관리자가 확인 후 보냄), 대리 응답(진행할 크루원 0명 이상).
 * - 2일 동안 응답이 없으면 관리자에게 '다시 알림' 안내. 같은 받는 사람에게 하루 한 번.
 * - 누구든 응답하기 전까지만 조건 수정. 취소는 언제든 (기록은 남음).
 * - 수락하면 받는 크루원별 진행 기록(Proposal)을 만든다. 진행 상태·수익 기록은 관리자 내부용 (5단계 그대로).
 * 실제 진행·계약·정산·외부 발송은 하지 않는다.
 */
import { FORM_ERROR, type CommandResult, type FieldErrors } from './commands';
import { getUser } from './queries';
import { isValidDay, todayKst } from './time';
import { PROPOSAL_KIND_LABEL, type AppData, type DeclineReason, type ID, type Instant, type Offer, type OfferForward, type OfferRecipient, type OfferRecommendation, type Proposal, type ProposalKind, type User } from './types';

export const OFFER_CATEGORIES = ['푸드', '뷰티', '패션', '여행', '테크', '생활', '기타'];
export const OFFER_FORMATS: ProposalKind[] = ['ad', 'commerce', 'group_buy'];
export const NO_RESPONSE_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
export const FORWARD_CHANNELS = ['카카오톡', '전화', '문자', '기타'];

export const OFFER_ERR = {
  notAllowed: '이 제안을 다룰 수 있는 계정이 아니에요.',
  brand: '브랜드명을 입력해 주세요.',
  product: '제품명을 입력해 주세요.',
  category: '카테고리를 고르세요.',
  description: '제품 설명을 입력해 주세요.',
  format: '광고 형식을 고르세요.',
  price: '단가는 0 이상의 정수(원)로 입력해 주세요.',
  uploadOn: '희망 업로드 일자를 골라 주세요.',
  recipients: '받는 사람을 한 명 이상 고르세요.',
  recipientScope: '담당 크루의 크루원 또는 크루장만 고를 수 있어요.',
  locked: '이미 응답한 사람이 있어 조건을 고칠 수 없어요. 취소하고 새로 보내 주세요.',
  stale: '그사이 조건이 바뀌었어요. 바뀐 조건을 확인하고 다시 응답해 주세요.',
  cancelled: '취소된 제안이에요.',
  responded: '이미 응답한 제안이에요. 수락한 뒤에는 철회할 수 없어요.',
  reason: '거절 사유를 고르세요.',
  reasonNote: '기타 사유를 적어 주세요.',
  members: '자기 크루의 크루원만 고를 수 있어요.',
  membersRequired: '크루원을 한 명 이상 고르세요.',
  channel: '연락 수단을 고르세요.',
  recReason: '추천 사유를 짧게 적어 주세요.',
  remindEarly: `보낸 지 ${NO_RESPONSE_DAYS}일이 지나야 다시 알릴 수 있어요.`,
  remindToday: '오늘 이미 다시 알렸어요. 같은 사람에게 하루 한 번 보낼 수 있어요.',
} as const;

export interface OfferInput {
  brand: string;
  product: string;
  category: string;
  description: string;
  format: ProposalKind | '';
  price: string;
  uploadOn: string;
  note: string;
  internalMemo?: string;
  recipientType: 'member' | 'leader';
  recipientIds: ID[];
}

export function offerOf(data: AppData, id: ID): Offer | undefined {
  return data.offers.find((o) => o.id === id);
}
export function recipientsOf(data: AppData, offerId: ID): OfferRecipient[] {
  return data.offerRecipients.filter((r) => r.offerId === offerId);
}
export function isLocked(data: AppData, offerId: ID): boolean {
  return recipientsOf(data, offerId).some((r) => r.response !== 'pending');
}

/** 관리자가 고를 수 있는 받는 사람 (담당 크루) */
export function selectableRecipients(data: AppData, admin: User, type: 'member' | 'leader', category?: string): User[] {
  if (admin.role !== 'admin') return [];
  return data.users.filter((u) => {
    if (u.role !== type || !u.crewId || !admin.managedCrewIds.includes(u.crewId)) return false;
    if (!category) return true;
    const crew = data.crews.find((c) => c.id === u.crewId);
    const cat = crew?.category;
    return !cat || cat === category;
  });
}

/** 조건 번호: 처음 보낸 조건이 1, 고칠 때마다 1씩 (UI 개선 C) */
export function offerVersion(offer: Offer): number {
  return 1 + (offer.revisions?.length ?? 0);
}

/** 단가 표시용: 300000 → '300,000원' */
export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

/** 조건 수정에서 바뀐 항목 (받는 사람에게 보이는 조건만. 내부 메모는 제외) */
function conditionChanges(before: Offer, after: Offer): { field: string; from: string; to: string }[] {
  const rows: [string, string, string][] = [
    ['브랜드', before.brand, after.brand],
    ['제품', before.product, after.product],
    ['카테고리', before.category, after.category],
    ['광고 형식', PROPOSAL_KIND_LABEL[before.format], PROPOSAL_KIND_LABEL[after.format]],
    ['단가', formatWon(before.price), formatWon(after.price)],
    ['희망 업로드', before.uploadOn, after.uploadOn],
    ['제품 설명', before.description, after.description],
    ['비고', before.note || '없음', after.note || '없음'],
  ];
  return rows.filter(([, a, b]) => a !== b).map(([field, from, to]) => ({ field, from, to }));
}

function parsePrice(raw: string): number | null {
  const t = raw.replace(/[,\s원]/g, '');
  return /^\d+$/.test(t) ? Number(t) : null;
}

export function validateOffer(data: AppData, admin: User, input: OfferInput, checkRecipients = true): FieldErrors {
  const e: FieldErrors = {};
  if (!input.brand.trim()) e.brand = OFFER_ERR.brand;
  if (!input.product.trim()) e.product = OFFER_ERR.product;
  if (!OFFER_CATEGORIES.includes(input.category)) e.category = OFFER_ERR.category;
  if (!input.description.trim()) e.description = OFFER_ERR.description;
  if (!OFFER_FORMATS.includes(input.format as ProposalKind)) e.format = OFFER_ERR.format;
  if (parsePrice(input.price) === null) e.price = OFFER_ERR.price;
  if (!isValidDay(input.uploadOn)) e.uploadOn = OFFER_ERR.uploadOn;
  if (checkRecipients) {
    if (input.recipientIds.length === 0) e.recipients = OFFER_ERR.recipients;
    else {
      const allowed = new Set(selectableRecipients(data, admin, input.recipientType).map((u) => u.id));
      if (input.recipientIds.some((id) => !allowed.has(id))) e.recipients = OFFER_ERR.recipientScope;
    }
  }
  return e;
}

export function sendOffer(data: AppData, actorId: ID, input: OfferInput, now: Instant, sourceOfferId?: ID): CommandResult<Offer> {
  const admin = getUser(data, actorId);
  if (!admin || admin.role !== 'admin') return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.notAllowed } };
  const errors = validateOffer(data, admin, input);
  if (Object.keys(errors).length) return { ok: false, errors };
  const seq = data.seq + 1;
  const offer: Offer = {
    id: `offer-${seq}`,
    brand: input.brand.trim(),
    product: input.product.trim(),
    category: input.category,
    description: input.description.trim(),
    format: input.format as ProposalKind,
    price: parsePrice(input.price)!,
    uploadOn: input.uploadOn,
    note: input.note.trim(),
    internalMemo: input.internalMemo?.trim() ?? '',
    recipientType: input.recipientType,
    createdBy: actorId,
    createdAt: now,
    ...(sourceOfferId ? { sourceOfferId } : {}),
  };
  const recipients: OfferRecipient[] = [...new Set(input.recipientIds)].map((userId, i) => ({
    id: `offer-${seq}-r${i + 1}`,
    offerId: offer.id,
    userId,
    response: 'pending',
    reminders: [],
  }));
  return { ok: true, data: { ...data, seq, offers: [...data.offers, offer], offerRecipients: [...data.offerRecipients, ...recipients] }, value: offer };
}

/** 조건 수정: 누구든 응답하기 전까지만. 받는 사람은 바꾸지 않는다 */
export function updateOffer(data: AppData, actorId: ID, offerId: ID, input: OfferInput, now: Instant): CommandResult<Offer> {
  const admin = getUser(data, actorId);
  const offer = offerOf(data, offerId);
  if (!admin || admin.role !== 'admin' || !offer || !canAdminSee(data, admin, offer)) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.notAllowed } };
  if (offer.cancelledAt) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.cancelled } };
  if (isLocked(data, offerId)) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.locked } };
  const errors = validateOffer(data, admin, input, false);
  if (Object.keys(errors).length) return { ok: false, errors };
  const next: Offer = {
    ...offer,
    brand: input.brand.trim(),
    product: input.product.trim(),
    category: input.category,
    description: input.description.trim(),
    format: input.format as ProposalKind,
    price: parsePrice(input.price)!,
    uploadOn: input.uploadOn,
    note: input.note.trim(),
    internalMemo: input.internalMemo?.trim() ?? offer.internalMemo ?? '',
    updatedAt: now,
  };
  const changes = conditionChanges(offer, next);
  if (changes.length) next.revisions = [...(offer.revisions ?? []), { at: now, changes }];
  return { ok: true, data: { ...data, offers: data.offers.map((o) => (o.id === offerId ? next : o)) }, value: next };
}

export function cancelOffer(data: AppData, actorId: ID, offerId: ID, now: Instant): CommandResult<Offer> {
  const admin = getUser(data, actorId);
  const offer = offerOf(data, offerId);
  if (!admin || admin.role !== 'admin' || !offer || !canAdminSee(data, admin, offer)) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.notAllowed } };
  if (offer.cancelledAt) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.cancelled } };
  const next = { ...offer, cancelledAt: now, cancelledBy: actorId };
  return { ok: true, data: { ...data, offers: data.offers.map((o) => (o.id === offerId ? next : o)) }, value: next };
}

/** 관리자가 그 제안을 볼 수 있는지: 받는 사람이 모두 담당 크루 */
export function canAdminSee(data: AppData, admin: User, offer: Offer): boolean {
  if (admin.role !== 'admin') return false;
  return recipientsOf(data, offer.id).every((r) => {
    const u = getUser(data, r.userId);
    return !!u?.crewId && admin.managedCrewIds.includes(u.crewId);
  });
}

function crewMembersOf(data: AppData, leader: User): ID[] {
  return data.users.filter((u) => u.role === 'member' && u.crewId === leader.crewId).map((u) => u.id);
}

function makeProgress(data: AppData, offer: Offer, memberId: ID, by: ID, now: Instant, seq: number): Proposal {
  return {
    id: `proposal-${seq}`,
    creatorId: memberId,
    proposedOn: todayKst(offer.createdAt),
    owner: getUser(data, offer.createdBy)?.name ?? '',
    kind: offer.format,
    brand: `${offer.brand} · ${offer.product}`,
    content: offer.description,
    status: 'negotiating',
    internalMemo: offer.internalMemo ?? '',
    createdBy: by,
    createdAt: now,
    history: [{ from: null, to: 'negotiating', by, at: now }],
    offerId: offer.id,
  };
}

export interface RespondInput {
  response: 'accepted' | 'declined';
  reason?: DeclineReason | '';
  note?: string;
  /** 크루장 대리 수락 때 진행할 크루원 (0명 이상) */
  memberIds?: ID[];
  /** UI 개선 C: 응답 화면을 열었을 때 본 조건 번호. 그사이 바뀌었으면 다시 확인하게 한다 */
  seenVersion?: number;
}

/** 수락·거절 (받는 본인 또는 크루장 대리). 수락하면 크루원별 진행 기록을 만든다 */
export function respondOffer(data: AppData, actorId: ID, recipientId: ID, input: RespondInput, now: Instant): CommandResult<OfferRecipient> {
  const actor = getUser(data, actorId);
  const rec = data.offerRecipients.find((r) => r.id === recipientId);
  const offer = rec && offerOf(data, rec.offerId);
  if (!actor || !rec || !offer || rec.userId !== actorId) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.notAllowed } };
  if (offer.cancelledAt) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.cancelled } };
  if (rec.response !== 'pending') return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.responded } };
  if (input.seenVersion !== undefined && input.seenVersion !== offerVersion(offer)) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.stale } };
  const errors: FieldErrors = {};
  if (input.response === 'declined') {
    if (!input.reason) errors.reason = OFFER_ERR.reason;
    else if (input.reason === 'other' && !input.note?.trim()) errors.note = OFFER_ERR.reasonNote;
  }
  const memberIds = actor.role === 'leader' && input.response === 'accepted' ? [...new Set(input.memberIds ?? [])] : [];
  if (memberIds.length) {
    const own = new Set(crewMembersOf(data, actor));
    if (memberIds.some((id) => !own.has(id))) errors.members = OFFER_ERR.members;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  const next: OfferRecipient = {
    ...rec,
    response: input.response,
    respondedAt: now,
    respondedBy: actorId,
    respondedVersion: offerVersion(offer),
    ...(input.response === 'declined' ? { declineReason: input.reason as DeclineReason, declineNote: input.note?.trim() ?? '' } : {}),
    ...(actor.role === 'leader' ? { proxyMemberIds: memberIds } : {}),
  };
  let seq = data.seq;
  const progress: Proposal[] = [];
  if (input.response === 'accepted') {
    const forMembers = actor.role === 'member' ? [actor.id] : memberIds;
    for (const m of forMembers) progress.push(makeProgress(data, offer, m, actorId, now, ++seq));
  }
  return {
    ok: true,
    data: { ...data, seq, offerRecipients: data.offerRecipients.map((r) => (r.id === rec.id ? next : r)), proposals: [...data.proposals, ...progress] },
    value: next,
  };
}

/** 응답 없음: 보낸(또는 마지막으로 다시 알린) 지 2일이 지난 응답 대기 */
export function staleSince(rec: OfferRecipient, offer: Offer): Instant {
  const last = rec.reminders.at(-1) ?? offer.createdAt;
  return new Date(new Date(last).getTime() + NO_RESPONSE_DAYS * DAY_MS).toISOString();
}
export function isStale(rec: OfferRecipient, offer: Offer, now: Instant): boolean {
  return rec.response === 'pending' && !offer.cancelledAt && now >= staleSince(rec, offer);
}
export function remindedToday(rec: OfferRecipient, now: Instant): boolean {
  const today = todayKst(now);
  return rec.reminders.some((r) => todayKst(r) === today);
}

export function remindRecipient(data: AppData, actorId: ID, recipientId: ID, now: Instant): CommandResult<OfferRecipient> {
  const admin = getUser(data, actorId);
  const rec = data.offerRecipients.find((r) => r.id === recipientId);
  const offer = rec && offerOf(data, rec.offerId);
  if (!admin || admin.role !== 'admin' || !rec || !offer || !canAdminSee(data, admin, offer)) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.notAllowed } };
  if (offer.cancelledAt) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.cancelled } };
  if (rec.response !== 'pending') return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.responded } };
  if (remindedToday(rec, now)) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.remindToday } };
  if (now < new Date(new Date(offer.createdAt).getTime() + NO_RESPONSE_DAYS * DAY_MS).toISOString()) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.remindEarly } };
  const next = { ...rec, reminders: [...rec.reminders, now] };
  return { ok: true, data: { ...data, offerRecipients: data.offerRecipients.map((r) => (r.id === rec.id ? next : r)) }, value: next };
}

function leaderRecipient(data: AppData, actor: User | undefined, offerId: ID): OfferRecipient | undefined {
  if (!actor || actor.role !== 'leader') return undefined;
  const offer = offerOf(data, offerId);
  if (!offer || offer.cancelledAt) return undefined;
  return recipientsOf(data, offerId).find((r) => r.userId === actor.id);
}

export function forwardOffer(data: AppData, actorId: ID, offerId: ID, memberIds: ID[], channel: string, memo: string, now: Instant): CommandResult<OfferForward> {
  const actor = getUser(data, actorId);
  if (!leaderRecipient(data, actor, offerId)) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.notAllowed } };
  const errors: FieldErrors = {};
  const ids = [...new Set(memberIds)];
  if (ids.length === 0) errors.members = OFFER_ERR.membersRequired;
  else if (ids.some((id) => !crewMembersOf(data, actor!).includes(id))) errors.members = OFFER_ERR.members;
  if (!FORWARD_CHANNELS.includes(channel)) errors.channel = OFFER_ERR.channel;
  if (Object.keys(errors).length) return { ok: false, errors };
  const seq = data.seq + 1;
  const fwd: OfferForward = { id: `forward-${seq}`, offerId, leaderId: actorId, memberIds: ids, channel, memo: memo.trim(), createdAt: now };
  return { ok: true, data: { ...data, seq, offerForwards: [...data.offerForwards, fwd] }, value: fwd };
}

export function recommendMembers(data: AppData, actorId: ID, offerId: ID, memberIds: ID[], reason: string, now: Instant): CommandResult<OfferRecommendation> {
  const actor = getUser(data, actorId);
  if (!leaderRecipient(data, actor, offerId)) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.notAllowed } };
  const errors: FieldErrors = {};
  const ids = [...new Set(memberIds)];
  if (ids.length === 0) errors.members = OFFER_ERR.membersRequired;
  else if (ids.some((id) => !crewMembersOf(data, actor!).includes(id))) errors.members = OFFER_ERR.members;
  if (!reason.trim()) errors.reason = OFFER_ERR.recReason;
  if (Object.keys(errors).length) return { ok: false, errors };
  const seq = data.seq + 1;
  const rec: OfferRecommendation = { id: `recommendation-${seq}`, offerId, leaderId: actorId, memberIds: ids, reason: reason.trim(), createdAt: now, sentMemberIds: [] };
  return { ok: true, data: { ...data, seq, offerRecommendations: [...data.offerRecommendations, rec] }, value: rec };
}

/** 관리자: 추천받은 크루원 중 고른 사람에게 같은 조건의 새 제안을 보낸다 (이미 받은 사람은 뺀다) */
export function sendFromRecommendation(data: AppData, actorId: ID, recommendationId: ID, memberIds: ID[], now: Instant): CommandResult<Offer> {
  const admin = getUser(data, actorId);
  const recm = data.offerRecommendations.find((r) => r.id === recommendationId);
  const offer = recm && offerOf(data, recm.offerId);
  if (!admin || admin.role !== 'admin' || !recm || !offer || !canAdminSee(data, admin, offer)) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.notAllowed } };
  const already = alreadyOffered(data, offer.id);
  const ids = [...new Set(memberIds)].filter((id) => recm.memberIds.includes(id) && !already.has(id));
  if (ids.length === 0) return { ok: false, errors: { members: OFFER_ERR.membersRequired } };
  const input: OfferInput = {
    brand: offer.brand,
    product: offer.product,
    category: offer.category,
    description: offer.description,
    format: offer.format,
    price: String(offer.price),
    uploadOn: offer.uploadOn,
    note: offer.note,
    internalMemo: offer.internalMemo,
    recipientType: 'member',
    recipientIds: ids,
  };
  const r = sendOffer(data, actorId, input, now, offer.id);
  if (!r.ok) return r;
  const nextRec = { ...recm, sentMemberIds: [...recm.sentMemberIds, ...ids] };
  return { ok: true, data: { ...r.data, offerRecommendations: r.data.offerRecommendations.map((x) => (x.id === recm.id ? nextRec : x)) }, value: r.value };
}

/** 원래 제안(크루장용)에서 이어서 보낸 제안을 이미 받은 크루원 */
export function alreadyOffered(data: AppData, sourceOfferId: ID): Set<ID> {
  const ids = data.offers.filter((o) => o.sourceOfferId === sourceOfferId).map((o) => o.id);
  return new Set(data.offerRecipients.filter((r) => ids.includes(r.offerId)).map((r) => r.userId));
}

export function archiveRecommendation(data: AppData, actorId: ID, recommendationId: ID, now: Instant): CommandResult<OfferRecommendation> {
  const admin = getUser(data, actorId);
  const recm = data.offerRecommendations.find((r) => r.id === recommendationId);
  const offer = recm && offerOf(data, recm.offerId);
  if (!admin || admin.role !== 'admin' || !recm || !offer || !canAdminSee(data, admin, offer)) return { ok: false, errors: { [FORM_ERROR]: OFFER_ERR.notAllowed } };
  const next = { ...recm, archivedAt: now };
  return { ok: true, data: { ...data, offerRecommendations: data.offerRecommendations.map((x) => (x.id === recm.id ? next : x)) }, value: next };
}

/** 받는 사람이 보는 받은 제안 목록 (최근순) */
export function offersReceivedBy(data: AppData, user: User): { offer: Offer; recipient: OfferRecipient }[] {
  return data.offerRecipients
    .filter((r) => r.userId === user.id)
    .map((recipient) => ({ offer: offerOf(data, recipient.offerId)!, recipient }))
    .filter((x) => !!x.offer)
    .sort((a, b) => b.offer.createdAt.localeCompare(a.offer.createdAt));
}

/** 관리자 목록 (최근순) */
export function offersForAdmin(data: AppData, admin: User): Offer[] {
  return data.offers.filter((o) => canAdminSee(data, admin, o)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function parseOfferPrice(raw: string) {
  return parsePrice(raw);
}
