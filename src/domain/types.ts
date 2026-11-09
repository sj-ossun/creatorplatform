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
  /** ID 생성용 증가 번호 */
  seq: number;
}
