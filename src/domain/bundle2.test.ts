import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { createMemoryKv, createStorage, DATA_KEY } from '../storage/storage';
import { deliverableOf } from './queries';
import { review, submit, type CommandResult } from './commands';
import { checkedBeforePublished, metricOf, observationsOf, PERF_ERR, savePost, saveObservation } from './performance';
import { changeProposalStatus, createProposal, proposalsOf, type ProposalInput } from './proposals';
import type { AppData } from './types';

const T0 = '2026-11-09T01:00:00.000Z';
const at = (min: number) => new Date(new Date(T0).getTime() + min * 60_000).toISOString();

function must<T>(r: CommandResult<T>) {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
}

/** T-02~05 이후: 민지 결과물 완료 */
function minjiCompleted(): AppData {
  let d = createSeed(T0);
  d = must(submit(d, 'user-minji', { missionId: 'mission-food-1', content: 'https://example.com/share/v1', description: '' }, at(1))).data;
  const del = deliverableOf(d, 'mission-food-1', 'user-minji')!;
  d = must(review(d, 'user-jihun', { deliverableId: del.id, versionId: del.latestVersionId, result: 'completed', comment: '' }, at(2))).data;
  return d;
}

const POST = { platform: '유튜브', url: 'https://youtube.example/watch?v=minji', publishedOn: '2026-11-02' };
const NO_OBS = { checkedOn: '', views: '', retrospective: '' };

