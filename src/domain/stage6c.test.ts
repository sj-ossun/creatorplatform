import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { createMemoryKv, createStorage, DATA_KEY, SCHEMA_VERSION } from '../storage/storage';
import { canOpen } from '../state/routes';
import { createAdminNotice, deleteAdminNotice, adminNoticesForCrew } from './adminNotices';
import { createCommunityPost, addComment, type CommunityPostInput } from './community';
import type { CommandResult } from './commands';
import { crewProfile, updateCrewProfile } from './crewProfile';
import { crewBrowse, homeStatus, memberProgress, roomNotices, roomQuestions, thisWeekTodo } from './crewRoom';
import { inboxFor } from './inbox';
import { getUser } from './queries';
import { answerShowcaseConsent, designateShowcase, removeShowcase, showcaseViews, withdrawShowcaseConsent } from './showcase';
import type { AppData } from './types';

const T0 = '2026-11-09T01:00:00.000Z';
const at = (min: number) => new Date(new Date(T0).getTime() + min * 60_000).toISOString();
function must<T>(r: CommandResult<T>) {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
}
const u = (d: AppData, id: string) => getUser(d, id)!;
const post = (kind: CommunityPostInput['kind'], title: string): CommunityPostInput => ({ kind, title, body: '본문', missionId: '' });

describe('6-C 우수 사례 두 단계 공개·동의', () => {
  it('성과 한 줄·학습 포인트 필수, 지정하면 동의 대기라 어디에도 공개되지 않는다', () => {
    let d = createSeed(T0);
    d = must(removeShowcase(d, 'user-jihun', 'deliverable-junho')).data;
    const bad = designateShowcase(d, 'user-jihun', 'deliverable-junho', '학습 포인트', at(1), '');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.headline).toBeTruthy();
    d = must(designateShowcase(d, 'user-jihun', 'deliverable-junho', '첫 3초 구성', at(1), '조회수 1천 회')).data;
    expect(showcaseViews(d)).toHaveLength(0);
    // 크리에이터 알림함에 동의 요청
    expect(inboxFor(d, u(d, 'user-junho'), at(2)).map((i) => i.kind)).toContain('showcase-consent');
  });

  it('크리에이터만 동의·거절하고, 동의하면 공개, 철회하면 바로 내려간다. 지정한 사람은 결과 알림을 받는다', () => {
    let d = createSeed(T0);
    d = must(removeShowcase(d, 'user-jihun', 'deliverable-junho')).data;
    d = must(designateShowcase(d, 'user-jihun', 'deliverable-junho', '첫 3초 구성', at(1), '조회수 1천 회')).data;
    expect(answerShowcaseConsent(d, 'user-jihun', 'deliverable-junho', true, at(2)).ok).toBe(false);
    d = must(answerShowcaseConsent(d, 'user-junho', 'deliverable-junho', true, at(2))).data;
    expect(showcaseViews(d)).toHaveLength(1);
    expect(answerShowcaseConsent(d, 'user-junho', 'deliverable-junho', false, at(3)).ok).toBe(false); // 이미 답함
    expect(inboxFor(d, u(d, 'user-jihun'), at(3)).map((i) => i.kind)).toContain('showcase-result');
    d = must(withdrawShowcaseConsent(d, 'user-junho', 'deliverable-junho', at(4))).data;
    expect(showcaseViews(d)).toHaveLength(0);
    expect(withdrawShowcaseConsent(d, 'user-junho', 'deliverable-junho', at(5)).ok).toBe(false);
  });

  it('거절하면 공개되지 않는다. 이전 저장값(동의 칸 없음)은 동의 대기로 본다', () => {
    let d = createSeed(T0);
    d = must(removeShowcase(d, 'user-jihun', 'deliverable-junho')).data;
    d = must(designateShowcase(d, 'user-jihun', 'deliverable-junho', '첫 3초 구성', at(1), '조회수 1천 회')).data;
    d = must(answerShowcaseConsent(d, 'user-junho', 'deliverable-junho', false, at(2))).data;
    expect(showcaseViews(d)).toHaveLength(0);
    const legacy = createSeed(T0);
    legacy.showcases = legacy.showcases.map(({ id, deliverableId, comment, authorId, createdAt }) => ({ id, deliverableId, comment, authorId, createdAt }));
    expect(showcaseViews(legacy)).toHaveLength(0);
  });

  it('우수 사례 페이지는 로그인한 모든 크루 구성원, 비로그인은 열지 못한다', () => {
    const d = createSeed(T0);
    expect(canOpen(d, null, { screen: 'showcases' })).toBe(false);
    for (const id of ['user-minji', 'user-sora', 'user-yujin', 'user-seoyeon']) expect(canOpen(d, u(d, id), { screen: 'showcases' })).toBe(true);
  });
});

