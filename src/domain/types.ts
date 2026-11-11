import type { ReviewResult, SubmissionStatus } from './status';

export type Role = 'member' | 'leader' | 'admin';

export const ROLE_LABEL: Record<Role, string> = {
  member: '크루원',
  leader: '크루장',
  admin: '관리자',
};

export type ID = string;
/** ISO 8601 UTC 문자열. 화면 표시는 항상 Asia/Seoul로 변환한다. */
export type Instant = string;

export interface User {
  id: ID;
  name: string;
  role: Role;
  /** 크루원·크루장의 소속 크루 */
  crewId: ID | null;
  /** 관리자의 담당 크루 */
  managedCrewIds: ID[];
}

export interface Crew {
  id: ID;
  name: string;
  leaderId: ID;
  memberIds: ID[];
  /** 대표 카테고리 1개 (v0.6, 선택 필드). 이전 저장값에는 없을 수 있어 crewProfile 로 읽는다 */
  category?: string;
  /** 크루 소개 (사전 등록, 선택 필드) */
  intro?: string;
}

export type SubmissionFormat = 'text' | 'link';

export interface Mission {
  id: ID;
  crewId: ID;
  title: string;
  criteria: string;
  format: SubmissionFormat;
  dueAt: Instant;
  /** 예시 데이터의 시연용 기한인지 */
  demoDue: boolean;
  createdBy: ID;
  createdAt: Instant;
  /** 생성 시점에 고정한 대상자 */
  targetIds: ID[];
}

/** 미션 × 크루원당 결과물 1개. 최초 제출 때 만든다. */
export interface Deliverable {
  id: ID;
  missionId: ID;
  memberId: ID;
  status: Exclude<SubmissionStatus, 'not_submitted'>;
  latestVersionId: ID;
}

export interface SubmissionVersion {
  id: ID;
  deliverableId: ID;
  number: number;
  /** 텍스트 본문 또는 공유 URL */
  content: string;
  description: string;
  /** 2차부터 필수 */
  changeNote: string;
  submittedAt: Instant;
  late: boolean;
}

export interface Feedback {
  id: ID;
  deliverableId: ID;
  versionId: ID;
  result: ReviewResult;
  comment: string;
  authorId: ID;
  createdAt: Instant;
}

export interface NotificationExample {
  id: ID;
  /** 알림을 만든 이벤트(피드백) ID. 같은 이벤트로 두 개를 만들지 않는다. */
  eventId: ID;
  kind: 'feedback';
  recipientId: ID;
  missionId: ID;
  deliverableId: ID;
  feedbackId: ID;
  createdAt: Instant;
}

/** 실제 게시물 (F-07). 완료된 결과물당 1개. 날짜는 한국 시간 기준 YYYY-MM-DD */
export interface Post {
  id: ID;
  deliverableId: ID;
  platform: string;
  url: string;
  publishedOn: string;
  createdAt: Instant;
  updatedAt: Instant;
}

/** 성과 관찰 기록. 같은 게시물·같은 확인일은 하나만 둔다. 조회수 null 은 미집계 */
export interface Observation {
  id: ID;
  postId: ID;
  checkedOn: string;
  views: number | null;
  retrospective: string;
  source: 'manual';
  createdAt: Instant;
  updatedAt: Instant;
}

export const PROPOSAL_STATUSES = ['preparing', 'delivered', 'negotiating', 'confirmed', 'on_hold', 'closed'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  preparing: '제안 준비',
  delivered: '제안 전달',
  negotiating: '협의 중',
  confirmed: '진행 확정',
  on_hold: '보류',
  closed: '종료',
};
export type ProposalKind = 'ad' | 'commerce';
export const PROPOSAL_KIND_LABEL: Record<ProposalKind, string> = { ad: '광고', commerce: '커머스' };

export interface ProposalStatusChange {
  /** 최초 등록은 null */
  from: ProposalStatus | null;
  to: ProposalStatus;
  by: ID;
  at: Instant;
}

/** 광고·커머스 제안 이력 (F-09). 관리자 전용. 저장은 발송이 아니다 */
export interface Proposal {
  id: ID;
  creatorId: ID;
  proposedOn: string;
  owner: string;
  kind: ProposalKind;
  brand: string;
  content: string;
  status: ProposalStatus;
  internalMemo: string;
  createdBy: ID;
  createdAt: Instant;
  history: ProposalStatusChange[];
}

export type CommunityKind = 'notice' | 'question';
export const COMMUNITY_KIND_LABEL: Record<CommunityKind, string> = { notice: '공지', question: '질문' };

/** 크루 소통 글 (F-10). 같은 크루에 공개. 관련 미션은 대상자·담당 크루장만 연다 */
export interface CommunityPost {
  id: ID;
  crewId: ID;
  kind: CommunityKind;
  title: string;
  body: string;
  missionId: ID | null;
  authorId: ID;
  createdAt: Instant;
}

export interface CommunityComment {
  id: ID;
  postId: ID;
  authorId: ID;
  body: string;
  createdAt: Instant;
}

export interface AppData {
  /** 최초 실행·초기화 시각. 새로고침 때 바뀌지 않는다. */
  seededAt: Instant;
  users: User[];
  crews: Crew[];
  missions: Mission[];
  deliverables: Deliverable[];
  versions: SubmissionVersion[];
  feedbacks: Feedback[];
  notifications: NotificationExample[];
  posts: Post[];
  observations: Observation[];
  proposals: Proposal[];
  communityPosts: CommunityPost[];
  comments: CommunityComment[];
  /** ID 생성용 증가 번호 */
  seq: number;
}
