import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { canOpen, crewMenu, globalMenu } from '../state/routes';
import { BACKUP_KEY_PREFIX, createMemoryKv, createStorage, DATA_KEY } from '../storage/storage';
import type { CommandResult } from './commands';
import { inboxFor } from './inbox';
import { getUser } from './queries';
import { requestRecord } from './recordRequest';
import { monthlyRevenue, revenuesForMember, saveRevenue, sumRevenue } from './revenue';
import { memberStats, weekStart, weeklyStatus } from './stats';
import type { AppData } from './types';

const T0 = '2026-11-09T01:00:00.000Z';
const DAY = 24 * 3600_000;
const at = (d: number) => new Date(new Date(T0).getTime() + d * DAY).toISOString();
function must<T>(r: CommandResult<T>) {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
}
const u = (d: AppData, id: string) => getUser(d, id)!;

describe('5단계 성과 계산', () => {
  it('준호: 완료율·기한 내 제출률·최근 조회수 합계', () => {
    const d = createSeed(T0);
    const s = memberStats(d, u(d, 'user-junho'), T0);
    expect(s.assigned).toBe(1);
    expect(s.completionRate).toBe(1);
    expect(s.onTimeRate).toBe(1);
    expect(s.viewsTotal).toBe(1240);
    expect(s.needsRecord).toBe(false);
  });

  it('게시 후 7일 넘게 성과 기록이 없으면 기록 요청 필요, 미입력은 null', () => {
    const d = createSeed(T0);
    d.observations = [];
    const s = memberStats(d, u(d, 'user-junho'), at(6));
    expect(s.viewsTotal).toBeNull();
    expect(s.needsRecord).toBe(true);
    expect(memberStats(d, u(d, 'user-junho'), at(4)).needsRecord).toBe(false);
  });

  it('주차는 한국 시간 월요일 시작, 주차별 상태 합계는 대상 건수와 같다', () => {
    expect(weekStart('2026-11-11')).toBe('2026-11-09'); // 수 → 월
    expect(weekStart('2026-11-15')).toBe('2026-11-09'); // 일 → 같은 주
    const d = createSeed(T0);
    for (const w of weeklyStatus(d, ['crew-food', 'crew-beauty'])) {
      expect(Object.values(w.counts).reduce((a, b) => a + b, 0)).toBe(w.total);
    }
  });
});

describe('5단계 기록 요청', () => {
  it('크루장(자기 크루)만, 대상 게시물만, 같은 결과물 하루 한 번. 크루원 알림함에 보인다', () => {
    let d = createSeed(T0);
    d.observations = [];
    const now = at(6);
    expect(requestRecord(d, 'user-yujin', 'deliverable-junho', now).ok).toBe(false);
    expect(requestRecord(d, 'user-junho', 'deliverable-junho', now).ok).toBe(false);
    expect(requestRecord(createSeed(T0), 'user-jihun', 'deliverable-junho', now).ok).toBe(false); // 기록 있음
    d = must(requestRecord(d, 'user-jihun', 'deliverable-junho', now)).data;
    expect(requestRecord(d, 'user-jihun', 'deliverable-junho', new Date(new Date(now).getTime() + 3600_000).toISOString()).ok).toBe(false);
    expect(requestRecord(d, 'user-jihun', 'deliverable-junho', at(7.5)).ok).toBe(true); // 다음 날
    const inbox = inboxFor(d, u(d, 'user-junho'), at(7)).map((i) => i.kind);
    expect(inbox).toContain('record-request');
  });
});

describe('5단계 수익 기록', () => {
  it('관리자만, 진행 확정·종료 제안만, 금액은 0 이상 정수 또는 미입력', () => {
    let d = createSeed(T0);
    const input = { amount: '150,000', payStatus: 'scheduled' as const, basisOn: '2026-11-08' };
    expect(saveRevenue(d, 'user-jihun', 'proposal-junho-0', input, T0).ok).toBe(false);
    expect(saveRevenue(d, 'user-seoyeon', 'proposal-junho-1', input, T0).ok).toBe(false); // 제안 전달 상태
    expect(saveRevenue(d, 'user-seoyeon', 'proposal-junho-0', { ...input, amount: '-1' }, T0).ok).toBe(false);
    d = must(saveRevenue(d, 'user-seoyeon', 'proposal-junho-0', input, T0)).data;
    expect(d.revenues).toHaveLength(1); // 제안 1건에 하나 (고쳐 쓴다)
    expect(d.revenues[0].amount).toBe(150000);
    const rows = revenuesForMember(d, u(d, 'user-junho'));
    expect(sumRevenue(rows.map((r) => r.record))).toMatchObject({ scheduled: 150000, paid: 0 });
    expect(revenuesForMember(d, u(d, 'user-jihun'))).toEqual([]);
    expect(revenuesForMember(d, u(d, 'user-minji'))).toEqual([]);
    expect(monthlyRevenue(d, u(d, 'user-seoyeon'))).toEqual([{ month: '2026-11', paid: 0, scheduled: 150000 }]);
    expect(monthlyRevenue(d, u(d, 'user-jihun'))).toEqual([]);
  });
});

describe('5단계 화면 접근', () => {
  it('내 성과는 크루원, 크루 성과는 그 크루의 크루장, 크루장 메뉴에만 성과', () => {
    const d = createSeed(T0);
    expect(canOpen(d, u(d, 'user-minji'), { screen: 'my-performance' })).toBe(true);
    expect(canOpen(d, u(d, 'user-jihun'), { screen: 'my-performance' })).toBe(false);
    expect(canOpen(d, u(d, 'user-jihun'), { screen: 'crew-performance', crewId: 'crew-food' })).toBe(true);
    expect(canOpen(d, u(d, 'user-jihun'), { screen: 'crew-performance', crewId: 'crew-food', memberId: 'user-sora' })).toBe(false);
    expect(canOpen(d, u(d, 'user-yujin'), { screen: 'crew-performance', crewId: 'crew-food' })).toBe(false);
    expect(canOpen(d, u(d, 'user-minji'), { screen: 'crew-performance', crewId: 'crew-food' })).toBe(false);
    expect(crewMenu('crew-food', u(d, 'user-jihun')).map((m) => m.label)).toEqual(['크루 홈', '미션', '커뮤니티', '성과']);
    expect(crewMenu('crew-food', u(d, 'user-minji')).map((m) => m.label)).toEqual(['크루 홈', '미션', '커뮤니티']);
    expect(globalMenu(u(d, 'user-minji')).items.map((i) => i.label)).toContain('내 성과');
  });

  it('v4 저장값은 수익·기록 요청만 더해 읽고 처음 저장 직전 backup-v4', () => {
    const kv = createMemoryKv();
    const v4 = createSeed(T0) as Partial<AppData>;
    delete v4.revenues;
    delete v4.recordRequests;
    const raw = JSON.stringify({ schemaVersion: 4, savedAt: T0, data: v4 });
    kv.setItem(DATA_KEY, raw);
    const st = createStorage(kv);
    const loaded = st.load();
    expect(loaded.kind).toBe('ok');
    if (loaded.kind !== 'ok') return;
    expect(loaded.data.revenues).toEqual([]);
    expect(loaded.data.showcases).toHaveLength(1);
    st.save(loaded.data);
    expect(kv.getItem(`${BACKUP_KEY_PREFIX}4`)).toBe(raw);
  });
});