describe('T-06 / T-12 게시·성과 기록', () => {
  it('게시 정보만 저장하면 관찰 기록이 생기지 않고 미집계로 보인다', () => {
    const d0 = minjiCompleted();
    const del = deliverableOf(d0, 'mission-food-1', 'user-minji')!;
    expect(metricOf(d0, del.id).kind).toBe('unposted');
    const r = must(savePost(d0, 'user-minji', del.id, POST, NO_OBS, at(3)));
    expect(r.data.observations).toHaveLength(0);
    expect(metricOf(r.data, del.id).kind).toBe('uncounted');
    // 완료 상태는 그대로
    expect(deliverableOf(r.data, 'mission-food-1', 'user-minji')!.status).toBe('completed');
  });

  it('조회수 0 은 관찰 기록을 만들고 0 으로 남는다 (null 과 구분)', () => {
    const d0 = minjiCompleted();
    const del = deliverableOf(d0, 'mission-food-1', 'user-minji')!;
    const r = must(savePost(d0, 'user-minji', del.id, POST, { checkedOn: '2026-11-08', views: '0', retrospective: '' }, at(3)));
    const m = metricOf(r.data, del.id);
    expect(m.kind).toBe('views');
    expect(m.kind === 'views' && m.latest.views).toBe(0);
  });

  it('회고만 있으면 조회수는 null(미집계)이고 확인일이 남는다', () => {
    const d0 = minjiCompleted();
    const del = deliverableOf(d0, 'mission-food-1', 'user-minji')!;
    const r = must(savePost(d0, 'user-minji', del.id, POST, { checkedOn: '2026-11-08', views: '', retrospective: '첫 장면 반응이 좋았어요' }, at(3)));
    const m = metricOf(r.data, del.id);
    expect(m.kind).toBe('uncounted');
    expect(m.kind === 'uncounted' && m.latest?.checkedOn).toBe('2026-11-08');
  });

  it('같은 확인일은 고치고 다른 확인일은 추가한다', () => {
    let d = minjiCompleted();
    const del = deliverableOf(d, 'mission-food-1', 'user-minji')!;
    d = must(savePost(d, 'user-minji', del.id, POST, { checkedOn: '2026-11-08', views: '0', retrospective: '' }, at(3))).data;
    const same = must(saveObservation(d, 'user-minji', del.id, { checkedOn: '2026-11-08', views: '120', retrospective: '' }, at(4)));
    expect(same.value.mode).toBe('updated');
    d = same.data;
    expect(d.observations).toHaveLength(1);
    const other = must(saveObservation(d, 'user-minji', del.id, { checkedOn: '2026-11-09', views: '1,284', retrospective: '' }, at(5)));
    expect(other.value.mode).toBe('added');
    d = other.data;
    const post = d.posts[0];
    expect(observationsOf(d, post.id).map((o) => [o.checkedOn, o.views])).toEqual([
      ['2026-11-09', 1284],
      ['2026-11-08', 120],
    ]);
  });

  it('검증: 음수·소수 조회수, 확인일 없음, 게시일보다 이른 확인일, 검토용 링크, 잘못된 URL', () => {
    const d = minjiCompleted();
    const del = deliverableOf(d, 'mission-food-1', 'user-minji')!;
    const e = (r: CommandResult<unknown>) => (r.ok ? {} : r.errors);
    expect(e(savePost(d, 'user-minji', del.id, POST, { checkedOn: '2026-11-08', views: '-1', retrospective: '' }, at(3))).views).toBe(PERF_ERR.views);
    expect(e(savePost(d, 'user-minji', del.id, POST, { checkedOn: '2026-11-08', views: '1.5', retrospective: '' }, at(3))).views).toBe(PERF_ERR.views);
    expect(e(savePost(d, 'user-minji', del.id, POST, { checkedOn: '', views: '3', retrospective: '' }, at(3))).checkedOn).toBe(PERF_ERR.checkedOnRequired);
    expect(e(savePost(d, 'user-minji', del.id, POST, { checkedOn: '2026-11-01', views: '3', retrospective: '' }, at(3))).checkedOn).toBe(checkedBeforePublished('2026-11-02'));
    expect(checkedBeforePublished('2026-11-02')).toBe('확인일은 게시일(11월 2일)보다 빠를 수 없어요.');
    expect(e(savePost(d, 'user-minji', del.id, { ...POST, url: 'https://example.com/share/v1' }, NO_OBS, at(3))).url).toBe(PERF_ERR.reviewLink);
    expect(e(savePost(d, 'user-minji', del.id, { ...POST, url: 'youtube.com/x' }, NO_OBS, at(3))).url).toBe(PERF_ERR.urlFormat);
    expect(e(savePost(d, 'user-minji', del.id, { platform: '', url: '', publishedOn: '' }, NO_OBS, at(3)))).toMatchObject({
      platform: PERF_ERR.platform,
      url: PERF_ERR.url,
      publishedOn: PERF_ERR.publishedOn,
    });
  });

  it('성과 기록만 저장할 때 값이 모두 비면 저장하지 않는다', () => {
    let d = minjiCompleted();
    const del = deliverableOf(d, 'mission-food-1', 'user-minji')!;
    d = must(savePost(d, 'user-minji', del.id, POST, NO_OBS, at(3))).data;
    const r = saveObservation(d, 'user-minji', del.id, { checkedOn: '2026-11-08', views: '', retrospective: ' ' }, at(4));
    expect(r.ok).toBe(false);
  });

  it('완료가 아니거나 본인이 아니면 게시 기록을 남길 수 없다', () => {
    const d = createSeed(T0);
    expect(savePost(d, 'user-sora', 'deliverable-sora', POST, NO_OBS, at(1)).ok).toBe(false); // 검토 대기
    expect(savePost(d, 'user-minji', 'deliverable-junho', POST, NO_OBS, at(1)).ok).toBe(false); // 남의 결과물
    expect(savePost(d, 'user-junho', 'deliverable-junho', POST, NO_OBS, at(1)).ok).toBe(true);
  });

  it('게시일을 이미 남긴 확인일보다 늦게 고칠 수 없다', () => {
    let d = minjiCompleted();
    const del = deliverableOf(d, 'mission-food-1', 'user-minji')!;
    d = must(savePost(d, 'user-minji', del.id, POST, { checkedOn: '2026-11-03', views: '5', retrospective: '' }, at(3))).data;
    expect(savePost(d, 'user-minji', del.id, { ...POST, publishedOn: '2026-11-05' }, NO_OBS, at(4)).ok).toBe(false);
  });
});

const PROPOSAL: ProposalInput = {
  proposedOn: '2026-11-03',
  owner: '서연',
  kind: 'ad',
  brand: '식품 브랜드 A',
  content: '신제품 소개 숏폼 1편 제작 가능 여부 확인',
  status: 'delivered',
  internalMemo: '단가 협의 전',
};

