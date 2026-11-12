/**
 * 알림함 (v0.6 4.5단계, 사용자 결정). 앱 안에서만 보는 알림이며 외부로 보내지 않는다.
 * 알림은 저장하지 않고 기존 기록에서 계산한다. 저장하는 것은 사용자별 '마지막으로 연 시각'뿐이다.
 *   크루원: 새 미션 배정, 피드백 도착, 공지 등록, 성과 기록 요청(5단계)
 *   크루장: 새 제출, 수정본 제출, 질문 등록
 *   관리자: 검토 대기 쌓임(담당 크루, 2일 넘게 기다린 제출), 제안 상태 변경
 * 자기가 한 일은 알리지 않는다.
 */
import { aggregateStatuses } from './aggregate';
import { DUE_SOON_MS } from './nudge';
import { adminNoticesForCrew } from './adminNotices';
import { isStale, NO_RESPONSE_DAYS, staleSince } from './offers';
import { consentOf } from './showcase';
import { getCrew, getDeliverable, getMission, getUser, statusOf } from './queries';
import { PROPOSAL_STATUS_LABEL, type AppData, type Instant, type User } from './types';
import { STATUS_LABEL } from './status';

export const STALE_REVIEW_MS = 2 * 24 * 60 * 60 * 1000;

export type InboxTarget =
  | { screen: 'mission'; missionId: string; feedbackId?: string }
  | { screen: 'record'; missionId: string }
  | { screen: 'review'; missionId: string; memberId?: string }
  | { screen: 'community'; crewId: string; postId: string }
  | { screen: 'qna'; crewId: string; postId: string }
  | { screen: 'crew'; crewId: string }
  | { screen: 'notice'; crewId: string; postId?: string; adminNoticeId?: string }
  | { screen: 'overview'; crewId?: string; memberId?: string; tab?: 'proposals' }
  | { screen: 'overview'; view: 'offers'; offerId: string }
  | { screen: 'my-proposals'; offerId: string };

export interface InboxItem {
  id: string;
  kind: 'mission' | 'feedback' | 'notice' | 'admin-notice' | 'showcase-consent' | 'showcase-result' | 'record-request' | 'due-soon' | 'nudge' | 'answer' | 'offer' | 'offer-remind' | 'offer-cancel' | 'offer-update' | 'offer-response' | 'offer-stale' | 'offer-recommend' | 'submission' | 'resubmission' | 'question' | 'stale' | 'proposal';
  label: string;
  text: string;
  at: Instant;
  target: InboxTarget;
}

export const INBOX_KIND_LABEL: Record<InboxItem['kind'], string> = {
  mission: '새 미션',
  feedback: '피드백',
  notice: '크루장 공지',
  'admin-notice': '운영 공지',
  'showcase-consent': '사례 공개 동의 요청',
  'showcase-result': '사례 공개 동의 결과',
  'record-request': '성과 기록 요청',
  'due-soon': '마감 임박',
  nudge: '제출 재촉',
  answer: 'Q&A게시판 답변',
  offer: '새 제안',
  'offer-remind': '제안 다시 알림',
  'offer-cancel': '제안 취소',
  'offer-update': '제안 조건 변경',
  'offer-response': '제안 응답',
  'offer-stale': '제안 응답 없음',
  'offer-recommend': '크루원 추천',
  submission: '새 제출',
  resubmission: '수정본',
  question: '질문',
  stale: '검토 지연',
  proposal: '제안 상태',
};

