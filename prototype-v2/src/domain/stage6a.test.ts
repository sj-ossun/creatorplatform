import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { canOpen } from '../state/routes';
import type { CommandResult } from './commands';
import { addComment, createCommunityPost, deleteComment, deleteCommunityPost, isAnswered, kindsFor, postsOfBoard, updateCommunityPost } from './community';
import { inboxFor } from './inbox';
import { sendNudge } from './nudge';
import { getUser } from './queries';
import type { AppData } from './types';

const T0 = '2026-11-09T01:00:00.000Z';
const H = 3600_000;
const at = (h: number) => new Date(new Date(T0).getTime() + h * H).toISOString();
function must<T>(r: CommandResult<T>) {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
}
const u = (d: AppData, id: string) => getUser(d, id)!;
const Q = { kind: 'question' as const, title: '자막 글꼴?', body: '궁금해요', missionId: '' };

describe('6-A 게시판 분리·비공개 질문', () => {
  it('글 구분: 공지 게시판은 크루장 공지, 자유게시판은 글, Q&A게시판은 크루원 질문', () => {
    const d = createSeed(T0);
    expect(kindsFor(u(d, 'user-jihun'))).toEqual(['post']);
    expect(kindsFor(u(d, 'user-jihun'), 'notice')).toEqual(['notice']);
    expect(kindsFor(u(d, 'user-minji'), 'notice')).toEqual([]);
    expect(kindsFor(u(d, 'user-minji'))).toEqual(['post']);
    expect(kindsFor(u(d, 'user-minji'), 'qna')).toEqual(['question']);
    expect(kindsFor(u(d, 'user-jihun'), 'qna')).toEqual([]);
    expect(createCommunityPost(d, 'user-jihun', Q, at(1)).ok).toBe(false);
  });

  it('비공개 질문은 작성자·크루장·담당 관리자만, 같은 크루 다른 크루원은 못 본다', () => {
    let d = createSeed(T0);
    const r = must(createCommunityPost(d, 'user-minji', { ...Q, private: true }, at(1)));
    d = r.data;
    const id = r.value.id;
    const see = (uid: string) => postsOfBoard(d, u(d, uid), 'crew-food', 'qna').some((p) => p.id === id);
    expect(see('user-minji')).toBe(true);
    expect(see('user-jihun')).toBe(true);
    expect(see('user-seoyeon')).toBe(true);
    expect(see('user-junho')).toBe(false);
    expect(canOpen(d, u(d, 'user-junho'), { screen: 'qna', crewId: 'crew-food', postId: id })).toBe(false);
    expect(canOpen(d, u(d, 'user-seoyeon'), { screen: 'qna', crewId: 'crew-food', postId: id })).toBe(true);
    expect(canOpen(d, u(d, 'user-seoyeon'), { screen: 'qna', crewId: 'crew-food', writing: true })).toBe(false);
    expect(addComment(d, 'user-junho', id, '저도요', at(2)).ok).toBe(false);
  });

  it('크루장 답변이 달리면 질문은 수정 잠금, 크루원 알림함에 답변 알림', () => {
    let d = createSeed(T0);
    const r = must(createCommunityPost(d, 'user-minji', Q, at(1)));
    d = r.data;
    expect(updateCommunityPost(d, 'user-minji', r.value.id, { ...Q, title: '고침' }, at(2)).ok).toBe(true);
    d = must(addComment(d, 'user-jihun', r.value.id, '기본 글꼴을 써요', at(3))).data;
    const post = d.communityPosts.find((p) => p.id === r.value.id)!;
    expect(isAnswered(d, post)).toBe(true);
    expect(updateCommunityPost(d, 'user-minji', post.id, { ...Q, title: '또 고침' }, at(4)).ok).toBe(false);
    expect(inboxFor(d, u(d, 'user-minji'), at(5)).map((i) => i.kind)).toContain('answer');
  });
});

describe('6-A 글·댓글 수정·삭제', () => {
  it('작성자만, 댓글 있는 글은 삭제된 글로 남고 없으면 지운다, 댓글은 삭제된 댓글로 남는다', () => {
    let d = createSeed(T0);
    const p1 = must(createCommunityPost(d, 'user-minji', { kind: 'post', title: '자랑', body: '찍었어요', missionId: '' }, at(1)));
    d = p1.data;
    expect(updateCommunityPost(d, 'user-junho', p1.value.id, { kind: 'post', title: 'x', body: 'y', missionId: '' }, at(2)).ok).toBe(false);
    const edited = must(updateCommunityPost(d, 'user-minji', p1.value.id, { kind: 'post', title: '자랑 2', body: '다시', missionId: '' }, at(2)));
    expect(edited.value.updatedAt).toBe(at(2));
    d = edited.data;
    const c = must(addComment(d, 'user-junho', p1.value.id, '멋져요', at(3)));
    d = c.data;
    expect(deleteCommunityPost(d, 'user-junho', p1.value.id, at(4)).ok).toBe(false);
    const del = must(deleteCommunityPost(d, 'user-minji', p1.value.id, at(4)));
    expect(del.value.soft).toBe(true);
    expect(del.data.communityPosts.find((p) => p.id === p1.value.id)?.body).toBe('');
    const dc = must(deleteComment(del.data, 'user-junho', c.value.id, at(5)));
    expect(dc.data.comments.find((x) => x.id === c.value.id)?.deletedAt).toBe(at(5));
    const p2 = must(createCommunityPost(dc.data, 'user-minji', { kind: 'post', title: 'a', body: 'b', missionId: '' }, at(6)));
    const hard = must(deleteCommunityPost(p2.data, 'user-minji', p2.value.id, at(7)));
    expect(hard.value.soft).toBe(false);
    expect(hard.data.communityPosts.some((p) => p.id === p2.value.id)).toBe(false);
  });
});

describe('6-A 마감 임박·재촉', () => {
  it('마감 24시간 전부터 미제출자 알림함에 마감 임박, 지나면 사라진다', () => {
    const d = createSeed(T0);
    const m = { ...d.missions[0], id: 'm-x', dueAt: at(30), createdAt: at(-10), targetIds: ['user-minji', 'user-junho'] };
    const d2 = { ...d, missions: [...d.missions, m] };
    const kinds = (h: number) => inboxFor(d2, u(d2, 'user-minji'), at(h)).filter((i) => i.id === 'due-m-x').length;
    expect(kinds(1)).toBe(0);
    expect(kinds(8)).toBe(1);
    expect(kinds(31)).toBe(0);
  });

  it('재촉은 그 크루 크루장, 마감 전, 미제출자에게만, 같은 미션 하루 한 번', () => {
    const d = createSeed(T0);
    const m = { ...d.missions[0], id: 'm-y', dueAt: at(48), createdAt: at(-10), targetIds: ['user-minji', 'user-junho'] };
    let d2: AppData = { ...d, missions: [...d.missions, m] };
    expect(sendNudge(d2, 'user-yujin', 'm-y', at(1)).ok).toBe(false);
    expect(sendNudge(d2, 'user-jihun', 'm-y', at(49)).ok).toBe(false);
    const r = must(sendNudge(d2, 'user-jihun', 'm-y', at(1)));
    expect(r.value.memberIds).toEqual(['user-minji', 'user-junho']);
    d2 = r.data;
    expect(sendNudge(d2, 'user-jihun', 'm-y', at(2)).ok).toBe(false);
    expect(inboxFor(d2, u(d2, 'user-junho'), at(3)).map((i) => i.kind)).toContain('nudge');
    expect(inboxFor(d2, u(d2, 'user-haneul'), at(3)).map((i) => i.kind)).not.toContain('nudge');
  });
});
