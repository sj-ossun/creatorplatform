import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { canOpen } from '../state/routes';
import { createMission, type CommandResult } from './commands';
import { inboxFor } from './inbox';
import { editMission } from './missionEdit';
import { getUser, statusOf } from './queries';
import { completedMissionRows } from './stats';
import { toKstLocal } from './time';
import type { AppData } from './types';

const T0 = '2026-11-09T01:00:00.000Z';
const at = (min: number) => new Date(new Date(T0).getTime() + min * 60_000).toISOString();
const DAY = 24 * 60;
function must<T>(r: CommandResult<T>) {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
}
const u = (d: AppData, id: string) => getUser(d, id)!;

function withMission() {
  let d = createSeed(T0);
  const due = toKstLocal(at(3 * DAY));
  const r = must(createMission(d, 'user-jihun', { title: '메뉴 한 컷', criteria: '대표 메뉴 한 컷', format: 'link', dueLocal: due, targetIds: ['user-minji'] }, at(1)));
  d = r.data;
  return { d, m: r.value, due };
}

describe('E4 크루장 미션 고치기', () => {
  it('그 크루 크루장만, 제목·기준 필수, 바뀐 것이 없으면 저장하지 않는다', () => {
    const { d, m, due } = withMission();
    const same = { title: m.title, criteria: m.criteria, dueLocal: due, addTargetIds: [] };
    expect(editMission(d, 'user-yujin', m.id, { ...same, title: 'x' }, at(2)).ok).toBe(false); // 다른 크루 크루장
    expect(editMission(d, 'user-minji', m.id, { ...same, title: 'x' }, at(2)).ok).toBe(false);
    const empty = editMission(d, 'user-jihun', m.id, { ...same, title: ' ', criteria: '' }, at(2));
    expect(!empty.ok && empty.errors.title && empty.errors.criteria).toBeTruthy();
    expect(editMission(d, 'user-jihun', m.id, same, at(2)).ok).toBe(false);
  });

  it('마감은 앞당길 수 있지만 지난 일시로는 안 된다. 바꾸면 이력과 대상자 알림', () => {
    const { d, m, due } = withMission();
    const base = { title: m.title, criteria: m.criteria, dueLocal: due, addTargetIds: [] };
    expect(editMission(d, 'user-jihun', m.id, { ...base, dueLocal: toKstLocal(at(-60)) }, at(2)).ok).toBe(false);
    const earlier = must(editMission(d, 'user-jihun', m.id, { ...base, dueLocal: toKstLocal(at(2 * DAY)) }, at(2)));
    const later = must(editMission(earlier.data, 'user-jihun', m.id, { ...base, criteria: '대표 메뉴 한 컷 + 가게 간판', dueLocal: toKstLocal(at(5 * DAY)) }, at(3)));
    const mm = later.value;
    expect(mm.revisions).toHaveLength(2);
    expect(mm.revisions![1].changes.map((c) => c.field)).toEqual(['criteria', 'dueAt']);
    expect(mm.revisions![1].changes[0].before).toBe('대표 메뉴 한 컷');
    const items = inboxFor(later.data, u(later.data, 'user-minji'), at(4)).filter((i) => i.id.startsWith(`mission-edit-${m.id}`));
    expect(items).toHaveLength(2);
    expect(items.some((i) => i.text.includes('내용이 바뀌었어요') && i.text.includes('마감') && i.text.includes('목표·기준'))).toBe(true);
  });

  it('대상자는 더하기만: 더한 사람은 그 시각에 새 미션 배정 알림, 그 전 수정 알림은 받지 않는다', () => {
    const { d, m, due } = withMission();
    const base = { title: m.title, criteria: m.criteria, dueLocal: due, addTargetIds: [] };
    let x = must(editMission(d, 'user-jihun', m.id, { ...base, title: '메뉴 한 컷 썸네일' }, at(2))).data;
    x = must(editMission(x, 'user-jihun', m.id, { ...base, title: '메뉴 한 컷 썸네일', addTargetIds: ['user-junho', 'user-minji', 'user-sora'] }, at(3))).data;
    const mm = x.missions.find((y) => y.id === m.id)!;
    expect(mm.targetIds).toEqual(['user-minji', 'user-junho']); // 이미 있는 사람·다른 크루는 무시
    const junho = inboxFor(x, u(x, 'user-junho'), at(4)).filter((i) => i.target.screen === 'mission' && 'missionId' in i.target && i.target.missionId === m.id);
    expect(junho.map((i) => [i.text, i.at])).toEqual([['새 미션 ‘메뉴 한 컷 썸네일’이 배정됐어요.', at(3)]]);
    expect(statusOf(x, m.id, 'user-junho')).toBe('not_submitted');
  });

  it('크루장만 고치기 화면을 연다', () => {
    const { d, m } = withMission();
    expect(canOpen(d, u(d, 'user-jihun'), { screen: 'mission', missionId: m.id, editing: true })).toBe(true);
    expect(canOpen(d, u(d, 'user-minji'), { screen: 'mission', missionId: m.id, editing: true })).toBe(false);
  });
});

describe('E4 내 성과 완료한 미션', () => {
  it('완료한 미션만, 게시 기록이 없는 것부터', () => {
    const d = createSeed(T0);
    for (const id of ['user-minji', 'user-junho', 'user-haneul']) {
      const rows = completedMissionRows(d, u(d, id), at(1));
      expect(rows.every((r) => statusOf(d, r.mission.id, id) === 'completed')).toBe(true);
      const firstPosted = rows.findIndex((r) => r.posted);
      if (firstPosted >= 0) expect(rows.slice(firstPosted).some((r) => !r.posted)).toBe(false);
    }
  });
});