describe('6-C 관리자 공지', () => {
  it('관리자만, 담당 크루를 골라 올린다. 그 크루 크루방·알림함에만 보이고 지우면 내려간다', () => {
    let d = createSeed(T0);
    expect(createAdminNotice(d, 'user-jihun', { title: 't', body: 'b', crewIds: ['crew-food'] }, at(1)).ok).toBe(false);
    const empty = createAdminNotice(d, 'user-seoyeon', { title: ' ', body: '', crewIds: [] }, at(1));
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(Object.keys(empty.errors).sort()).toEqual(['body', 'crewIds', 'title']);
    const r = must(createAdminNotice(d, 'user-seoyeon', { title: '푸드 안내', body: '이번 주 안내예요', crewIds: ['crew-food'] }, at(1)));
    d = r.data;
    expect(adminNoticesForCrew(d, 'crew-food').map((n) => n.title)).toContain('푸드 안내');
    expect(adminNoticesForCrew(d, 'crew-beauty').map((n) => n.title)).not.toContain('푸드 안내');
    expect(inboxFor(d, u(d, 'user-minji'), at(2)).some((i) => i.kind === 'admin-notice' && i.text.includes('푸드 안내'))).toBe(true);
    expect(inboxFor(d, u(d, 'user-jihun'), at(2)).some((i) => i.kind === 'admin-notice' && i.text.includes('푸드 안내'))).toBe(true);
    expect(inboxFor(d, u(d, 'user-sora'), at(2)).some((i) => i.text.includes('푸드 안내'))).toBe(false);
    d = must(deleteAdminNotice(d, 'user-seoyeon', r.value.id, at(3))).data;
    expect(adminNoticesForCrew(d, 'crew-food').map((n) => n.title)).not.toContain('푸드 안내');
  });

  it('크루방 공지 카드는 크루장 공지와 운영 공지를 최신순으로 합친다', () => {
    let d = createSeed(T0);
    d = must(createCommunityPost(d, 'user-jihun', post('notice', '크루 공지'), at(1))).data;
    d = must(createAdminNotice(d, 'user-seoyeon', { title: '운영 안내', body: '본문', crewIds: ['crew-food'] }, at(2))).data;
    const notices = roomNotices(d, 'crew-food');
    expect(notices.slice(0, 2).map((n) => [n.source, n.title])).toEqual([
      ['admin', '운영 안내'],
      ['crew', '크루 공지'],
    ]);
  });
});

