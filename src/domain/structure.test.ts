import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { canOpen, crewMenu, crewOfRoute, globalMenu, HOME, isPublic, type Route } from '../state/routes';
import { getUser } from './queries';

/** v0.4~v0.6 구조의 접근·이동 규칙 (U-01·03·04·06·07 중 화면 밖에서 확인할 수 있는 부분) */
const T0 = '2026-11-09T01:00:00.000Z';
const d = createSeed(T0);
const u = (id: string) => getUser(d, id)!;

describe('v0.4~v0.6 화면 계층과 접근', () => {
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
    expect(labels(globalMenu(u('user-minji')))).toEqual(['내 성과', '내 제안', '이용 가이드']);
    expect(globalMenu(u('user-seoyeon')).crewActivity).toBe(false);
    expect(labels(globalMenu(u('user-seoyeon')))).toEqual(['이용 가이드', '운영 관리']);
    expect(crewMenu('crew-food').map((m) => m.label)).toEqual(['크루 홈', '미션', '커뮤니티']);
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

  it('v0.6 알림 예시(시연 도구): 크루원은 본인 피드백 알림만, 미제출 안내는 크루장·관리자', () => {
    expect(canOpen(d, u('user-jihun'), { screen: 'notifications' })).toBe(true);
    expect(canOpen(d, u('user-seoyeon'), { screen: 'notifications' })).toBe(true);
    expect(canOpen(d, u('user-junho'), { screen: 'notifications' })).toBe(true);
    expect(canOpen(d, u('user-junho'), { screen: 'notifications', tab: 'unsubmitted' })).toBe(false);
    expect(canOpen(d, u('user-junho'), { screen: 'notifications', tab: 'unsubmitted', missionId: 'mission-food-1' })).toBe(false);
    const fb = d.feedbacks[0];
    const del = d.deliverables.find((x) => x.id === fb.deliverableId)!;
    const n = { id: 'n-test', eventId: fb.id, kind: 'feedback' as const, recipientId: del.memberId, missionId: del.missionId, deliverableId: del.id, feedbackId: fb.id, createdAt: T0 };
    const withN = { ...d, notifications: [n] };
    expect(canOpen(withN, u(del.memberId), { screen: 'notifications', notificationId: 'n-test' })).toBe(true);
    expect(canOpen(withN, u(del.memberId === 'user-minji' ? 'user-haneul' : 'user-minji'), { screen: 'notifications', notificationId: 'n-test' })).toBe(false);
    expect(canOpen(d, u('user-jihun'), { screen: 'notifications', tab: 'unsubmitted', missionId: 'mission-beauty-1' })).toBe(false);
  });
});

describe('v0.6 목록 요약', () => {
  it('목표 한 줄: 첫 줄에서 목표 머리말을 뗀다', async () => {
    const { missionGoal } = await import('./views');
    const m = d.missions.find((x) => x.id === 'mission-food-1')!;
    expect(missionGoal(m)).toBe('첫 3초 안에 대표 메뉴가 보이는 60초 이내 숏폼을 만든다.');
    expect(missionGoal({ ...m, criteria: '\n  그냥 기준\n둘째 줄' })).toBe('그냥 기준');
  });
});