export function inboxFor(data: AppData, user: User, now: Instant = new Date().toISOString()): InboxItem[] {
  const items: InboxItem[] = [];
  const push = (i: Omit<InboxItem, 'label'>) => items.push({ ...i, label: INBOX_KIND_LABEL[i.kind] });

  if (user.role === 'member') {
    for (const m of data.missions) {
      if (!m.targetIds.includes(user.id) || m.createdBy === user.id) continue;
      push({ id: `mission-${m.id}`, kind: 'mission', text: `새 미션 ‘${m.title}’이 배정됐어요.`, at: m.createdAt, target: { screen: 'mission', missionId: m.id } });
    }
    for (const f of data.feedbacks) {
      const d = getDeliverable(data, f.deliverableId);
      const m = d && getMission(data, d.missionId);
      if (!d || !m || d.memberId !== user.id) continue;
      const v = data.versions.find((x) => x.id === f.versionId);
      push({
        id: `feedback-${f.id}`,
        kind: 'feedback',
        text: `‘${m.title}’ ${v?.number ?? ''}차 제출에 피드백이 도착했어요 (${STATUS_LABEL[f.result]}).`,
        at: f.createdAt,
        target: { screen: 'mission', missionId: m.id, feedbackId: f.id },
      });
    }
  }

  if (user.role === 'member') {
    // 6-A: 마감 24시간 전부터 아직 제출하지 않은 미션 (자동, 계산)
    for (const m of data.missions) {
      if (!m.targetIds.includes(user.id) || statusOf(data, m.id, user.id) !== 'not_submitted') continue;
      const start = new Date(new Date(m.dueAt).getTime() - DUE_SOON_MS).toISOString();
      if (now < start || now >= m.dueAt) continue;
      push({ id: `due-${m.id}`, kind: 'due-soon', text: `‘${m.title}’ 마감이 24시간도 남지 않았어요. 아직 제출 전이에요.`, at: start, target: { screen: 'mission', missionId: m.id } });
    }
    // 6-A: 크루장의 재촉 알림
    for (const n of data.nudges) {
      if (!n.memberIds.includes(user.id)) continue;
      const m = getMission(data, n.missionId);
      if (!m) continue;
      push({ id: `nudge-${n.id}`, kind: 'nudge', text: `${getUser(data, n.sentBy)?.name} 크루장이 ‘${m.title}’ 제출을 기다리고 있어요.`, at: n.createdAt, target: { screen: 'mission', missionId: m.id } });
    }
    // 6-A: 내 QnA 질문에 크루장 답변
    const leaderId = data.crews.find((c) => c.id === user.crewId)?.leaderId;
    for (const c of data.comments) {
      if (c.deletedAt || c.authorId !== leaderId) continue;
      const p = data.communityPosts.find((x) => x.id === c.postId);
      if (!p || p.kind !== 'question' || p.authorId !== user.id || p.deletedAt) continue;
      push({ id: `answer-${c.id}`, kind: 'answer', text: `내 질문 ‘${p.title}’에 크루장 답변이 달렸어요.`, at: c.createdAt, target: { screen: 'qna', crewId: p.crewId, postId: p.id } });
    }
    // 5단계: 크루장의 성과 기록 요청
    for (const r of data.recordRequests) {
      if (r.memberId !== user.id) continue;
      const d = getDeliverable(data, r.deliverableId);
      const m = d && getMission(data, d.missionId);
      if (!m) continue;
      push({
        id: `record-request-${r.id}`,
        kind: 'record-request',
        text: `${getUser(data, r.requestedBy)?.name} 크루장이 ‘${m.title}’ 게시물의 성과 기록을 요청했어요.`,
        at: r.createdAt,
        target: { screen: 'record', missionId: m.id },
      });
    }
  }

  // 6-B: 받은 광고 제안 (크루원·크루장)
  if (user.role === 'member' || user.role === 'leader') {
    for (const r of data.offerRecipients) {
      if (r.userId !== user.id) continue;
      const o = data.offers.find((x) => x.id === r.offerId);
      if (!o) continue;
      const name = `${o.brand} · ${o.product}`;
      const target = { screen: 'my-proposals' as const, offerId: o.id };
      push({ id: `offer-${r.id}`, kind: 'offer', text: `새 광고 제안이 도착했어요: ‘${name}’`, at: o.createdAt, target });
      r.reminders.forEach((at, i) => push({ id: `offer-remind-${r.id}-${i}`, kind: 'offer-remind', text: `‘${name}’ 제안에 아직 응답하지 않았어요.`, at, target }));
      if (o.updatedAt) push({ id: `offer-update-${r.id}-${o.updatedAt}`, kind: 'offer-update', text: `‘${name}’ 제안의 조건이 바뀌었어요.`, at: o.updatedAt, target });
      if (o.cancelledAt) push({ id: `offer-cancel-${r.id}`, kind: 'offer-cancel', text: `‘${name}’ 제안이 취소됐어요.`, at: o.cancelledAt, target });
    }
  }

  if (user.role === 'member' || user.role === 'leader') {
    for (const p of data.communityPosts) {
      if (p.crewId !== user.crewId || p.authorId === user.id || p.deletedAt) continue;
      if (user.role === 'member' && p.kind === 'notice') {
        push({ id: `post-${p.id}`, kind: 'notice', text: `새 크루장 공지 ‘${p.title}’이 올라왔어요.`, at: p.createdAt, target: { screen: 'notice', crewId: p.crewId, postId: p.id } });
      }
      if (user.role === 'leader' && p.kind === 'question') {
        push({
          id: `post-${p.id}`,
          kind: 'question',
          text: `${getUser(data, p.authorId)?.name}님이 질문 ‘${p.title}’을 올렸어요.`,
          at: p.createdAt,
          target: { screen: 'qna', crewId: p.crewId, postId: p.id },
        });
      }
    }
  }

  if (user.role === 'leader') {
    for (const v of data.versions) {
      const d = getDeliverable(data, v.deliverableId);
      const m = d && getMission(data, d.missionId);
      if (!d || !m || m.crewId !== user.crewId) continue;
      const name = getUser(data, d.memberId)?.name;
      push({
        id: `version-${v.id}`,
        kind: v.number > 1 ? 'resubmission' : 'submission',
        text: v.number > 1 ? `${name}님이 ‘${m.title}’ ${v.number}차 수정본을 제출했어요.` : `${name}님이 ‘${m.title}’을 제출했어요.`,
        at: v.submittedAt,
        target: { screen: 'review', missionId: m.id, memberId: d.memberId },
      });
    }
  }

  // 6-C: 관리자 공지 (그 크루 구성원)
  if (user.role === 'member' || user.role === 'leader') {
    for (const n of adminNoticesForCrew(data, user.crewId)) {
      push({ id: `admin-notice-${n.id}`, kind: 'admin-notice', text: `운영 공지 ‘${n.title}’이 올라왔어요.`, at: n.createdAt, target: { screen: 'notice', crewId: user.crewId!, adminNoticeId: n.id } });
    }
  }

  // 6-C: 우수 사례 공개 동의 요청 (크리에이터) · 동의 결과 (지정한 사람)
  for (const s of data.showcases) {
    const d = getDeliverable(data, s.deliverableId);
    const m = d && getMission(data, d.missionId);
    if (!d || !m) continue;
    const consent = consentOf(s);
    if (user.role === 'member' && d.memberId === user.id && consent === 'pending') {
      push({
        id: `showcase-consent-${s.id}`,
        kind: 'showcase-consent',
        text: `${getUser(data, s.authorId)?.name}님이 ‘${m.title}’을 우수 사례로 소개하려고 해요. 공개 여부를 정해 주세요.`,
        at: s.createdAt,
        target: { screen: 'mission', missionId: m.id },
      });
    }
    if (s.authorId === user.id && s.consentAt && consent !== 'pending') {
      const who = getUser(data, d.memberId)?.name;
      const text =
        consent === 'agreed'
          ? `${who}님이 ‘${m.title}’ 우수 사례 공개에 동의했어요.`
          : consent === 'declined'
            ? `${who}님이 ‘${m.title}’을 우수 사례로 공개하지 않기로 했어요.`
            : `${who}님이 ‘${m.title}’ 우수 사례 공개 동의를 철회했어요.`;
      push({
        id: `showcase-result-${s.id}-${consent}`,
        kind: 'showcase-result',
        text,
        at: s.consentAt,
        target: user.role === 'admin' ? { screen: 'overview', crewId: m.crewId, memberId: d.memberId } : { screen: 'mission', missionId: m.id },
      });
    }
  }

  if (user.role === 'admin') {
    // 6-B: 제안 응답·무응답·추천 (담당 크루 범위)
    for (const o of data.offers) {
      const recs = data.offerRecipients.filter((r) => r.offerId === o.id);
      const visible = recs.every((r) => {
        const u = getUser(data, r.userId);
        return !!u?.crewId && user.managedCrewIds.includes(u.crewId);
      });
      if (!visible) continue;
      const name = `${o.brand} · ${o.product}`;
      const target = { screen: 'overview' as const, view: 'offers' as const, offerId: o.id };
      for (const r of recs) {
        const who = getUser(data, r.userId)?.name;
        if (r.respondedAt && r.respondedBy !== user.id) {
          const proxy = r.proxyMemberIds?.length ? ` (진행: ${r.proxyMemberIds.map((id) => getUser(data, id)?.name).join(', ')})` : '';
          push({ id: `offer-resp-${r.id}`, kind: 'offer-response', text: `${who}님이 ‘${name}’ 제안을 ${r.response === 'accepted' ? '수락' : '거절'}했어요${proxy}.`, at: r.respondedAt, target });
        }
        if (isStale(r, o, now)) {
          push({ id: `offer-stale-${r.id}-${r.reminders.length}`, kind: 'offer-stale', text: `${who}님이 ‘${name}’ 제안에 ${NO_RESPONSE_DAYS}일간 답이 없었어요. 다시 알릴까요?`, at: staleSince(r, o), target });
        }
      }
      for (const rc of data.offerRecommendations) {
        if (rc.offerId !== o.id) continue;
        push({
          id: `offer-rec-${rc.id}`,
          kind: 'offer-recommend',
          text: `${getUser(data, rc.leaderId)?.name} 크루장이 ‘${name}’에 ${rc.memberIds.map((id) => getUser(data, id)?.name).join(', ')}님을 추천했어요.`,
          at: rc.createdAt,
          target,
        });
      }
    }
    // 검토 대기 쌓임: 크루별로 2일 넘게 기다린 최신 제출이 있으면 하나
    for (const crewId of user.managedCrewIds) {
      const stale = data.deliverables
        .filter((d) => d.status === 'pending_review' && getMission(data, d.missionId)?.crewId === crewId)
        .map((d) => data.versions.find((v) => v.id === d.latestVersionId)!)
        .filter((v) => v && new Date(now).getTime() - new Date(v.submittedAt).getTime() > STALE_REVIEW_MS)
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
      if (stale.length === 0) continue;
      const pending = aggregateStatuses(data, { crewIds: [crewId] }).counts.pending_review;
      const since = new Date(new Date(stale[0].submittedAt).getTime() + STALE_REVIEW_MS).toISOString();
      push({
        id: `stale-${crewId}-${stale[0].id}`,
        kind: 'stale',
        text: `${getCrew(data, crewId)?.name} 크루에 2일 넘게 기다린 제출이 있어요 (검토 대기 ${pending}건).`,
        at: since,
        target: { screen: 'overview', crewId },
      });
    }
    for (const p of data.proposals) {
      const creator = getUser(data, p.creatorId);
      if (!creator?.crewId || !user.managedCrewIds.includes(creator.crewId)) continue;
      p.history.forEach((h, i) => {
        if (h.from === null || h.by === user.id) return;
        push({
          id: `proposal-${p.id}-${i}`,
          kind: 'proposal',
          text: `${creator.name}님 ‘${p.brand}’ 제안이 ${PROPOSAL_STATUS_LABEL[h.from]} → ${PROPOSAL_STATUS_LABEL[h.to]}로 바뀌었어요.`,
          at: h.at,
          target: { screen: 'overview', crewId: creator.crewId!, memberId: creator.id, tab: 'proposals' },
        });
      });
    }
  }

  return items.filter((i) => i.at <= now).sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

/** 마지막으로 연 시각보다 뒤의 알림 수 */
export function unreadCount(data: AppData, user: User, now?: Instant): number {
  const mark = data.readMarks[user.id];
  return inboxFor(data, user, now).filter((i) => !mark || i.at > mark).length;
}

export function markInboxRead(data: AppData, userId: string, now: Instant): AppData {
  return { ...data, readMarks: { ...data.readMarks, [userId]: now } };
}