describe('6-C 크루방·내 현황', () => {
  it('크루원 달성률은 배정 미션 중 완료 비율, 이번 주 할 일은 마감 7일 안 미제출·보완 요청', () => {
    const d = createSeed(T0);
    const junho = u(d, 'user-junho');
    const p = memberProgress(d, junho);
    expect(p.assigned).toBeGreaterThan(0);
    expect(p.rate).toBe(Math.round((p.completed / p.assigned) * 100));
    const minji = u(d, 'user-minji');
    expect(thisWeekTodo(d, minji, at(1)).every((x) => x.status === 'not_submitted' || x.status === 'revision_requested')).toBe(true);
  });

  it('홈 내 현황 카드: 역할별 항목', () => {
    const d = createSeed(T0);
    expect(homeStatus(d, u(d, 'user-minji'), at(1)).map((c) => c.label)).toEqual(['내 미션 달성률', '이번 주 할 일', '응답 대기 제안', '새 알림']);
    expect(homeStatus(d, u(d, 'user-jihun'), at(1)).map((c) => c.label)).toEqual(['검토 대기', '마감 임박 미제출', '응답 대기 제안', '새 질문']);
    expect(homeStatus(d, u(d, 'user-seoyeon'), at(1)).map((c) => c.label)).toEqual(['응답 없는 제안', '검토 지연 크루', '추천 도착']);
    // 시드 제안: 민지는 응답 대기 1건
    expect(homeStatus(d, u(d, 'user-minji'), at(1)).find((c) => c.key === 'offers')?.value).toBe(1);
  });

  it('Q&A 카드: 크루원은 내 질문(답변 여부), 크루장은 답변을 기다리는 질문', () => {
    let d = createSeed(T0);
    const q = must(createCommunityPost(d, 'user-minji', post('question', '내 질문'), at(1)));
    d = q.data;
    d = must(createCommunityPost(d, 'user-haneul', post('question', '하늘 질문'), at(2))).data;
    expect(roomQuestions(d, u(d, 'user-minji'), 'crew-food').map((x) => x.post.title)).toEqual(['내 질문']);
    expect(roomQuestions(d, u(d, 'user-jihun'), 'crew-food').map((x) => x.post.title)).toEqual(['하늘 질문', '내 질문']);
    d = must(addComment(d, 'user-jihun', q.value.id, '답변이에요', at(3))).data;
    expect(roomQuestions(d, u(d, 'user-minji'), 'crew-food')[0].answered).toBe(true);
    expect(roomQuestions(d, u(d, 'user-jihun'), 'crew-food').map((x) => x.post.title)).toEqual(['하늘 질문']);
  });
});

describe('6-C 크루 둘러보기', () => {
  it('크루마다 소개·키워드·크루원 수·이번 달 미션·공개 사례 수. 크루장 이름은 넣지 않는다', () => {
    const d = createSeed(T0);
    const items = crewBrowse(d, at(1));
    const food = items.find((i) => i.crew.id === 'crew-food')!;
    expect(food.members).toBe(3);
    expect(food.showcases).toBe(1);
    expect(food.keywords.length).toBeGreaterThan(0);
    expect(Object.keys(food)).not.toContain('leader');
  });

  it('소개·키워드는 담당 관리자만 고친다 (키워드 3개, 10자 이내)', () => {
    let d = createSeed(T0);
    expect(updateCrewProfile(d, 'user-jihun', 'crew-food', { intro: '새 소개', keywords: '' }).ok).toBe(false);
    const many = updateCrewProfile(d, 'user-seoyeon', 'crew-food', { intro: '새 소개', keywords: 'a,b,c,d' });
    expect(many.ok).toBe(false);
    d = must(updateCrewProfile(d, 'user-seoyeon', 'crew-food', { intro: '새 소개', keywords: '숏폼, 맛집, 숏폼' })).data;
    expect(crewProfile(d.crews.find((c) => c.id === 'crew-food')!)).toMatchObject({ intro: '새 소개', keywords: ['숏폼', '맛집'] });
  });
});

describe('저장 형식 v8', () => {
  it('v7 저장값은 관리자 공지 배열만 더해 그대로 읽는다', () => {
    expect(SCHEMA_VERSION).toBe(8);
    const kv = createMemoryKv();
    const v7 = createSeed(T0) as Partial<AppData>;
    delete v7.adminNotices;
    kv.setItem(DATA_KEY, JSON.stringify({ schemaVersion: 7, savedAt: T0, data: v7 }));
    const loaded = createStorage(kv).load();
    expect(loaded.kind).toBe('ok');
    if (loaded.kind === 'ok') {
      expect(loaded.data.adminNotices).toEqual([]);
      expect(loaded.data.offers).toEqual(v7.offers);
    }
  });
});

