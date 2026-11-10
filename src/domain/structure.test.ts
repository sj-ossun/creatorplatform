import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { canOpen, crewMenu, crewOfRoute, globalMenu, startRoute } from '../state/routes';
import { getUser } from './queries';

/** v0.4 구조 개편의 접근·이동 규칙 (U-01·03·04·06·07 중 화면 밖에서 확인할 수 있는 부분) */
const T0 = '2026-11-09T01:00:00.000Z';
const d = createSeed(T0);
const u = (id: string) => getUser(d, id)!;

describe('v0.4 화면 계층과 접근', () => {
  it('시작 화면: 크루장·크루원은 서비스 홈, 관리자는 운영 관리', () => {
    expect(startRoute(u('user-minji'))).toEqual({ screen: 'home' });
    expect(startRoute(u('user-jihun'))).toEqual({ screen: 'home' });
    expect(startRoute(u('user-seoyeon'))).toEqual({ screen: 'overview' });
  });

  it('전역 메뉴: 홈·내 크루 / 관리자는 운영 관리만. 퀵 리뷰·알림 미리보기는 전역 메뉴에 없다', () => {
    expect(globalMenu(u('user-jihun')).map((m) => m.label)).toEqual(['홈', '내 크루']);
    expect(globalMenu(u('user-seoyeon')).map((m) => m.label)).toEqual(['운영 관리']);
    expect(crewMenu('crew-food').map((m) => m.label)).toEqual(['크루 홈', '미션', '소통']);
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
