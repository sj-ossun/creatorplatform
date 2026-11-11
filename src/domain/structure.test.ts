import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { canOpen, crewMenu, crewOfRoute, globalMenu, HOME, isPublic, type Route } from '../state/routes';
import { getUser } from './queries';

/** v0.4~v0.6 구조의 접근·이동 규칙 (U-01·03·04·06·07 중 화면 밖에서 확인할 수 있는 부분) */
const T0 = '2026-11-09T01:00:00.000Z';
const d = createSeed(T0);
const u = (id: string) => getUser(d, id)!;

describe('v0.4 화면 계층과 접근', () => {
  it('v0.6: 로그인·로그아웃 도착지는 역할과 관계없이 홈, 홈은 관리자도 연다', () => {
    expect(HOME).toEqual({ screen: 'home' });
    for (const id of ['user-minji', 'user-jihun', 'user-seoyeon']) expect(canOpen(d, u(id), HOME)).toBe(true);
  });

  it('v0.6 전역 메뉴: 비로그인·크루원·크루장은 크루 활동 + 이용 가이드, 관리자는 이용 가이드 + 운영 관리', () => {
    const labels = (m: ReturnType<typeof globalMenu>) => m.items.map((x) => x.label);
    expect(globalMenu(null).crewActivity).toBe(true);
    expect(globalMenu(null).crewId).toBeNull();
    expect(labels(globalMenu(null))).toEqual(['이용 가이드']);
    expect(globalMenu(u('user-jihun')).crewId).toBe('crew-food');
    expect(labels(globalMenu(u('user-minji')))).toEqual(['이용 가이드']);
    expect(globalMenu(u('user-seoyeon')).crewActivity).toBe(false);
    expect(labels(globalMenu(u('user-seoyeon')))).toEqual(['이용 가이드', '운영 관리']);
    expect(crewMenu('crew-food').map((m) => m.label)).toEqual(['크루 홈', '미션', '소통']);
  });

  it('v0.6 공개·보호 경계: 비로그인은 홈·로그인·가이드만 연다 (N-03)', () => {
    const open: Route[] = [{ screen: 'home' }, { screen: 'login' }, { screen: 'guide' }];
    for (const r of open) {
      expect(isPublic(r)).toBe(true);
      expect(canOpen(d, null, r)).toBe(true);
    }
    const closed: Route[] = [
      { screen: 'crew', crewId: 'crew-food' },
      { screen: 'missions', crewId: 'crew-food' },
      { screen: 'mission', missionId: 'mission-food-1' },
      { screen: 'review', missionId: 'mission-food-1' },
      { screen: 'mission-create', crewId: 'crew-food' },
      { screen: 'community', crewId: 'crew-food' },
      { screen: 'overview' },
      { screen: 'notifications' },
    ];
    for (const r of closed) expect(canOpen(d, null, r)).toBe(false);
  });

  it('v0.6 요청 목적지: 피드백 연결은 받는 크루원만 열 수 있다 (다른 계정이면 버튼을 만들지 않는다)', () => {
    const fb = d.feedbacks[0];
    const del = d.deliverables.find((x) => x.id === fb.deliverableId)!;
    const target: Route = { screen: 'mission', missionId: del.missionId, feedbackId: fb.id };
    expect(canOpen(d, u(del.memberId), target)).toBe(true);
    const other = d.users.find((x) => x.role === 'member' && x.id !== del.memberId && x.crewId === u(del.memberId).crewId)!;
    expect(canOpen(d, other, target)).toBe(false);
    expect(canOpen(d, u('user-jihun'), target)).toBe(false);
    expect(canOpen(d, u('user-seoyeon'), target)).toBe(false);
  });

  it('크루 공간은 자기 크루만 연다 (화면 직접 이동 포함)', () => {
    expect(canOpen(d, u('user-minji'), { screen: 'crew', crewId: 'crew-food' })).toBe(true);
    expect(canOpen(d, u('user-minji'), { screen: 'crew', crewId: 'crew-beauty' })).toBe(false);
    expect(canOpen(d, u('user-sora'), { screen: 'missions', crewId: 'crew-food' })).toBe(false);
    expect(canOpen(d, u('user-seoyeon'), { screen: 'crew', crewId: 'crew-food' })).toBe(false);
    expect(canOpen(d, u('user-minji'), { screen: 'mission-create', crewId: 'crew-food' })).toBe(false);
    expect(canOpen(d, u('user-jihun'), { screen: 'mission-create', crewId: 'crew-food' })).toBe(true);
  });

  it('퀵 리뷰는 담당 크루장이 유효한 미션 ID 로만 연다', () => {
    expect(canOpen(d, u('user-jihun'), { screen: 'review', missionId: 'mission-food-1' })).toBe(true);
    expect(canOpen(d, u('user-jihun'), { screen: 'review', missionId: 'mission-beauty-1' })).toBe(false);
    expect(canOpen(d, u('user-jihun'), { screen: 'review', missionId: 'no-such-mission' })).toBe(false);
    expect(canOpen(d, u('user-minji'), { screen: 'review', missionId: 'mission-food-1' })).toBe(false);
    expect(canOpen(d, u('user-seoyeon'), { screen: 'review', missionId: 'mission-food-1' })).toBe(false);
    expect(canOpen(d, u('user-jihun'), { screen: 'review', missionId: 'mission-food-1', memberId: 'user-sora' })).toBe(false);
  });

  it('미션 상세·퀵 리뷰는 미션의 크루를 맥락으로 가진다', () => {
    expect(crewOfRoute(d, { screen: 'review', missionId: 'mission-beauty-1' })).toBe('crew-beauty');
    expect(crewOfRoute(d, { screen: 'mission', missionId: 'mission-food-1' })).toBe('crew-food');
    expect(crewOfRoute(d, { screen: 'home' })).toBeNull();
  });

  it('알림 미리보기(시연 도구)는 크루장·관리자만, 크루원은 열 수 없다', () => {
    expect(canOpen(d, u('user-jihun'), { screen: 'notifications' })).toBe(true);
    expect(canOpen(d, u('user-seoyeon'), { screen: 'notifications' })).toBe(true);
    expect(canOpen(d, u('user-minji'), { screen: 'notifications' })).toBe(false);
    expect(canOpen(d, u('user-jihun'), { screen: 'notifications', tab: 'unsubmitted', missionId: 'mission-beauty-1' })).toBe(false);
  });
});
