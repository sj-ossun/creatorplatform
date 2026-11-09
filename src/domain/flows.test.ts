import { describe, expect, it } from 'vitest';
import { aggregateStatuses } from './aggregate';
import { createMission, ERR, review, submit, FORM_ERROR } from './commands';
import { canViewDeliverable, notificationsVisibleTo } from './access';
import { deliverableOf, getUser, missionsAssignedTo, nextPending, reviewEntries, versionsOf } from './queries';
import { createSeed } from '../data/seed';
import type { AppData } from './types';
import { executeCommand } from '../state/commit';
import { createMemoryKv, createStorage, DATA_KEY, SCHEMA_VERSION } from '../storage/storage';
import { toKstLocal } from './time';

const SEED_AT = '2026-11-09T01:00:00.000Z';
const later = (min: number) => new Date(new Date(SEED_AT).getTime() + min * 60_000).toISOString();

function counts(data: AppData) {
  const { counts: c, total } = aggregateStatuses(data);
  return [c.pending_review, c.revision_requested, c.completed, c.not_submitted, total];
}

function must<T>(r: { ok: true; data: AppData; value: T } | { ok: false; errors: Record<string, string> }) {
  if (!r.ok) throw new Error(`command failed: ${JSON.stringify(r.errors)}`);
  return r;
}

const MINJI_LINK = 'https://example.com/share/minji-v1';

describe('초기 예시 데이터 (7.1)', () => {
  it('대상 5건 = 검토 대기 1 + 보완 요청 0 + 완료 1 + 미제출 3', () => {
    expect(counts(createSeed(SEED_AT))).toEqual([1, 0, 1, 3, 5]);
  });
  it('대표 미션 기한은 생성 기준 시각보다 이전이며 시연용 기한이다', () => {
    const d = createSeed(SEED_AT);
    for (const m of d.missions) {
      expect(new Date(m.dueAt).getTime()).toBeLessThan(new Date(SEED_AT).getTime());
      expect(m.demoDue).toBe(true);
    }
  });
});

describe('T-01 미션 등록', () => {
  it('대상자에게만 보이고 대상자 전체가 미제출로 계산된다', () => {
    const d0 = createSeed(SEED_AT);
    const r = must(
      createMission(
        d0,
        'user-jihun',
        {
          title: '새 미션',
          criteria: '기준',
          format: 'text',
          dueLocal: toKstLocal(later(60 * 24 * 3)),
          targetIds: ['user-minji', 'user-haneul'],
        },
        later(1),
      ),
    );
    const m = r.value;
    expect(missionsAssignedTo(r.data, 'user-minji').map((x) => x.id)).toContain(m.id);
    expect(missionsAssignedTo(r.data, 'user-junho').map((x) => x.id)).not.toContain(m.id);
    const agg = aggregateStatuses(r.data, { missionIds: [m.id] });
    expect(agg).toEqual({
      total: 2,
      counts: { pending_review: 0, revision_requested: 0, completed: 0, not_submitted: 2 },
      unit: '명',
    });
  });

  it('공백 제목·기준, 대상자 없음, 잘못된 날짜, 다른 크루 대상자는 등록을 막는다', () => {
    const d0 = createSeed(SEED_AT);
    const r = createMission(
      d0,
      'user-jihun',
      { title: '  ', criteria: '', format: '', dueLocal: '2026-13-40T99:00', targetIds: ['user-sora'] },
      later(1),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['criteria', 'dueAt', 'format', 'targetIds', 'title']);
  });

  it('크루원은 미션을 등록할 수 없다', () => {
    const r = createMission(
      createSeed(SEED_AT),
      'user-minji',
      { title: 'a', criteria: 'b', format: 'text', dueLocal: toKstLocal(later(9999)), targetIds: ['user-minji'] },
      later(1),
    );
    expect(r.ok).toBe(false);
  });
});

