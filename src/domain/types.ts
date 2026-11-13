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
  /** 크루 소개 (사전 등록, 선택 필드). 6-C: 공개 '크루 둘러보기'에 보이며 관리자만 고친다 */
  intro?: string;
  /** 6-C: 활동 키워드 (최대 3개, 관리자만 고친다) */
  keywords?: string[];
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
/** 광고 형식 (6-B, 사용자 결정): 브랜디드 콘텐츠 / 커머스 / 공동구매. 이전 '광고'(ad)는 브랜디드 콘텐츠로 본다 */
export type ProposalKind = 'ad' | 'commerce' | 'group_buy';
export const PROPOSAL_KIND_LABEL: Record<ProposalKind, string> = { ad: '브랜디드 콘텐츠', commerce: '커머스', group_buy: '공동구매' };

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
  /** 6-B: 보낸 제안을 수락해 생긴 진행 기록이면 그 제안 ID. 없으면 이전 방식의 기록 */
  offerId?: ID;
}

/**
 * 광고 제안 (6-B, 사용자 결정). 관리자가 크루원 여러 명 또는 크루장 여러 명에게 보낸다 (한 제안에 섞지 않음).
 * 받는 사람별로 수락·거절한다. 실제 진행·계약·정산은 플랫폼 밖. 수락하면 받는 크루원별 진행 기록(Proposal)이 생긴다.
 */
export interface Offer {
  id: ID;
  brand: string;
  product: string;
  category: string;
  description: string;
  format: ProposalKind;
  /** 원 단위 0 이상 정수 */
  price: number;
  /** 희망 업로드 일자 (한국 시간 YYYY-MM-DD) */
  uploadOn: string;
  note: string;
  /** 관리자 내부 메모 (받는 사람에게 보이지 않음) */
  internalMemo?: string;
  recipientType: 'member' | 'leader';
  createdBy: ID;
  createdAt: Instant;
  updatedAt?: Instant;
  /** UI 개선 C: 조건을 고칠 때마다 바뀐 항목을 남긴다. 조건 번호 = 1 + 개수 (선택 칸, 이전 기록에는 없음) */
  revisions?: OfferRevision[];
  cancelledAt?: Instant;
  cancelledBy?: ID;
  /** 크루장 추천으로 보낸 제안이면 원래 제안 */
  sourceOfferId?: ID;
}

export interface OfferRevision {
  at: Instant;
  /** 바뀐 항목 (화면에 보여줄 글자로 저장) */
  changes: { field: string; from: string; to: string }[];
}

export type OfferResponse = 'pending' | 'accepted' | 'declined';
export type DeclineReason = 'schedule' | 'category' | 'price' | 'other';
export const DECLINE_REASON_LABEL: Record<DeclineReason, string> = {
  schedule: '일정이 안 맞아요',
  category: '카테고리가 안 맞아요',
  price: '단가가 맞지 않아요',
  other: '기타',
};

export interface OfferRecipient {
  id: ID;
  offerId: ID;
  userId: ID;
  response: OfferResponse;
  respondedAt?: Instant;
  /** 크루장 대리 응답이면 크루장, 아니면 본인 */
  respondedBy?: ID;
  declineReason?: DeclineReason;
  declineNote?: string;
  /** 크루장 대리 수락 때 진행할 크루원 (0명 이상) */
  proxyMemberIds?: ID[];
  /** 관리자 다시 알림 시각들 */
  reminders: Instant[];
  /** UI 개선 C: 응답한 조건 번호 (1 = 처음 조건) */
  respondedVersion?: number;
}

/** 크루장 → 자기 크루원 전달 기록 (실제 전달은 카톡 등 플랫폼 밖) */
export interface OfferForward {
  id: ID;
  offerId: ID;
  leaderId: ID;
  memberIds: ID[];
  channel: string;
  memo: string;
  createdAt: Instant;
}

/** 크루장 → 관리자 추천 (자기 크루원 여러 명). 관리자가 확인한 뒤 보낸다 */
export interface OfferRecommendation {
  id: ID;
  offerId: ID;
  leaderId: ID;
  memberIds: ID[];
  reason: string;
  createdAt: Instant;
  /** 관리자가 이 추천으로 제안을 보낸 크루원 */
  sentMemberIds: ID[];
  archivedAt?: Instant;
}

/** 글 구분 (사용자 결정): 크루장 공지·글·질문, 크루원 글·질문. 'post'(글)는 4단계에서 더한 값이다 */
export type CommunityKind = 'notice' | 'post' | 'question';
export const COMMUNITY_KIND_LABEL: Record<CommunityKind, string> = { notice: '공지', post: '글', question: '질문' };

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
  /** 6-A: QnA 비공개 질문 (작성자·그 크루 크루장·담당 관리자만) */
  private?: boolean;
  /** 6-A: 작성자가 고친 시각 */
  updatedAt?: Instant;
  /** 6-A: 댓글이 있는 글을 지우면 내용 없이 '삭제된 글'로 남긴다 */
  deletedAt?: Instant;
}

export interface CommunityComment {
  id: ID;
  postId: ID;
  authorId: ID;
  body: string;
  createdAt: Instant;
  updatedAt?: Instant;
  deletedAt?: Instant;
}

/** 6-A: 크루장의 마감 임박 재촉 (같은 미션 하루 한 번). 받는 사람의 알림함에만 보인다 */
export interface Nudge {
  id: ID;
  missionId: ID;
  memberIds: ID[];
  sentBy: ID;
  sentOn: string;
  createdAt: Instant;
}

