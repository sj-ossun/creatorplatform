/**
 * 크루방과 로그인 홈 '내 현황' (6-C, 사용자 결정·테스터 피드백 2·9번).
 * 홈은 요약 숫자만, 크루방은 카드 단위로 미션·공지·최근 게시물·Q&A를 모아 보여준다.
 * 모두 업무 기록에서 계산하고 따로 저장하지 않는다.
 */
import { adminNoticesForCrew } from './adminNotices';
import { aggregateStatuses, type StatusCounts } from './aggregate';
import { isAnswered, postsOfBoard, postsOfCrew } from './community';
import { unreadCount } from './inbox';
import { DUE_SOON_MS } from './nudge';
import { offersForAdmin, offersReceivedBy } from './offers';
import { opsAlerts } from './ops';
import { crewMembers, missionsAssignedTo, missionsOfCrew, statusOf } from './queries';
import { crewProfile } from './crewProfile';
import { publishedShowcaseCount } from './showcase';
import { todayKst } from './time';
import type { AppData, CommunityPost, Crew, ID, Instant, Mission, User } from './types';
import { memberTodo } from './views';

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** 이번 주 할 일: 미제출·보완 요청 중 마감이 7일 안이거나 이미 지난 것 */
export function thisWeekTodo(data: AppData, user: User, now: Instant): { mission: Mission; status: ReturnType<typeof statusOf> }[] {
  const limit = new Date(new Date(now).getTime() + WEEK_MS).toISOString();
  return memberTodo(data, user).filter((x) => x.status === 'revision_requested' || x.mission.dueAt <= limit);
}

export interface MemberProgress {
  assigned: number;
  completed: number;
  remaining: number;
  /** 0~100 정수. 배정이 없으면 null */
  rate: number | null;
}

/** 내 미션 달성률: 배정 미션 중 완료 비율 (5단계 '내 성과' 완료율과 같은 계산) */
export function memberProgress(data: AppData, user: User): MemberProgress {
  const missions = missionsAssignedTo(data, user.id);
  const completed = missions.filter((m) => statusOf(data, m.id, user.id) === 'completed').length;
  return {
    assigned: missions.length,
    completed,
    remaining: missions.length - completed,
    rate: missions.length ? Math.round((completed / missions.length) * 100) : null,
  };
}

/** 응답을 기다리는 받은 제안 (취소된 제안 제외) */
export function pendingOfferCount(data: AppData, user: User): number {
  return offersReceivedBy(data, user).filter(({ offer, recipient }) => !offer.cancelledAt && !recipient.respondedAt).length;
}

/** 마감 24시간 안에 아직 첫 제출이 없는 크루원 수 (크루장 자기 크루) */
export function dueSoonUnsubmitted(data: AppData, crewId: ID | null, now: Instant): number {
  let n = 0;
  for (const m of missionsOfCrew(data, crewId)) {
    const start = new Date(new Date(m.dueAt).getTime() - DUE_SOON_MS).toISOString();
    if (now < start || now >= m.dueAt) continue;
    n += m.targetIds.filter((id) => statusOf(data, m.id, id) === 'not_submitted').length;
  }
  return n;
}

/** 크루장 답변을 기다리는 질문 */
export function unansweredQuestions(data: AppData, crewId: ID | null): CommunityPost[] {
  if (!crewId) return [];
  return postsOfCrew(data, crewId).filter((p) => p.kind === 'question' && !p.deletedAt && !isAnswered(data, p));
}

export type StatusCardKey = 'rate' | 'week' | 'offers' | 'inbox' | 'review' | 'due-soon' | 'questions' | 'stale-offers' | 'delayed' | 'recommend';

export interface StatusCard {
  key: StatusCardKey;
  label: string;
  value: number | null;
  unit: string;
  hint: string;
}

