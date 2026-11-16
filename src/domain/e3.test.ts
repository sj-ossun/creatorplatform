import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { canOpen } from '../state/routes';
import { updateAdminNotice } from './adminNotices';
import type { CommandResult } from './commands';
import { createCommunityPost } from './community';
import { adminHomeNotices } from './crewRoom';
import { inboxFor } from './inbox';
import { getUser } from './queries';
import type { AppData } from './types';

const T0 = '2026-11-09T01:00:00.000Z';
const at = (min: number) => new Date(new Date(T0).getTime() + min * 60_000).toISOString();
function must<T>(r: CommandResult<T>) {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r;
}
const u = (d: AppData, id: string) => getUser(d, id)!;

describe('E3 운영 공지 고치기 · 관리자 홈 공지사항', () => {
  it('관리자만 제목·내용을 고치고, 고치면 받는 크루 알림함에 수정 알림이 다시 간다', () => {
    let d = createSeed(T0);
    expect(updateAdminNotice(d, 'user-jihun', 'admin-notice-1', { title: '새 제목', body: '새 내용' }, at(1)).ok).toBe(false);
    const same = d.adminNotices.find((n) => n.id === 'admin-notice-1')!;
    expect(updateAdminNotice(d, 'user-seoyeon', 'admin-notice-1', { title: same.title, body: same.body }, at(1)).ok).toBe(false); // 바뀐 것 없음
    expect(updateAdminNotice(d, 'user-seoyeon', 'admin-notice-1', { title: ' ', body: 'b' }, at(1)).ok).toBe(false);
    d = must(updateAdminNotice(d, 'user-seoyeon', 'admin-notice-1', { title: '11월 광고 제안 응답 안내 (기한 변경)', body: '3일 안에 답해 주세요.' }, at(2))).data;
    const n = d.adminNotices.find((x) => x.id === 'admin-notice-1')!;
    expect(n.updatedAt).toBe(at(2));
    expect(n.crewIds).toEqual(same.crewIds); // 보여줄 크루는 그대로
    const member = n.crewIds[0] === 'crew-food' ? 'user-minji' : 'user-sora';
    const items = inboxFor(d, u(d, member), at(3)).filter((i) => i.kind === 'admin-notice');
    expect(items.some((i) => i.text === '운영 공지 ‘11월 광고 제안 응답 안내 (기한 변경)’이 수정됐어요.' && i.at === at(2))).toBe(true);
  });

  it('관리자 홈 공지사항은 담당 크루 전체의 운영 공지 + 크루장 공지 최신 2건, 어느 크루인지 함께', () => {
    let d = createSeed(T0);
    d = must(createCommunityPost(d, 'user-jihun', { kind: 'notice', title: '이번 주 촬영 팁 모음', body: '본문', missionId: '' }, at(5))).data;
    const list = adminHomeNotices(d, u(d, 'user-seoyeon'), 2);
    expect(list[0]).toMatchObject({ source: 'crew', title: '이번 주 촬영 팁 모음', crewId: 'crew-food' });
    expect(list.length).toBeLessThanOrEqual(2);
    expect(list.every((x) => x.crewLabel)).toBe(true);
    expect(list.map((x) => x.at)).toEqual([...list.map((x) => x.at)].sort().reverse());
    const all = adminHomeNotices(d, u(d, 'user-seoyeon'), 10);
    expect(new Set(all.map((x) => x.source))).toEqual(new Set(['crew', 'admin']));
  });

  it('관리자는 담당 크루 공지를 크루 화면 그대로 읽기만 한다 (쓰기·고치기·다른 크루는 안 됨)', () => {
    const d = createSeed(T0);
    const admin = u(d, 'user-seoyeon');
    const crewId = admin.managedCrewIds[0];
    expect(canOpen(d, admin, { screen: 'notice', crewId })).toBe(true);
    expect(canOpen(d, admin, { screen: 'notice', crewId, writing: true })).toBe(false);
    expect(canOpen(d, admin, { screen: 'notice', crewId: 'crew-none' })).toBe(false);
    const notice = d.adminNotices.find((n) => n.crewIds.includes(crewId))!;
    expect(canOpen(d, admin, { screen: 'notice', crewId, adminNoticeId: notice.id })).toBe(true);
  });
});
