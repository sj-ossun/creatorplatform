import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { canEditSubmission, createMission, EDIT_ERR, editSubmission, FORM_ERROR, review, submit, type CommandResult } from './commands';
import { deliverableOf, versionsOf } from './queries';
import { toKstLocal } from './time';

const T0 = '2026-11-09T01:00:00.000Z';
const at = (min: number) => new Date(new Date(T0).getTime() + min * 60_000).toISOString();
const DAY = 24 * 60;
function must<T>(r: CommandResult<T>) {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
}
const L1 = 'https://youtube.com/shorts/fRQSKnSIRcY';
const L2 = 'https://youtube.com/shorts/Qx81bNw2tYk';

function submitted() {
  let d = createSeed(T0);
  const m = must(createMission(d, 'user-jihun', { title: '메뉴 한 컷', criteria: '대표 메뉴 한 컷', format: 'link', dueLocal: toKstLocal(at(3 * DAY)), targetIds: ['user-minji'] }, at(1)));
  d = m.data;
  d = must(submit(d, 'user-minji', { missionId: m.value.id, content: L1, description: '처음', changeNote: '' }, at(10))).data;
  return { d, mission: m.value };
}

describe('검토 전 제출물 수정 (2026-11-18 확정)', () => {
  it('검토 대기·마감 전이면 같은 차수 안에서 고치고, 고치기 전 내용을 남긴다', () => {
    const { d, mission } = submitted();
    expect(canEditSubmission(d, 'user-minji', mission.id, at(20))).toBe(true);
    const r = must(editSubmission(d, 'user-minji', { missionId: mission.id, content: L2, description: '고침', changeNote: '' }, at(30)));
    const vs = versionsOf(r.data, deliverableOf(r.data, mission.id, 'user-minji')!.id);
    expect(vs).toHaveLength(1);
    expect(vs[0]).toMatchObject({ number: 1, content: L2, description: '고침', submittedAt: at(10), late: false });
    expect(vs[0].edits).toEqual([{ at: at(30), content: L1, description: '처음', changeNote: '' }]);
  });
  it('바뀐 것이 없으면 저장하지 않는다 · 형식 오류는 제출과 같은 규칙', () => {
    const { d, mission } = submitted();
    const same = editSubmission(d, 'user-minji', { missionId: mission.id, content: ` ${L1} `, description: '처음', changeNote: '' }, at(30));
    expect(!same.ok && same.errors[FORM_ERROR]).toBe(EDIT_ERR.same);
    const bad = editSubmission(d, 'user-minji', { missionId: mission.id, content: '링크 아님', description: '', changeNote: '' }, at(30));
    expect(!bad.ok && bad.errors.content).toBeTruthy();
  });
  it('마감이 지나면 고칠 수 없다 (사용자 결정 (나))', () => {
    const { d, mission } = submitted();
    expect(canEditSubmission(d, 'user-minji', mission.id, at(4 * DAY))).toBe(false);
    const r = editSubmission(d, 'user-minji', { missionId: mission.id, content: L2, description: '', changeNote: '' }, at(4 * DAY));
    expect(!r.ok && r.errors[FORM_ERROR]).toBe(EDIT_ERR.late);
  });
  it('크루장이 처리하면 고칠 수 없고, 다른 사람은 고칠 수 없다', () => {
    const { d, mission } = submitted();
    const v = versionsOf(d, deliverableOf(d, mission.id, 'user-minji')!.id)[0];
    const done = must(review(d, 'user-jihun', { deliverableId: v.deliverableId, versionId: v.id, result: 'completed', comment: '' }, at(40))).data;
    expect(canEditSubmission(done, 'user-minji', mission.id, at(50))).toBe(false);
    const r = editSubmission(done, 'user-minji', { missionId: mission.id, content: L2, description: '', changeNote: '' }, at(50));
    expect(!r.ok && r.errors[FORM_ERROR]).toBe(EDIT_ERR.notPending);
    expect(editSubmission(d, 'user-junho', { missionId: mission.id, content: L2, description: '', changeNote: '' }, at(50)).ok).toBe(false);
  });
  it('크루장이 검토 칸을 연 뒤 크루원이 고치면 저장을 막는다', () => {
    const { d, mission } = submitted();
    const v = versionsOf(d, deliverableOf(d, mission.id, 'user-minji')!.id)[0];
    const edited = must(editSubmission(d, 'user-minji', { missionId: mission.id, content: L2, description: '', changeNote: '' }, at(30))).data;
    const r = review(edited, 'user-jihun', { deliverableId: v.deliverableId, versionId: v.id, result: 'completed', comment: '', seenEdits: 0 }, at(40));
    expect(!r.ok && r.errors[FORM_ERROR]).toBe(EDIT_ERR.conflict);
    expect(review(edited, 'user-jihun', { deliverableId: v.deliverableId, versionId: v.id, result: 'completed', comment: '', seenEdits: 1 }, at(41)).ok).toBe(true);
  });
});
