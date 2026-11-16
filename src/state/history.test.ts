import { describe, expect, it } from 'vitest';
import { HISTORY_MAX, HOME, isFormRoute, pageKey, popHistory, pushHistory, type Route } from './routes';

/** E2 '이전 페이지' 기록 규칙 */
describe('E2 이전 페이지 기록', () => {
  const crew: Route = { screen: 'crew', crewId: 'crew-food' };
  const missions: Route = { screen: 'missions', crewId: 'crew-food' };
  const all = () => true;

  it('다른 페이지로 가면 쌓고, 같은 페이지 안의 조회 조건만 바뀌면 쌓지 않는다', () => {
    expect(pushHistory([], HOME, crew)).toEqual([HOME]);
    const ov: Route = { screen: 'overview' };
    const filtered: Route = { screen: 'overview', filter: { crewId: 'crew-food', from: '', to: '', missionId: '' } };
    expect(pushHistory([], ov, filtered)).toEqual([]);
    expect(pushHistory([], { screen: 'board' }, { screen: 'board', questionsOnly: true })).toEqual([]);
    // 운영 관리 왼쪽 메뉴·게시글 열기는 다른 페이지
    expect(pushHistory([], ov, { screen: 'overview', view: 'offers' })).toHaveLength(1);
    expect(pushHistory([], { screen: 'board' }, { screen: 'board', postId: 'p1' })).toHaveLength(1);
    expect(pageKey({ screen: 'board', postId: undefined })).toBe(pageKey({ screen: 'board' }));
  });

  it(`기록은 최근 ${HISTORY_MAX}개까지`, () => {
    let h: Route[] = [];
    for (let i = 0; i < HISTORY_MAX + 5; i++) h = pushHistory(h, { screen: 'mission', missionId: `m${i}` }, { screen: 'mission', missionId: `m${i + 1}` });
    expect(h).toHaveLength(HISTORY_MAX);
  });

  it('돌아갈 때 쓰기·고치기·로그인 화면과 열 수 없는 화면은 건너뛰고, 없으면 홈', () => {
    const writing: Route = { screen: 'board', writing: true };
    const detail: Route = { screen: 'board', postId: 'p1' };
    expect(isFormRoute(writing)).toBe(true);
    expect(isFormRoute({ screen: 'mission-create', crewId: 'c' })).toBe(true);
    expect(isFormRoute({ screen: 'overview', view: 'offers', offerId: 'new' })).toBe(true);
    expect(isFormRoute(detail)).toBe(false);
    // 목록 → 글쓰기 → (저장) 글 → 이전: 글쓰기를 건너뛰고 목록
    expect(popHistory([{ screen: 'board' }, writing], detail, all)).toEqual({ target: { screen: 'board' }, rest: [] });
    // 열 수 없는 화면은 건너뛴다
    expect(popHistory([crew, missions], HOME, (r) => r.screen !== 'missions').target).toEqual(crew);
    expect(popHistory([], crew, all)).toEqual({ target: HOME, rest: [] });
    expect(popHistory([{ screen: 'login' }], crew, all).target).toEqual(HOME);
  });
});
