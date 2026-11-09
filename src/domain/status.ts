export const SUBMISSION_STATUSES = [
  'pending_review',
  'revision_requested',
  'completed',
  'not_submitted',
] as const; // 화면 표시 순서와 같다

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending_review: '검토 대기',
  revision_requested: '보완 요청',
  completed: '완료',
  not_submitted: '미제출',
};

export type ReviewResult = 'completed' | 'revision_requested';

export const REVIEW_LABEL: Record<ReviewResult, string> = {
  completed: '완료',
  revision_requested: '보완 요청',
};
