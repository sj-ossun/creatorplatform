/**
 * 5단계 성과 계산 (사용자 결정). 모든 숫자는 기존 업무 기록에서 계산하고 따로 저장하지 않는다.
 * - 완료율: 배정된 대상자-미션 조합 중 최신 상태가 완료인 비율
 * - 기한 내 제출률: 제출한 조합 중 1차 제출이 마감 전에 들어온 비율 ('기한 후 제출' 표시와 같은 기준)
 * - 조회수: 게시물별 최신 확인값(직접 입력). 미입력은 0 이 아니라 null
 * - 기록 요청 필요: 게시 후 7일이 넘었는데 성과 기록(관찰)이 하나도 없는 게시물
 * - 주차: 한국 시간 월~일
 */
import { aggregateStatuses } from './aggregate';
import { observationsOf } from './performance';
import { deliverableOf, getMission, missionsAssignedTo, statusOf } from './queries';
import { SUBMISSION_STATUSES, type SubmissionStatus } from './status';
import { todayKst } from './time';
import type { AppData, Deliverable, ID, Instant, Mission, Observation, Post, User } from './types';

export const RECORD_DUE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS);
}

export interface PostRow {
  mission: Mission;
  deliverable: Deliverable;
  post: Post;
  latest: Observation | undefined;
  /** 최신 확인값 조회수. 미입력이면 null */
  views: number | null;
  needsRecord: boolean;
  /** 이 게시물에 대한 가장 최근 기록 요청 날짜 */
  requestedOn: string | null;
}

export interface MemberStats {
  assigned: number;
  completed: number;
  completionRate: number | null;
  submitted: number;
  onTime: number;
  onTimeRate: number | null;
  revisionRequests: number;
  posts: PostRow[];
  viewsTotal: number | null;
  lastCheckedOn: string | null;
  needsRecord: boolean;
}

export function needsRecord(post: Post, observations: Observation[], today: string): boolean {
  return observations.length === 0 && dayDiff(today, post.publishedOn) > RECORD_DUE_DAYS;
}

export function memberStats(data: AppData, member: User, now: Instant = new Date().toISOString()): MemberStats {
  const today = todayKst(now);
  const missions = missionsAssignedTo(data, member.id);
  let completed = 0;
  let submitted = 0;
  let onTime = 0;
  let revisionRequests = 0;
  const posts: PostRow[] = [];
  for (const m of missions) {
    if (statusOf(data, m.id, member.id) === 'completed') completed++;
    const d = deliverableOf(data, m.id, member.id);
    if (!d) continue;
    submitted++;
    const first = data.versions.filter((v) => v.deliverableId === d.id).sort((a, b) => a.number - b.number)[0];
    if (first && !first.late) onTime++;
    revisionRequests += data.feedbacks.filter((f) => f.deliverableId === d.id && f.result === 'revision_requested').length;
    const post = data.posts.find((p) => p.deliverableId === d.id);
    if (post) {
      const obs = observationsOf(data, post.id);
      const latest = obs[0];
      const latestViews = obs.find((o) => o.views !== null)?.views ?? null;
      const reqs = data.recordRequests.filter((r) => r.deliverableId === d.id).sort((a, b) => b.requestedOn.localeCompare(a.requestedOn));
      posts.push({ mission: m, deliverable: d, post, latest, views: latestViews, needsRecord: needsRecord(post, obs, today), requestedOn: reqs[0]?.requestedOn ?? null });
    }
  }
  const counted = posts.filter((p) => p.views !== null);
  const checkedDays = posts.map((p) => p.latest?.checkedOn).filter((x): x is string => !!x).sort();
  return {
    assigned: missions.length,
    completed,
    completionRate: missions.length ? completed / missions.length : null,
    submitted,
    onTime,
    onTimeRate: submitted ? onTime / submitted : null,
    revisionRequests,
    posts: posts.sort((a, b) => b.post.publishedOn.localeCompare(a.post.publishedOn)),
    viewsTotal: counted.length ? counted.reduce((s, p) => s + (p.views ?? 0), 0) : null,
    lastCheckedOn: checkedDays.at(-1) ?? null,
    needsRecord: posts.some((p) => p.needsRecord),
  };
}

/** 게시물 하나의 조회수 추이 (확인일 오름차순, 미입력 제외) */
export function viewsSeries(data: AppData, postId: ID): { day: string; views: number }[] {
  return observationsOf(data, postId)
    .filter((o) => o.views !== null)
    .map((o) => ({ day: o.checkedOn, views: o.views! }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/** 한국 시간 기준 그 날짜가 속한 주의 월요일 (YYYY-MM-DD) */
export function weekStart(day: string): string {
  const t = Date.parse(`${day}T00:00:00Z`);
  const dow = new Date(t).getUTCDay(); // 0=일
  const back = (dow + 6) % 7;
  return new Date(t - back * DAY_MS).toISOString().slice(0, 10);
}

export function weekLabel(monday: string): string {
  const [, m, d] = monday.split('-').map(Number);
  return `${m}/${d} 주`;
}

export interface WeekStatus {
  week: string;
  counts: Record<SubmissionStatus, number>;
  total: number;
}

/** 크루의 주차별 제출 상태: 그 주에 마감된 미션의 대상자-미션 조합 (최신 상태) */
export function weeklyStatus(data: AppData, crewIds: ID[]): WeekStatus[] {
  const byWeek = new Map<string, ID[]>();
  for (const m of data.missions) {
    if (!crewIds.includes(m.crewId)) continue;
    const w = weekStart(todayKst(m.dueAt));
    byWeek.set(w, [...(byWeek.get(w) ?? []), m.id]);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, missionIds]) => {
      const r = aggregateStatuses(data, { crewIds, missionIds });
      return { week, counts: r.counts, total: r.total };
    });
}

/** 크루 조회수 합계 추이: 확인 기록이 있는 각 주의 끝 시점까지 게시물별 최신 확인값의 합 */
export function weeklyViews(data: AppData, crewIds: ID[]): { week: string; views: number }[] {
  const posts = data.posts.filter((p) => {
    const d = data.deliverables.find((x) => x.id === p.deliverableId);
    const m = d && getMission(data, d.missionId);
    return !!m && crewIds.includes(m.crewId);
  });
  const obs = posts.flatMap((p) => observationsOf(data, p.id).filter((o) => o.views !== null).map((o) => ({ post: p.id, day: o.checkedOn, views: o.views! })));
  const weeks = [...new Set(obs.map((o) => weekStart(o.day)))].sort();
  return weeks.map((w) => {
    const end = new Date(Date.parse(`${w}T00:00:00Z`) + 6 * DAY_MS).toISOString().slice(0, 10);
    let sum = 0;
    for (const p of posts) {
      const last = obs.filter((o) => o.post === p.id && o.day <= end).sort((a, b) => b.day.localeCompare(a.day))[0];
      if (last) sum += last.views;
    }
    return { week: w, views: sum };
  });
}

/** 크루별 미션 완료율 (같은 기준, 이름순) */
export function crewCompletion(data: AppData, crewIds: ID[]): { crewId: ID; completed: number; total: number; rate: number | null }[] {
  return crewIds.map((crewId) => {
    const r = aggregateStatuses(data, { crewIds: [crewId] });
    return { crewId, completed: r.counts.completed, total: r.total, rate: r.total ? r.counts.completed / r.total : null };
  });
}

export { SUBMISSION_STATUSES };
