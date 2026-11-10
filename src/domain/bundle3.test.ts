import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { createMemoryKv, createStorage, DATA_KEY } from '../storage/storage';
import { canOpen } from '../state/routes';
import { createMission, submit, review, type CommandResult } from './commands';
import {
  addComment,
  commentsOf,
  COMMUNITY_ERR,
  createCommunityPost,
  linkableMissions,
  linkedMissionView,
  postsOfCrew,
} from './community';
import { unsubmittedReminder } from './reminders';
import { deliverableOf, getMission, getUser } from './queries';
import { toKstLocal } from './time';
import type { AppData } from './types';

const T0 = '2026-11-09T01:00:00.000Z';
const at = (min: number) => new Date(new Date(T0).getTime() + min * 60_000).toISOString();
function must<T>(r: CommandResult<T>) {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
}

describe('T-08 크루 소통', () => {
  it('공지는 위, 구분 안에서는 최신순, 댓글은 작성순', () => {
    let d = createSeed(T0);
    d = must(createCommunityPost(d, 'user-minji', { kind: 'question', title: '질문1', body: 'b', missionId: '' }, at(1))).data;
    d = must(createCommunityPost(d, 'user-jihun', { kind: 'notice', title: '공지1', body: 'b', missionId: '' }, at(2))).data;
    d = must(createCommunityPost(d, 'user-haneul', { kind: 'question', title: '질문2', body: 'b', missionId: '' }, at(3))).data;
    d = must(createCommunityPost(d, 'user-jihun', { kind: 'notice', title: '공지2', body: 'b', missionId: '' }, at(4))).data;
    expect(postsOfCrew(d, 'crew-food').map((p) => p.title)).toEqual(['공지2', '공지1', '질문2', '질문1']);
    const q1 = d.communityPosts.find((p) => p.title === '질문1')!;
    d = must(addComment(d, 'user-jihun', q1.id, '첫 댓글', at(5))).data;
    d = must(addComment(d, 'user-junho', q1.id, '둘째 댓글', at(6))).data;
    expect(commentsOf(d, q1.id).map((c) => c.body)).toEqual(['첫 댓글', '둘째 댓글']);
  });

  it('크루원은 공지를 쓸 수 없고, 제목·본문·댓글은 필수다', () => {
    const d = createSeed(T0);
    const r = createCommunityPost(d, 'user-minji', { kind: 'notice', title: '', body: ' ', missionId: '' }, at(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toMatchObject({ kind: COMMUNITY_ERR.noticeNotAllowed, title: COMMUNITY_ERR.title, body: COMMUNITY_ERR.body });
    const p = must(createCommunityPost(d, 'user-minji', { kind: 'question', title: 't', body: 'b', missionId: '' }, at(1)));
    expect(addComment(p.data, 'user-junho', p.value.id, '   ', at(2)).ok).toBe(false);
  });

  it('다른 크루 글에는 참여할 수 없고 목록에도 섞이지 않는다', () => {
    let d = createSeed(T0);
    const p = must(createCommunityPost(d, 'user-minji', { kind: 'question', title: 't', body: 'b', missionId: '' }, at(1)));
    d = p.data;
    expect(addComment(d, 'user-sora', p.value.id, '안녕', at(2)).ok).toBe(false);
    expect(addComment(d, 'user-seoyeon', p.value.id, '안녕', at(2)).ok).toBe(false);
    expect(postsOfCrew(d, 'crew-beauty')).toHaveLength(0);
    expect(canOpen(d, getUser(d, 'user-sora')!, { screen: 'community', postId: p.value.id })).toBe(false);
    expect(canOpen(d, getUser(d, 'user-junho')!, { screen: 'community', postId: p.value.id })).toBe(true);
    expect(canOpen(d, getUser(d, 'user-seoyeon')!, { screen: 'community' })).toBe(false);
  });

  it('작성자는 자기에게 보이는 같은 크루 미션만 연결한다', () => {
    const d = createSeed(T0);
    expect(linkableMissions(d, getUser(d, 'user-minji')!).map((m) => m.id)).toEqual(['mission-food-1']);
    const r = createCommunityPost(d, 'user-minji', { kind: 'question', title: 't', body: 'b', missionId: 'mission-beauty-1' }, at(1));
    expect(r.ok).toBe(false);
  });
});

describe('T-09 대상자 전용 미션', () => {
  it('비대상 크루원은 글은 읽지만 연결 미션 제목·내용을 받지 못하고 화면 직접 이동도 막힌다', () => {
    let d: AppData = createSeed(T0);
    const m = must(
      createMission(
        d,
        'user-jihun',
        { title: '민지 전용 미션', criteria: '기준', format: 'text', dueLocal: toKstLocal(at(60 * 24 * 3)), targetIds: ['user-minji'] },
        at(1),
      ),
    );
    d = m.data;
    const p = must(createCommunityPost(d, 'user-jihun', { kind: 'notice', title: '이번 주 미션', body: '확인해 주세요', missionId: m.value.id }, at(2)));
    d = p.data;
    const haneul = getUser(d, 'user-haneul')!;
    expect(linkedMissionView(d, haneul, p.value)).toEqual({ kind: 'locked' });
    expect(linkedMissionView(d, getUser(d, 'user-minji')!, p.value)).toMatchObject({ kind: 'open' });
    expect(linkedMissionView(d, getUser(d, 'user-jihun')!, p.value)).toMatchObject({ kind: 'open' });
    expect(canOpen(d, haneul, { screen: 'my-missions', missionId: m.value.id })).toBe(false);
    expect(canOpen(d, haneul, { screen: 'community', postId: p.value.id })).toBe(true);
  });
});

describe('F-11B 미제출 안내 미리보기', () => {
  it('마감이 지났고 최초 제출이 없는 대상자만, 보완 요청자는 제외', () => {
    let d = createSeed(T0);
    const food = getMission(d, 'mission-food-1')!;
    expect(unsubmittedReminder(d, food, at(1)).recipients.map((u) => u.name)).toEqual(['민지', '하늘']);
    d = must(submit(d, 'user-minji', { missionId: food.id, content: 'https://example.com/v1', description: '' }, at(2))).data;
    const del = deliverableOf(d, food.id, 'user-minji')!;
    d = must(review(d, 'user-jihun', { deliverableId: del.id, versionId: del.latestVersionId, result: 'revision_requested', comment: '고쳐 주세요' }, at(3))).data;
    expect(unsubmittedReminder(d, food, at(4)).recipients.map((u) => u.name)).toEqual(['하늘']);
  });

  it('마감 전이면 대상 0명', () => {
    let d = createSeed(T0);
    const m = must(createMission(d, 'user-jihun', { title: 'x', criteria: 'y', format: 'text', dueLocal: toKstLocal(at(600)), targetIds: ['user-minji'] }, at(1)));
    d = m.data;
    const r = unsubmittedReminder(d, m.value, at(2));
    expect(r.duePassed).toBe(false);
    expect(r.recipients).toHaveLength(0);
    // 클릭 시점의 현재 시각으로 계산한다
    expect(unsubmittedReminder(d, m.value, at(601)).recipients.map((u) => u.name)).toEqual(['민지']);
  });

  it('미리보기는 데이터를 바꾸지 않는다', () => {
    const d = createSeed(T0);
    const before = JSON.stringify(d);
    unsubmittedReminder(d, getMission(d, 'mission-food-1')!, at(1));
    expect(JSON.stringify(d)).toBe(before);
  });
});

describe('저장 형식 v3', () => {
  it('2차 저장값(v2)은 소통 배열만 더해 그대로 읽는다', () => {
    const kv = createMemoryKv();
    const v2 = createSeed(T0) as Partial<AppData>;
    delete v2.communityPosts;
    delete v2.comments;
    kv.setItem(DATA_KEY, JSON.stringify({ schemaVersion: 2, savedAt: T0, data: v2 }));
    const loaded = createStorage(kv).load();
    expect(loaded.kind).toBe('ok');
    if (loaded.kind === 'ok') expect(loaded.data.comments).toEqual([]);
  });
});
