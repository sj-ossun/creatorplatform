import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { canOpen, globalMenu } from '../state/routes';
import { BACKUP_KEY_PREFIX, createMemoryKv, createStorage, DATA_KEY } from '../storage/storage';
import { review, submit } from './commands';
import { createCommunityPost } from './community';
import { inboxFor, markInboxRead, unreadCount } from './inbox';
import { changeProposalStatus, proposalsForMember } from './proposals';
import { deliverableOf, getUser } from './queries';
import { designateShowcase, removeShowcase, showcaseViews } from './showcase';
import type { CommandResult } from './commands';
import type { AppData } from './types';

const T0 = '2026-11-09T01:00:00.000Z';
const at = (h: number) => new Date(new Date(T0).getTime() + h * 3600_000).toISOString();
function must<T>(r: CommandResult<T>) {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
}
const u = (d: AppData, id: string) => getUser(d, id)!;

describe('4.5단계 우수 사례', () => {
  it('예시 데이터에는 가상 사례 1건 (준호, 지훈의 한 줄 평)', () => {
    const v = showcaseViews(createSeed(T0));
    expect(v).toHaveLength(1);
    expect(v[0].creator.name).toBe('준호');
    expect(v[0].author.role).toBe('leader');
    expect(v[0].metric.kind).toBe('views');
  });

  it('완료 + 게시 기록이 있어야 지정, 크루장(자기 크루)·관리자(담당 크루)만, 크루원·다른 크루장은 불가', () => {
    let d = createSeed(T0);
    d = must(removeShowcase(d, 'user-jihun', 'deliverable-junho')).data;
    expect(designateShowcase(d, 'user-junho', 'deliverable-junho', '좋아요', at(1)).ok).toBe(false);
    expect(designateShowcase(d, 'user-yujin', 'deliverable-junho', '좋아요', at(1)).ok).toBe(false);
    expect(designateShowcase(d, 'user-jihun', 'deliverable-junho', '  ', at(1)).ok).toBe(false);
    expect(designateShowcase(d, 'user-yujin', 'deliverable-sora', '좋아요', at(1)).ok).toBe(false); // 검토 대기·미게시
    const r = must(designateShowcase(d, 'user-seoyeon', 'deliverable-junho', '관리자가 고른 사례', at(1)));
    expect(showcaseViews(r.data)[0].author.role).toBe('admin');
    expect(designateShowcase(r.data, 'user-jihun', 'deliverable-junho', '중복', at(2)).ok).toBe(false);
  });
});

describe('4.5단계 알림함', () => {
  it('역할별 범위: 크루원 새 미션·피드백·공지, 크루장 제출·질문, 관리자 제안 상태·검토 지연', () => {
    let d = createSeed(T0);
    d = must(submit(d, 'user-minji', { missionId: 'mission-food-1', content: 'https://example.com/share/m1', description: '' }, at(1))).data;
    const del = deliverableOf(d, 'mission-food-1', 'user-minji')!;
    d = must(review(d, 'user-jihun', { deliverableId: del.id, versionId: del.latestVersionId, result: 'revision_requested', comment: '첫 장면을 바꿔 주세요' }, at(2))).data;
    d = must(createCommunityPost(d, 'user-jihun', { kind: 'notice', title: '공지', body: '본문', missionId: '' }, at(3))).data;
    d = must(createCommunityPost(d, 'user-haneul', { kind: 'question', title: '질문', body: '본문', missionId: '' }, at(4))).data;
    const now = at(10);
    const minji = inboxFor(d, u(d, 'user-minji'), now).map((i) => i.kind);
    expect(minji).toContain('feedback');
    expect(minji).toContain('notice');
    expect(minji).toContain('mission');
    expect(minji).not.toContain('question');
    const jihun = inboxFor(d, u(d, 'user-jihun'), now).map((i) => i.kind);
    expect(jihun).toContain('submission');
    expect(jihun).toContain('question');
    expect(jihun).not.toContain('notice'); // 자기 글은 알리지 않는다
    // 다른 크루는 섞이지 않는다
    expect(inboxFor(d, u(d, 'user-sora'), now).some((i) => i.text.includes('공지'))).toBe(false);
    // 관리자: 시드의 소라 제출은 기한 기준 2일이 넘으면 검토 지연
    const late = new Date(new Date(T0).getTime() + 3 * 24 * 3600_000).toISOString();
    expect(inboxFor(d, u(d, 'user-seoyeon'), late).map((i) => i.kind)).toContain('stale');
    // 제안 상태 변경은 다른 사람이 바꿨을 때만 알린다 (예시 제안은 서연 본인이 바꿨다)
    expect(inboxFor(d, u(d, 'user-seoyeon'), now).map((i) => i.kind)).not.toContain('proposal');
    const other = { ...u(d, 'user-seoyeon'), id: 'user-admin-2' };
    expect(inboxFor(d, other, now).map((i) => i.kind)).toContain('proposal');
  });

  it('읽음 시각 이후 알림만 안 읽음으로 센다', () => {
    const d = createSeed(T0);
    const minji = u(d, 'user-minji');
    expect(unreadCount(d, minji, at(1))).toBeGreaterThan(0);
    const read = markInboxRead(d, minji.id, at(1));
    expect(unreadCount(read, minji, at(1))).toBe(0);
  });

  it('알림함은 로그인한 모든 역할, 비로그인은 열지 못한다', () => {
    const d = createSeed(T0);
    for (const id of ['user-minji', 'user-jihun', 'user-seoyeon']) expect(canOpen(d, u(d, id), { screen: 'inbox' })).toBe(true);
    expect(canOpen(d, null, { screen: 'inbox' })).toBe(false);
    expect(canOpen(d, null, { screen: 'showcases' })).toBe(true);
  });
});

