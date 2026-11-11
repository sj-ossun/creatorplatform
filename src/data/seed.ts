/**
 * 재현 가능한 예시 데이터 (명세 7.1).
 * 최초 실행 또는 명시적 초기화에서만 호출한다. 렌더링·새로고침에서 다시 만들지 않는다.
 * 모두 가상 인물이며 실제 계정·수익 자료가 아니다.
 */
import { CREW_PRESETS } from '../domain/crewProfile';
import { todayKst } from '../domain/time';
import type { AppData, Instant } from '../domain/types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function createSeed(now: Instant = new Date().toISOString()): AppData {
  const t = new Date(now).getTime();
  const at = (offsetMs: number) => new Date(t + offsetMs).toISOString();

  return {
    seededAt: now,
    seq: 100,
    crews: [
      {
        id: 'crew-food',
        name: '푸드 A',
        leaderId: 'user-jihun',
        memberIds: ['user-jihun', 'user-minji', 'user-junho', 'user-haneul'],
        category: CREW_PRESETS['crew-food'].category,
        intro: CREW_PRESETS['crew-food'].intro,
      },
      {
        id: 'crew-beauty',
        name: '뷰티 B',
        leaderId: 'user-yujin',
        memberIds: ['user-yujin', 'user-sora', 'user-yuna'],
        category: CREW_PRESETS['crew-beauty'].category,
        intro: CREW_PRESETS['crew-beauty'].intro,
      },
    ],
    users: [
      { id: 'user-minji', name: '민지', role: 'member', crewId: 'crew-food', managedCrewIds: [] },
      { id: 'user-junho', name: '준호', role: 'member', crewId: 'crew-food', managedCrewIds: [] },
      { id: 'user-haneul', name: '하늘', role: 'member', crewId: 'crew-food', managedCrewIds: [] },
      { id: 'user-sora', name: '소라', role: 'member', crewId: 'crew-beauty', managedCrewIds: [] },
      { id: 'user-yuna', name: '유나', role: 'member', crewId: 'crew-beauty', managedCrewIds: [] },
      { id: 'user-jihun', name: '지훈', role: 'leader', crewId: 'crew-food', managedCrewIds: [] },
      { id: 'user-yujin', name: '유진', role: 'leader', crewId: 'crew-beauty', managedCrewIds: [] },
      { id: 'user-seoyeon', name: '서연', role: 'admin', crewId: null, managedCrewIds: ['crew-food', 'crew-beauty'] },
    ],
    missions: [
      {
        id: 'mission-food-1',
        crewId: 'crew-food',
        title: '동네 맛집 첫 장면 숏폼',
        criteria:
          '목표: 첫 3초 안에 대표 메뉴가 보이는 60초 이내 숏폼을 만든다.\n제출 기준: 첫 장면에 메뉴가 보일 것, 가게 이름과 위치를 자막으로 넣을 것, 검토용 영상 공유 링크로 제출할 것.',
        format: 'link',
        // 시연용 기한: 생성 기준 시각보다 이전
        dueAt: at(-1 * DAY),
        demoDue: true,
        createdBy: 'user-jihun',
        createdAt: at(-7 * DAY),
        targetIds: ['user-minji', 'user-junho', 'user-haneul'],
      },
      {
        id: 'mission-beauty-1',
        crewId: 'crew-beauty',
        title: '데일리 메이크업 60초 릴스',
        criteria:
          '목표: 출근 전 10분 메이크업 과정을 60초 릴스로 정리한다.\n제출 기준: 사용 제품을 자막으로 표시할 것, 마지막 장면에 완성 모습을 보여줄 것, 검토용 영상 공유 링크로 제출할 것.',
        format: 'link',
        dueAt: at(-1 * DAY),
        demoDue: true,
        createdBy: 'user-yujin',
        createdAt: at(-7 * DAY),
        targetIds: ['user-sora', 'user-yuna'],
      },
    ],
    deliverables: [
      { id: 'deliverable-junho', missionId: 'mission-food-1', memberId: 'user-junho', status: 'completed', latestVersionId: 'version-junho-1' },
      { id: 'deliverable-sora', missionId: 'mission-beauty-1', memberId: 'user-sora', status: 'pending_review', latestVersionId: 'version-sora-1' },
    ],
    versions: [
      {
        id: 'version-junho-1',
        deliverableId: 'deliverable-junho',
        number: 1,
        content: 'https://example.com/share/junho-food-v1',
        description: '을지로 국숫집. 첫 장면에 비빔국수를 바로 보여줬어요.',
        changeNote: '',
        submittedAt: at(-3 * DAY),
        late: false,
      },
      {
        id: 'version-sora-1',
        deliverableId: 'deliverable-sora',
        number: 1,
        content: 'https://example.com/share/sora-makeup-v1',
        description: '쿠션·아이브로우·립 세 단계로 나눴어요.',
        changeNote: '',
        submittedAt: at(-2 * DAY),
        late: false,
      },
    ],
    feedbacks: [
      {
        id: 'feedback-junho-1',
        deliverableId: 'deliverable-junho',
        versionId: 'version-junho-1',
        result: 'completed',
        comment: '첫 장면에서 메뉴가 바로 보여서 좋아요. 가게 위치 자막도 기준에 맞아요.',
        authorId: 'user-jihun',
        createdAt: at(-2 * DAY - 4 * HOUR),
      },
    ],
    notifications: [
      {
        id: 'notification-junho-1',
        eventId: 'feedback-junho-1',
        kind: 'feedback',
        recipientId: 'user-junho',
        missionId: 'mission-food-1',
        deliverableId: 'deliverable-junho',
        feedbackId: 'feedback-junho-1',
        createdAt: at(-2 * DAY - 4 * HOUR),
      },
    ],
    // 우수 사례·내 제안을 시연하기 위한 예시 (모두 가상)
    posts: [
      {
        id: 'post-junho-1',
        deliverableId: 'deliverable-junho',
        platform: '유튜브',
        url: 'https://youtube.example/shorts/junho-noodle',
        publishedOn: todayKst(at(-2 * DAY)),
        createdAt: at(-2 * DAY),
        updatedAt: at(-2 * DAY),
      },
    ],
    observations: [
      {
        id: 'observation-junho-1',
        postId: 'post-junho-1',
        checkedOn: todayKst(at(-1 * DAY)),
        views: 1240,
        retrospective: '첫 장면을 바꾼 뒤 끝까지 본 비율이 늘었어요.',
        source: 'manual',
        createdAt: at(-1 * DAY),
        updatedAt: at(-1 * DAY),
      },
    ],
    proposals: [
      {
        id: 'proposal-junho-1',
        creatorId: 'user-junho',
        proposedOn: todayKst(at(-1 * DAY)),
        owner: '서연',
        kind: 'commerce',
        brand: '동네 분식 밀키트 (가상)',
        content: '비빔국수 밀키트 조리 과정을 숏폼 1편으로 소개하는 커머스 제안이에요.',
        status: 'delivered',
        internalMemo: '단가는 다음 주 협의 예정',
        createdBy: 'user-seoyeon',
        createdAt: at(-1 * DAY),
        history: [
          { from: null, to: 'preparing', by: 'user-seoyeon', at: at(-1 * DAY - 2 * HOUR) },
          { from: 'preparing', to: 'delivered', by: 'user-seoyeon', at: at(-1 * DAY) },
        ],
      },
    ],
    communityPosts: [],
    showcases: [
      {
        id: 'showcase-junho-1',
        deliverableId: 'deliverable-junho',
        comment: '첫 3초에 비빔국수가 바로 보여 끝까지 보게 되는 영상이에요.',
        authorId: 'user-jihun',
        createdAt: at(-1 * DAY + HOUR),
      },
    ],
    readMarks: {},
    comments: [],
  };
}
