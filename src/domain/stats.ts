/**
 * 5단계 성과 계산 (사용자 결정). 모든 숫자는 기존 업무 기록에서 계산하고 따로 저장하지 않는다.
 * - 완료율: 배정된 대상자-미션 조합 중 최신 상태가 완료인 비율
 * - 기한 내 제출률: 제출한 조합 중 1차 제출이 마감 전에 들어온 비율 ('기한 후 제출' 표시와 같은 기준)
 * - 조회수: 게시물별 최신 확인값(직접 입력). 미입력은 0 이 아니라 null
 * - 기록 요청 필요: 게시 후 7일이 넘었는데 성과 기록(관찰)이 하나도 없는 게시물
 * - 주차: 한국 시간 월~일
 */
import { aggregateStatuses } from './aggregate';
import { metricOf, observationsOf } from './performance';
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

/**
 * 6-C 후속 (사용자 확정 견본): 크루장 대시보드의 '조회수 합계 추이'를 대신한다.
 * 합계는 게시물 수와 한 편의 큰 숫자에 좌우돼 크루장이 할 일을 알려주지 못하므로,
 * 미션별로 게시물당 조회수 중앙값과 가장 높은 게시물을 본다. 조회수는 크리에이터 직접 입력이다.
 */
export const MIN_POSTS_TO_COMPARE = 2;

export interface MissionPerformanceRow {
  mission: Mission;
  targets: number;
  posted: number;
  /** 조회수가 입력된 게시물이 MIN_POSTS_TO_COMPARE 편보다 적으면 null */
  medianViews: number | null;
  best: { memberId: ID; views: number; checkedOn: string } | null;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function missionPerformance(data: AppData, crewId: ID): MissionPerformanceRow[] {
  return data.missions
    .filter((m) => m.crewId === crewId)
    .sort((a, b) => b.dueAt.localeCompare(a.dueAt) || a.id.localeCompare(b.id))
    .map((mission) => {
      const counted: { memberId: ID; views: number; checkedOn: string }[] = [];
      let posted = 0;
      for (const d of data.deliverables.filter((x) => x.missionId === mission.id)) {
        const metric = metricOf(data, d.id);
        if (metric.kind === 'unposted') continue;
        posted++;
        if (metric.kind === 'views') counted.push({ memberId: d.memberId, views: metric.latest.views!, checkedOn: metric.latest.checkedOn });
      }
      const enough = counted.length >= MIN_POSTS_TO_COMPARE;
      const best = enough ? counted.reduce((a, b) => (b.views > a.views ? b : a)) : null;
      return { mission, targets: mission.targetIds.length, posted, medianViews: enough ? median(counted.map((c) => c.views)) : null, best };
    });
}

export interface FeedbackEffect {
  missions: number;
  /** 미션 배정 건 (대상자-미션 조합) */
  assignments: number;
  /** 1차 제출이 검토된 건 중 바로 완료된 건 */
  firstPass: { done: number; reviewed: number };
  /** 보완 요청을 받은 건 중 다시 제출한 건 */
  resubmitted: { done: number; requested: number };
  /** 보완 요청부터 다시 제출까지 걸린 날 (중앙값, 소수 첫째 자리). 없으면 null */
  medianDays: number | null;
}

/** 피드백 효과: 최근 마감 미션 n개의 제출·피드백 기록에서 계산 (직접 입력값을 쓰지 않는다) */
export function feedbackEffect(data: AppData, crewId: ID, recent = 3): FeedbackEffect {
  const missions = data.missions
    .filter((m) => m.crewId === crewId)
    .sort((a, b) => b.dueAt.localeCompare(a.dueAt))
    .slice(0, recent);
  const firstPass = { done: 0, reviewed: 0 };
  const resubmitted = { done: 0, requested: 0 };
  const days: number[] = [];
  for (const m of missions) {
    for (const d of data.deliverables.filter((x) => x.missionId === m.id)) {
      const versions = data.versions.filter((v) => v.deliverableId === d.id).sort((a, b) => a.number - b.number);
      const feedbacks = data.feedbacks.filter((f) => f.deliverableId === d.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const first = versions[0];
      const firstReview = first && feedbacks.find((f) => f.versionId === first.id);
      if (firstReview) {
        firstPass.reviewed++;
        if (firstReview.result === 'completed') firstPass.done++;
      }
      const revision = feedbacks.find((f) => f.result === 'revision_requested');
      if (revision) {
        resubmitted.requested++;
        const next = versions.find((v) => v.submittedAt > revision.createdAt);
        if (next) {
          resubmitted.done++;
          days.push((new Date(next.submittedAt).getTime() - new Date(revision.createdAt).getTime()) / 86_400_000);
        }
      }
    }
  }
  const md = days.length ? [...days].sort((a, b) => a - b) : [];
  const mid = Math.floor(md.length / 2);
  const medianDays = md.length ? Math.round((md.length % 2 ? md[mid] : (md[mid - 1] + md[mid]) / 2) * 10) / 10 : null;
  return {
    missions: missions.length,
    assignments: missions.reduce((n, m) => n + m.targetIds.length, 0),
    firstPass,
    resubmitted,
    medianDays,
  };
}