describe('T-07 제안 이력', () => {
  it('등록·상태 변경 이력이 남고 같은 상태 재저장은 이력을 늘리지 않는다', () => {
    let d = createSeed(T0);
    const created = must(createProposal(d, 'user-seoyeon', 'user-minji', PROPOSAL, at(1)));
    d = created.data;
    const id = created.value.id;
    d = must(changeProposalStatus(d, 'user-seoyeon', id, 'negotiating', at(2))).data;
    const same = must(changeProposalStatus(d, 'user-seoyeon', id, 'negotiating', at(3)));
    expect(same.value.changed).toBe(false);
    expect(same.data).toBe(d);
    // 어떤 상태로든 수동 변경 가능 (종료 → 제안 준비)
    d = must(changeProposalStatus(d, 'user-seoyeon', id, 'closed', at(4))).data;
    d = must(changeProposalStatus(d, 'user-seoyeon', id, 'preparing', at(5))).data;
    const p = proposalsOf(d, 'user-minji')[0];
    expect(p.history.map((h) => [h.from, h.to])).toEqual([
      [null, 'delivered'],
      ['delivered', 'negotiating'],
      ['negotiating', 'closed'],
      ['closed', 'preparing'],
    ]);
    expect(p.history.every((h) => h.by === 'user-seoyeon')).toBe(true);
  });

  it('같은 사람에게 여러 제안을 기록하고 최근 순으로 찾는다', () => {
    let d = createSeed(T0);
    d = must(createProposal(d, 'user-seoyeon', 'user-minji', PROPOSAL, at(1))).data;
    d = must(createProposal(d, 'user-seoyeon', 'user-minji', { ...PROPOSAL, brand: '커머스 B', kind: 'commerce', proposedOn: '2026-11-07' }, at(2))).data;
    expect(proposalsOf(d, 'user-minji').map((p) => p.brand)).toEqual(['커머스 B', '식품 브랜드 A']);
  });

  it('크루장·크루원은 제안을 기록할 수 없다', () => {
    const d = createSeed(T0);
    expect(createProposal(d, 'user-jihun', 'user-minji', PROPOSAL, at(1)).ok).toBe(false);
    expect(createProposal(d, 'user-minji', 'user-minji', PROPOSAL, at(1)).ok).toBe(false);
  });

  it('필수값 누락은 저장하지 않는다', () => {
    const r = createProposal(createSeed(T0), 'user-seoyeon', 'user-minji', { ...PROPOSAL, brand: '', kind: '', status: '', content: ' ' }, at(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['brand', 'content', 'kind', 'status']);
  });
});

describe('저장 형식', () => {
  it('1차 묶음 저장값(v1)은 기록을 그대로 두고 2차 배열만 더해 읽는다', () => {
    const kv = createMemoryKv();
    const v1 = createSeed(T0) as Partial<AppData>;
    delete v1.posts;
    delete v1.observations;
    delete v1.proposals;
    delete v1.communityPosts;
    delete v1.comments;
    kv.setItem(DATA_KEY, JSON.stringify({ schemaVersion: 1, savedAt: T0, data: v1 }));
    const loaded = createStorage(kv).load();
    expect(loaded.kind).toBe('ok');
    if (loaded.kind === 'ok') {
      expect(loaded.data.posts).toEqual([]);
      expect(loaded.data.communityPosts).toEqual([]);
      expect(loaded.data.deliverables).toEqual(createSeed(T0).deliverables);
    }
  });
});

import { aggregateStatuses } from './aggregate';
import { withRo } from './korean';
import { canOpen } from '../state/routes';
import { getUser } from './queries';

describe('관리자 조회 (F-08)', () => {
  it('구성원 한 사람의 대상자-미션 조합만 센다', () => {
    const d = minjiCompleted();
    expect(aggregateStatuses(d, { memberId: 'user-minji' }).counts.completed).toBe(1);
    expect(aggregateStatuses(d, { memberId: 'user-minji' }).total).toBe(1);
  });

  it('관리자 화면은 담당 크루만, 크루장·크루원은 화면 직접 이동도 막는다', () => {
    const d = createSeed(T0);
    const admin = getUser(d, 'user-seoyeon')!;
    expect(canOpen(d, admin, { screen: 'overview', crewId: 'crew-food', memberId: 'user-minji', tab: 'proposals' })).toBe(true);
    expect(canOpen(d, admin, { screen: 'overview', crewId: 'crew-food', memberId: 'user-sora' })).toBe(false);
    expect(canOpen(d, { ...admin, managedCrewIds: ['crew-beauty'] }, { screen: 'overview', crewId: 'crew-food' })).toBe(false);
    expect(canOpen(d, getUser(d, 'user-jihun')!, { screen: 'overview', crewId: 'crew-food', memberId: 'user-minji', tab: 'proposals' })).toBe(false);
    expect(canOpen(d, getUser(d, 'user-minji')!, { screen: 'overview' })).toBe(false);
  });
});

describe('문구', () => {
  it('받침에 맞춘 로/으로', () => {
    expect(['민지', '하늘', '협의 중', '진행 확정', '보류'].map(withRo)).toEqual(['민지로', '하늘로', '협의 중으로', '진행 확정으로', '보류로']);
  });
});
