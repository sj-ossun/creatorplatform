/**
 * 알림함 (v0.6 4.5단계, 사용자 결정). 앱 안에서만 보는 알림이며 외부로 보내지 않는다.
 * 알림은 저장하지 않고 기존 기록에서 계산한다. 저장하는 것은 사용자별 '마지막으로 연 시각'뿐이다.
 *   크루원: 새 미션 배정, 피드백 도착, 공지 등록
 *   크루장: 새 제출, 수정본 제출, 질문 등록
 *   관리자: 검토 대기 쌓임(담당 크루, 2일 넘게 기다린 제출), 제안 상태 변경
 * 자기가 한 일은 알리지 않는다.
 */
import { aggregateStatuses } from './aggregate';
import { getCrew, getDeliverable, getMission, getUser } from './queries';
import { PROPOSAL_STATUS_LABEL, type AppData, type Instant, type User } from './types';
import { STATUS_LABEL } from './status';

export const STALE_REVIEW_MS = 2 * 24 * 60 * 60 * 1000;

export type InboxTarget =
  | { screen: 'mission'; missionId: string; feedbackId?: string }
  | { screen: 'review'; missionId: string; memberId?: string }
  | { screen: 'community'; crewId: string; postId: string }
  | { screen: 'overview'; crewId?: string; memberId?: string; tab?: 'proposals' };

export interface InboxItem {
  id: string;
  kind: 'mission' | 'feedback' | 'notice' | 'submission' | 'resubmission' | 'question' | 'stale' | 'proposal';
  label: string;
  text: string;
  at: Instant;
  target: InboxTarget;
}

export const INBOX_KIND_LABEL: Record<InboxItem['kind'], string> = {
  mission: '새 미션',
  feedback: '피드백',
  notice: '공지',
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

  if (user.role === 'member' || user.role === 'leader') {
    for (const p of data.communityPosts) {
      if (p.crewId !== user.crewId || p.authorId === user.id) continue;
      if (user.role === 'member' && p.kind === 'notice') {
        push({ id: `post-${p.id}`, kind: 'notice', text: `새 공지 ‘${p.title}’이 올라왔어요.`, at: p.createdAt, target: { screen: 'community', crewId: p.crewId, postId: p.id } });
      }
      if (user.role === 'leader' && p.kind === 'question') {
        push({
          id: `post-${p.id}`,
          kind: 'question',
          text: `${getUser(data, p.authorId)?.name}님이 질문 ‘${p.title}’을 올렸어요.`,
          at: p.createdAt,
          target: { screen: 'community', crewId: p.crewId, postId: p.id },
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

  if (user.role === 'admin') {
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