describe('4.5단계 내 제안', () => {
  it('크루원 본인만, 제안 전달 이후 상태만, 내부 메모 없음. 크루장은 화면이 없다', () => {
    let d = createSeed(T0);
    const junho = u(d, 'user-junho');
    const list = proposalsForMember(d, junho);
    expect(list.map((p) => p.id).sort()).toEqual(['proposal-junho-0', 'proposal-junho-1']);
    expect(JSON.stringify(list)).not.toContain('단가');
    expect(proposalsForMember(d, u(d, 'user-minji'))).toHaveLength(0);
    d = must(changeProposalStatus(d, 'user-seoyeon', 'proposal-junho-1', 'preparing', at(1))).data;
    expect(proposalsForMember(d, junho).map((p) => p.id)).toEqual(['proposal-junho-0']);
    expect(canOpen(d, junho, { screen: 'my-proposals' })).toBe(true);
    expect(canOpen(d, u(d, 'user-jihun'), { screen: 'my-proposals' })).toBe(false);
    expect(globalMenu(u(d, 'user-jihun')).items.some((i) => i.key === 'my-proposals')).toBe(false);
  });
});

describe('저장 형식 v4·v5', () => {
  it('v3 저장값은 우수 사례·읽음 시각만 더해 읽고, 처음 저장할 때 원래 값을 백업한다', () => {
    const kv = createMemoryKv();
    const v3 = createSeed(T0) as Partial<AppData>;
    delete v3.showcases;
    delete v3.readMarks;
    const raw = JSON.stringify({ schemaVersion: 3, savedAt: T0, data: v3 });
    kv.setItem(DATA_KEY, raw);
    const storage = createStorage(kv);
    const loaded = storage.load();
    expect(loaded.kind).toBe('ok');
    if (loaded.kind !== 'ok') return;
    expect(loaded.data.showcases).toEqual([]);
    expect(loaded.data.readMarks).toEqual({});
    expect(loaded.data.revenues).toEqual([]);
    expect(kv.getItem(DATA_KEY)).toBe(raw); // 읽기만 해서는 바꾸지 않는다
    storage.save(loaded.data);
    expect(kv.getItem(`${BACKUP_KEY_PREFIX}3`)).toBe(raw);
    expect(JSON.parse(kv.getItem(DATA_KEY)!).schemaVersion).toBe(6);
    // 두 번째 저장은 백업을 덮어쓰지 않는다
    storage.save(loaded.data);
    expect(kv.getItem(`${BACKUP_KEY_PREFIX}3`)).toBe(raw);
  });
});