describe('T-02 ~ T-05 제출·보완·재제출·완료', () => {
  it('집계와 버전이 기대값을 따른다', () => {
    let d = createSeed(SEED_AT);
    const missionId = 'mission-food-1';

    // T-02 최초 제출 (기한 후)
    let s = must(submit(d, 'user-minji', { missionId, content: MINJI_LINK, description: '' }, later(10)));
    d = s.data;
    expect(counts(d)).toEqual([2, 0, 1, 2, 5]);
    const del = deliverableOf(d, missionId, 'user-minji')!;
    expect(versionsOf(d, del.id)).toHaveLength(1);
    expect(versionsOf(d, del.id)[0].late).toBe(true);

    // T-03 빈 수정 방향은 저장되지 않는다
    const empty = review(d, 'user-jihun', { deliverableId: del.id, versionId: del.latestVersionId, result: 'revision_requested', comment: '  ' }, later(20));
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.errors.comment).toBe(ERR.revisionComment);

    const rv = must(
      review(d, 'user-jihun', { deliverableId: del.id, versionId: del.latestVersionId, result: 'revision_requested', comment: '링크 접근 권한을 확인해 주세요.' }, later(20)),
    );
    d = rv.data;
    expect(counts(d)).toEqual([1, 1, 1, 2, 5]);
    // F-11A 알림 예시가 함께 저장된다
    expect(d.notifications.filter((n) => n.feedbackId === rv.value.feedback.id)).toHaveLength(1);
    expect(rv.value.notification.recipientId).toBe('user-minji');

    // T-04 수정 내용 없이는 재제출 불가
    const noNote = submit(d, 'user-minji', { missionId, content: 'https://example.com/share/minji-v2', description: '', changeNote: '' }, later(30));
    expect(noNote.ok).toBe(false);
    if (!noNote.ok) expect(noNote.errors.changeNote).toBe(ERR.changeNote);

    s = must(
      submit(d, 'user-minji', { missionId, content: 'https://example.com/share/minji-v2', description: '', changeNote: '공유 권한을 열었어요.' }, later(30)),
    );
    d = s.data;
    expect(counts(d)).toEqual([2, 0, 1, 2, 5]);
    expect(s.value.version.number).toBe(2);
    // 과거 피드백이 남는다
    const v1 = versionsOf(d, del.id).find((v) => v.number === 1)!;
    expect(d.feedbacks.some((f) => f.versionId === v1.id && f.result === 'revision_requested')).toBe(true);
    expect(v1.content).toBe(MINJI_LINK);

    // T-05 수정본 완료
    d = must(review(d, 'user-jihun', { deliverableId: del.id, versionId: s.value.version.id, result: 'completed', comment: '' }, later(40))).data;
    expect(counts(d)).toEqual([1, 0, 2, 2, 5]);
    expect(d.deliverables.filter((x) => x.memberId === 'user-minji')).toHaveLength(1);
    expect(versionsOf(d, del.id)).toHaveLength(2);
  });
});

describe('중복 방지', () => {
  it('같은 버전을 두 번 처리할 수 없고 알림 예시도 하나뿐이다', () => {
    let d = createSeed(SEED_AT);
    const del = deliverableOf(d, 'mission-beauty-1', 'user-sora')!;
    const input = { deliverableId: del.id, versionId: del.latestVersionId, result: 'completed' as const, comment: '' };
    d = must(review(d, 'user-yujin', input, later(1))).data;
    const again = review(d, 'user-yujin', input, later(2));
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.errors[FORM_ERROR]).toBe(ERR.alreadyReviewed);
    expect(d.notifications.filter((n) => n.deliverableId === del.id)).toHaveLength(1);
  });

  it('검토 대기 중 다시 제출하거나 완료 후 재제출할 수 없다', () => {
    let d = createSeed(SEED_AT);
    d = must(submit(d, 'user-minji', { missionId: 'mission-food-1', content: MINJI_LINK, description: '' }, later(1))).data;
    expect(submit(d, 'user-minji', { missionId: 'mission-food-1', content: MINJI_LINK, description: '' }, later(2)).ok).toBe(false);
    expect(submit(d, 'user-junho', { missionId: 'mission-food-1', content: MINJI_LINK, description: '', changeNote: 'x' }, later(2)).ok).toBe(false);
  });

  it('이전 버전(최신이 아닌 버전)에는 피드백을 남길 수 없다', () => {
    const d = createSeed(SEED_AT);
    const r = review(d, 'user-jihun', { deliverableId: 'deliverable-junho', versionId: 'version-junho-1', result: 'completed', comment: '' }, later(1));
    expect(r.ok).toBe(false);
  });

  it('다른 크루 크루장은 처리할 수 없다', () => {
    const d = createSeed(SEED_AT);
    const del = deliverableOf(d, 'mission-beauty-1', 'user-sora')!;
    const r = review(d, 'user-jihun', { deliverableId: del.id, versionId: del.latestVersionId, result: 'completed', comment: '' }, later(1));
    expect(r.ok).toBe(false);
  });
});

describe('제출 입력 검증 (F-03)', () => {
  it('링크는 http/https 만 허용한다', () => {
    const d = createSeed(SEED_AT);
    for (const bad of ['', 'example.com/x', 'ftp://example.com/x', 'javascript:alert(1)', 'https://']) {
      const r = submit(d, 'user-minji', { missionId: 'mission-food-1', content: bad, description: '' }, later(1));
      expect(r.ok, bad).toBe(false);
    }
  });
  it('대상자가 아닌 미션에는 제출할 수 없다', () => {
    const d = createSeed(SEED_AT);
    expect(submit(d, 'user-sora', { missionId: 'mission-food-1', content: MINJI_LINK, description: '' }, later(1)).ok).toBe(false);
  });
});

