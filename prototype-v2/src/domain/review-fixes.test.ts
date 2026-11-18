import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { createMission, submit, type CommandResult } from './commands';
import { homeStatus, urgentUnsubmitted } from './crewRoom';
import { dueState } from './due';
import { getUser } from './queries';
import { toKstLocal } from './time';
import type { AppData, Mission } from './types';

const T0 = '2026-11-09T01:00:00.000Z';
const at = (min: number) => new Date(new Date(T0).getTime() + min * 60_000).toISOString();
const HOUR = 60;
function must<T>(r: CommandResult<T>) {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
}
const u = (d: AppData, id: string) => getUser(d, id)!;

describe('디자인 검토 1번: 마감 지남 / 마감 임박', () => {
  const m = { dueAt: at(10 * HOUR) } as Mission;
  it('내야 하는 상태에서만, 지났으면 late · 24시간 안이면 soon', () => {
    expect(dueState(m, 'not_submitted', at(11 * HOUR))).toBe('late');
    expect(dueState(m, 'revision_requested', at(11 * HOUR))).toBe('late');
    expect(dueState(m, 'not_submitted', at(-13 * HOUR))).toBe('soon');
    expect(dueState(m, 'not_submitted', at(-15 * HOUR))).toBe(null);
    expect(dueState(m, 'pending_review', at(11 * HOUR))).toBe(null);
    expect(dueState(m, 'completed', at(11 * HOUR))).toBe(null);
  });

  it('크루장 홈 미제출 카드는 지남+임박만 세고, 펼치면 둘로 나뉜다', () => {
    let d = createSeed(T0);
    // 마감 임박 미션 (12시간 뒤) 하나를 더한다
    d = must(createMission(d, 'user-jihun', { title: '임박 미션', criteria: '기준', format: 'link', dueLocal: toKstLocal(at(12 * HOUR)), targetIds: ['user-minji', 'user-junho'] }, at(1))).data;
    d = must(submit(d, 'user-junho', { missionId: d.missions.at(-1)!.id, content: 'https://example.com/v', description: '' }, at(2))).data;
    const now = at(3);
    const urgent = urgentUnsubmitted(d, 'crew-food', now);
    expect(urgent.soon.map((r) => r.memberId)).toEqual(['user-minji']);
    expect(urgent.late.every((r) => r.mission.dueAt <= now)).toBe(true);
    const card = homeStatus(d, u(d, 'user-jihun'), now).find((c) => c.key === 'unsubmitted')!;
    expect(card.value).toBe(urgent.late.length + urgent.soon.length);
    expect(card.hint).toBe(`마감 지남 ${urgent.late.length} · 임박 ${urgent.soon.length}`);
  });
});