describe('6-C 후속: 공지 게시판', () => {
  it('크루장 공지는 공지 게시판에만, 크루원은 공지를 쓰지 못하고 운영 공지는 그 크루만 상세를 연다', () => {
    let d = createSeed(T0);
    const n = must(createCommunityPost(d, 'user-jihun', post('notice', '촬영 팁'), at(1)));
    d = n.data;
    const minji = u(d, 'user-minji');
    expect(canOpen(d, minji, { screen: 'notice', crewId: 'crew-food', postId: n.value.id })).toBe(true);
    expect(canOpen(d, minji, { screen: 'community', crewId: 'crew-food', postId: n.value.id })).toBe(false);
    expect(canOpen(d, minji, { screen: 'notice', crewId: 'crew-food', writing: true })).toBe(false);
    expect(canOpen(d, u(d, 'user-jihun'), { screen: 'notice', crewId: 'crew-food', writing: true })).toBe(true);
    expect(createCommunityPost(d, 'user-minji', post('notice', '몰래 공지'), at(2)).ok).toBe(false);
    expect(canOpen(d, minji, { screen: 'notice', crewId: 'crew-food', adminNoticeId: 'admin-notice-1' })).toBe(true);
    const other = must(createAdminNotice(d, 'user-seoyeon', { title: '뷰티만', body: 'b', crewIds: ['crew-beauty'] }, at(3)));
    expect(canOpen(other.data, minji, { screen: 'notice', crewId: 'crew-food', adminNoticeId: other.value.id })).toBe(false);
    // 알림은 공지 게시판으로 간다
    const targets = inboxFor(d, minji, at(4)).filter((i) => i.kind === 'notice' || i.kind === 'admin-notice').map((i) => i.target.screen);
    expect(new Set(targets)).toEqual(new Set(['notice']));
  });
});

describe('6-C 후속: 미션별 성과·피드백 효과', () => {
  it('중앙값은 조회수가 입력된 게시물 2편부터, 피드백 효과는 제출·피드백 기록에서', async () => {
    const { median, missionPerformance, feedbackEffect } = await import('./stats');
    expect(median([100, 900, 300])).toBe(300);
    expect(median([100, 300])).toBe(200);
    expect(median([])).toBeNull();
    const d = createSeed(T0);
    const rows = missionPerformance(d, 'crew-food');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) if (r.medianViews === null) expect(r.best).toBeNull();
    const e = feedbackEffect(d, 'crew-food');
    expect(e.firstPass.done).toBeLessThanOrEqual(e.firstPass.reviewed);
    expect(e.resubmitted.done).toBeLessThanOrEqual(e.resubmitted.requested);
  });
});

describe('UI 개선 B: 크루장 처리할 일', () => {
  it('미제출은 아직 안 낸 사람 모두를 마감 지남·24시간 안·마감 전으로 묶고, 답변 대기는 크루장 댓글 없는 질문', async () => {
    const { leaderTodo } = await import('./crewRoom');
    const { createMission } = await import('./commands');
    const { toKstLocal } = await import('./time');
    let d = createSeed(T0);
    // 마감 3일 뒤 미션 (마감 전), 마감 10시간 뒤 미션 (24시간 안)
    d = must(createMission(d, 'user-jihun', { title: '나중 미션', criteria: 'c', format: 'text', dueLocal: toKstLocal(at(60 * 24 * 3)), targetIds: ['user-minji', 'user-haneul'] }, at(1))).data;
    d = must(createMission(d, 'user-jihun', { title: '곧 마감', criteria: 'c', format: 'text', dueLocal: toKstLocal(at(600)), targetIds: ['user-junho'] }, at(2))).data;
    const todo = leaderTodo(d, 'crew-food', at(3));
    const groups = todo.unsubmitted.map((u) => u.group);
    expect(groups).toEqual([...groups].sort((a, b) => ['overdue', 'soon', 'later'].indexOf(a) - ['overdue', 'soon', 'later'].indexOf(b)));
    expect(todo.unsubmitted.filter((u) => u.mission.title === '나중 미션').every((u) => u.group === 'later')).toBe(true);
    expect(todo.unsubmitted.find((u) => u.mission.title === '곧 마감')?.group).toBe('soon');
    const q = must(createCommunityPost(d, 'user-minji', post('question', '질문'), at(4)));
    expect(leaderTodo(q.data, 'crew-food', at(5)).questions.map((p) => p.title)).toEqual(['질문']);
    const answered = must(addComment(q.data, 'user-jihun', q.value.id, '답변', at(6))).data;
    expect(leaderTodo(answered, 'crew-food', at(7)).questions).toHaveLength(0);
  });
});