/** 로그인 홈 '내 현황' 카드 (역할별 4개 또는 3개) */
export function homeStatus(data: AppData, user: User, now: Instant): StatusCard[] {
  if (user.role === 'member') {
    const p = memberProgress(data, user);
    return [
      { key: 'rate', label: '내 미션 달성률', value: p.rate, unit: '%', hint: p.assigned ? `배정 ${p.assigned}개 중 완료 ${p.completed}개` : '아직 배정된 미션이 없어요' },
      { key: 'week', label: '이번 주 할 일', value: thisWeekTodo(data, user, now).length, unit: '건', hint: '마감 7일 안 · 보완 요청 포함' },
      { key: 'offers', label: '응답 대기 제안', value: pendingOfferCount(data, user), unit: '건', hint: '수락이나 거절을 기다려요' },
      { key: 'inbox', label: '새 알림', value: unreadCount(data, user, now), unit: '건', hint: '알림함에서 확인해요' },
    ];
  }
  if (user.role === 'leader') {
    const pending = aggregateStatuses(data, { crewIds: user.crewId ? [user.crewId] : [] }).counts.pending_review;
    return [
      { key: 'review', label: '검토 대기', value: pending, unit: '건', hint: '퀵 리뷰에서 처리해요' },
      { key: 'due-soon', label: '마감 임박 미제출', value: dueSoonUnsubmitted(data, user.crewId, now), unit: '명', hint: '마감 24시간 안' },
      { key: 'offers', label: '응답 대기 제안', value: pendingOfferCount(data, user), unit: '건', hint: '받은 제안' },
      { key: 'questions', label: '새 질문', value: unansweredQuestions(data, user.crewId).length, unit: '건', hint: '답변을 기다리는 Q&A' },
    ];
  }
  const alerts = opsAlerts(data, user, { crewIds: user.managedCrewIds }, now);
  const visible = new Set(offersForAdmin(data, user).map((o) => o.id));
  const recs = data.offerRecommendations.filter((r) => visible.has(r.offerId) && !r.archivedAt && r.sentMemberIds.length < r.memberIds.length).length;
  return [
    { key: 'stale-offers', label: '응답 없는 제안', value: alerts.staleOffers, unit: '건', hint: '2일 넘게 응답 없음' },
    { key: 'delayed', label: '검토 지연 크루', value: alerts.delayed.crewIds.length, unit: '곳', hint: '2일 넘게 검토 대기' },
    { key: 'recommend', label: '추천 도착', value: recs, unit: '건', hint: '크루장이 추천한 크루원' },
  ];
}

export interface RoomNotice {
  id: string;
  source: 'crew' | 'admin';
  title: string;
  body?: string;
  at: Instant;
  postId?: ID;
}

/** 크루방 공지 카드: 크루장 공지와 운영(관리자) 공지를 최신순으로 */
export function roomNotices(data: AppData, crewId: ID, limit = 3): RoomNotice[] {
  const crew: RoomNotice[] = postsOfCrew(data, crewId)
    .filter((p) => p.kind === 'notice' && !p.deletedAt)
    .map((p) => ({ id: p.id, source: 'crew', title: p.title, at: p.createdAt, postId: p.id }));
  const admin: RoomNotice[] = adminNoticesForCrew(data, crewId).map((n) => ({ id: n.id, source: 'admin', title: n.title, body: n.body, at: n.createdAt }));
  return [...crew, ...admin].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export interface RoomSummary {
  members: number;
  activeMissions: number;
  dueThisWeek: number;
  /** 크루 전체 미션 배정 상태 (단위: 건) */
  counts: StatusCounts;
}

export function roomSummary(data: AppData, crewId: ID, now: Instant): RoomSummary {
  const missions = missionsOfCrew(data, crewId);
  const limit = new Date(new Date(now).getTime() + WEEK_MS).toISOString();
  return {
    members: crewMembers(data, crewId).length,
    activeMissions: missions.filter((m) => m.dueAt >= now).length,
    dueThisWeek: missions.filter((m) => m.dueAt >= now && m.dueAt <= limit).length,
    counts: aggregateStatuses(data, { crewIds: [crewId] }),
  };
}

/** 최근 게시물 (자유게시판 글, 공지 제외) */
export function recentPosts(data: AppData, user: User, crewId: ID, limit = 3): CommunityPost[] {
  return postsOfBoard(data, user, crewId, 'community')
    .filter((p) => p.kind === 'post' && !p.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/** Q&A 카드: 크루원은 내 질문, 크루장은 답변을 기다리는 질문 */
export function roomQuestions(data: AppData, user: User, crewId: ID, limit = 3): { post: CommunityPost; answered: boolean }[] {
  const posts =
    user.role === 'leader'
      ? unansweredQuestions(data, crewId)
      : postsOfCrew(data, crewId).filter((p) => p.kind === 'question' && p.authorId === user.id && !p.deletedAt);
  return posts
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((post) => ({ post, answered: isAnswered(data, post) }));
}

export interface CrewBrowseItem {
  crew: Crew;
  category: string | null;
  intro: string | null;
  keywords: string[];
  members: number;
  /** 이번 달(한국 시간) 등록한 미션 수 */
  monthMissions: number;
  /** 공개 중인 우수 사례 수 */
  showcases: number;
}

/**
 * 공개 홈 '크루 둘러보기' (6-C, 사용자 결정): 가입 버튼 없는 소개만. 크루장 이름·크루원 개인 정보는 넣지 않는다.
 * 소개·키워드는 관리자만 고치고, 숫자는 실제 기록에서 계산한다 (크루원 수 공개는 사용자 결정).
 */
export function crewBrowse(data: AppData, now: Instant): CrewBrowseItem[] {
  const month = todayKst(now).slice(0, 7);
  return data.crews.map((crew) => {
    const profile = crewProfile(crew);
    return {
      crew,
      ...profile,
      members: crewMembers(data, crew.id).length,
      monthMissions: missionsOfCrew(data, crew.id).filter((m) => todayKst(m.createdAt).slice(0, 7) === month).length,
      showcases: publishedShowcaseCount(data, crew.id),
    };
  });
}