/** 우수 사례 (v0.6 4.5단계, 사용자 결정). 완료 + 게시 기록이 있는 결과물을 크루장·관리자가 지정한다 */
/** 6-C: 우수 사례 공개 동의. 칸이 없는 이전 기록은 동의 대기로 본다 */
export type ShowcaseConsent = 'pending' | 'agreed' | 'declined' | 'withdrawn';
export const SHOWCASE_CONSENT_LABEL: Record<ShowcaseConsent, string> = {
  pending: '동의 대기',
  agreed: '공개 중',
  declined: '공개 안 함',
  withdrawn: '동의 철회',
};

export interface Showcase {
  id: ID;
  deliverableId: ID;
  /** 학습 포인트: 왜 참고할 만한가 (6-C 이전 이름 '한 줄 평'). 크루 로그인 후 우수 사례 페이지에만 보인다 */
  comment: string;
  /** 6-C: 성과 한 줄. 공개 홈 배너에 보이는 홍보용 요약 */
  headline?: string;
  /** 6-C: 크리에이터 공개 동의 */
  consent?: ShowcaseConsent;
  consentAt?: Instant;
  authorId: ID;
  createdAt: Instant;
}

/** 6-C: 관리자 공지. 고른 담당 크루의 크루방과 알림함에 보인다 */
export interface AdminNotice {
  id: ID;
  authorId: ID;
  title: string;
  body: string;
  crewIds: ID[];
  createdAt: Instant;
  deletedAt?: Instant;
}

/** 수익 기록 (5단계, 사용자 결정): 제안 1건에 금액 하나 + 지급 여부. 관리자만 입력. 정산·지급 처리가 아니다 */
export type PayStatus = 'scheduled' | 'paid';
export const PAY_STATUS_LABEL: Record<PayStatus, string> = { scheduled: '지급 예정', paid: '지급 완료' };
export interface RevenueRecord {
  id: ID;
  proposalId: ID;
  /** 원 단위 0 이상 정수. null 은 미입력 */
  amount: number | null;
  payStatus: PayStatus;
  /** 월별 합계의 기준일 (한국 시간 YYYY-MM-DD) */
  basisOn: string;
  updatedBy: ID;
  updatedAt: Instant;
}

/** 성과 기록 요청 (5단계): 크루장 → 크루원 알림함. 같은 결과물에 하루 한 번 */
export interface RecordRequest {
  id: ID;
  deliverableId: ID;
  memberId: ID;
  requestedBy: ID;
  /** 요청한 날 (한국 시간 YYYY-MM-DD) */
  requestedOn: string;
  createdAt: Instant;
}

/** D: 전체 크루 게시판 (로그인한 크루 구성원·관리자). 신고 사유 (운영 정책 2장 금지 행위) */
export type ReportReason = 'abuse' | 'hate' | 'harmful' | 'spam' | 'privacy' | 'copyright' | 'other';
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  abuse: '욕설·비방',
  hate: '혐오·차별',
  harmful: '음란·유해',
  spam: '광고·도배',
  privacy: '개인정보 침해',
  copyright: '저작권 침해',
  other: '기타',
};

/** 관리자 숨김: 작성자에게 사유를 알린다 */
export interface Hidden {
  at: Instant;
  by: ID;
  reason: ReportReason;
  note: string;
}

export interface GlobalPost {
  id: ID;
  authorId: ID;
  title: string;
  body: string;
  /** '질문이에요' 표시 (말머리 대신, 사용자 결정) */
  question: boolean;
  createdAt: Instant;
  updatedAt?: Instant;
  deletedAt?: Instant;
  hidden?: Hidden;
}

export interface GlobalComment {
  id: ID;
  postId: ID;
  authorId: ID;
  body: string;
  createdAt: Instant;
  deletedAt?: Instant;
  hidden?: Hidden;
}

export interface Report {
  id: ID;
  targetType: 'post' | 'comment';
  targetId: ID;
  reporterId: ID;
  reason: ReportReason;
  note: string;
  createdAt: Instant;
  resolvedAt?: Instant;
  resolvedBy?: ID;
  resolution?: 'hidden' | 'dismissed';
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
  /** 우수 사례 (v4) */
  showcases: Showcase[];
  /** 사용자별 알림함을 마지막으로 연 시각 (v4). 알림 자체는 기록에서 계산한다 */
  readMarks: Record<ID, Instant>;
  /** 수익 기록 (v5) */
  revenues: RevenueRecord[];
  /** 성과 기록 요청 (v5) */
  recordRequests: RecordRequest[];
  /** 마감 임박 재촉 (v6) */
  nudges: Nudge[];
  /** 광고 제안 (v7) */
  offers: Offer[];
  offerRecipients: OfferRecipient[];
  offerForwards: OfferForward[];
  offerRecommendations: OfferRecommendation[];
  /** 관리자 공지 (v8) */
  adminNotices: AdminNotice[];
  /** 전체 크루 게시판 (v9) */
  globalPosts: GlobalPost[];
  globalComments: GlobalComment[];
  reports: Report[];
  /** 전체 게시판 운영 정책에 동의한 시각 (사용자별, 첫 글을 쓸 때) */
  boardConsents: Record<ID, Instant>;
  /** ID 생성용 증가 번호 */
  seq: number;
}