describe('T-11 마지막 검토 대상', () => {
  it('처리하면 다음 검토 대기가 없다', () => {
    let d = createSeed(SEED_AT);
    const mission = d.missions.find((m) => m.id === 'mission-food-1')!;
    d = must(submit(d, 'user-minji', { missionId: mission.id, content: MINJI_LINK, description: '' }, later(1))).data;
    d = must(submit(d, 'user-haneul', { missionId: mission.id, content: 'https://example.com/h', description: '' }, later(2))).data;
    // 먼저 제출한 순서
    expect(reviewEntries(d, mission).filter((e) => e.status === 'pending_review').map((e) => e.member.name)).toEqual(['민지', '하늘']);
    expect(nextPending(d, mission, 'user-minji')?.member.name).toBe('하늘');
    const del = deliverableOf(d, mission.id, 'user-minji')!;
    d = must(review(d, 'user-jihun', { deliverableId: del.id, versionId: del.latestVersionId, result: 'completed', comment: '' }, later(3))).data;
    const del2 = deliverableOf(d, mission.id, 'user-haneul')!;
    d = must(review(d, 'user-jihun', { deliverableId: del2.id, versionId: del2.latestVersionId, result: 'completed', comment: '' }, later(4))).data;
    expect(nextPending(d, mission, 'user-haneul')).toBeUndefined();
  });
});

describe('저장 (F-01, T-10)', () => {
  it('저장 실패 시 이전 데이터를 유지한다', () => {
    const kv = createMemoryKv();
    const storage = createStorage(kv);
    const d0 = createSeed(SEED_AT);
    storage.save(d0);
    kv.failWrites = true;
    const out = executeCommand(d0, (d) => submit(d, 'user-minji', { missionId: 'mission-food-1', content: MINJI_LINK, description: '' }, later(1)), (d) => storage.save(d));
    expect(out.status).toBe('save_failed');
    const loaded = storage.load();
    expect(loaded.kind === 'ok' && counts(loaded.data)).toEqual([1, 0, 1, 3, 5]);
  });

  it('검증 실패는 저장하지 않는다', () => {
    let saved = 0;
    const out = executeCommand(createSeed(SEED_AT), (d) => submit(d, 'user-minji', { missionId: 'mission-food-1', content: '', description: '' }, later(1)), () => void saved++);
    expect(out.status).toBe('invalid');
    expect(saved).toBe(0);
  });

  it('새로고침(다시 읽기) 후 날짜·버전·피드백이 그대로다', () => {
    const kv = createMemoryKv();
    const storage = createStorage(kv);
    let d = createSeed(SEED_AT);
    d = must(submit(d, 'user-minji', { missionId: 'mission-food-1', content: MINJI_LINK, description: '설명' }, later(1))).data;
    storage.save(d);
    const loaded = storage.load();
    expect(loaded).toEqual({ kind: 'ok', data: d });
    expect(loaded.kind === 'ok' && loaded.data.seededAt).toBe(SEED_AT);
  });

  it('호환되지 않는 저장 버전은 지우지 않고 알린다', () => {
    const kv = createMemoryKv();
    kv.setItem(DATA_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, data: {} }));
    kv.setItem('other-app', 'keep');
    const storage = createStorage(kv);
    expect(storage.load().kind).toBe('incompatible');
    expect(kv.getItem(DATA_KEY)).not.toBeNull();
    expect(kv.getItem('other-app')).toBe('keep');
  });

  it('깨진 저장값은 읽을 수 없음으로 알린다', () => {
    const kv = createMemoryKv();
    kv.setItem(DATA_KEY, '{oops');
    expect(createStorage(kv).load().kind).toBe('unreadable');
  });
});

describe('예시 접근 범위', () => {
  it('크루원은 본인 제출물만, 크루장은 자기 크루만, 관리자는 담당 크루만 본다', () => {
    const d = createSeed(SEED_AT);
    const sora = d.deliverables.find((x) => x.id === 'deliverable-sora')!;
    expect(canViewDeliverable(d, getUser(d, 'user-sora')!, sora)).toBe(true);
    expect(canViewDeliverable(d, getUser(d, 'user-yuna')!, sora)).toBe(false);
    expect(canViewDeliverable(d, getUser(d, 'user-jihun')!, sora)).toBe(false);
    expect(canViewDeliverable(d, getUser(d, 'user-yujin')!, sora)).toBe(true);
    expect(canViewDeliverable(d, getUser(d, 'user-seoyeon')!, sora)).toBe(true);
  });
  it('알림 미리보기는 담당 범위만 보인다', () => {
    const d = createSeed(SEED_AT);
    expect(notificationsVisibleTo(d, getUser(d, 'user-jihun')!)).toHaveLength(1);
    expect(notificationsVisibleTo(d, getUser(d, 'user-yujin')!)).toHaveLength(0);
    expect(notificationsVisibleTo(d, getUser(d, 'user-seoyeon')!)).toHaveLength(1);
  });
});

describe('집계 필터 (F-08 계산)', () => {
  it('크루·기간(마감일, 한국 시간) 필터와 단위', () => {
    const d = createSeed(SEED_AT);
    expect(aggregateStatuses(d, { crewIds: ['crew-beauty'] }).total).toBe(2);
    // 대표 미션 마감: 2026-11-08 10:00 KST
    expect(aggregateStatuses(d, { from: '2026-11-08', to: '2026-11-08' }).total).toBe(5);
    expect(aggregateStatuses(d, { from: '2026-11-09' }).total).toBe(0);
    expect(aggregateStatuses(d, { to: '2026-11-07' }).total).toBe(0);
    expect(aggregateStatuses(d).unit).toBe('건');
  });
});
