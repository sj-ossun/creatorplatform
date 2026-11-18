/**
 * 미제출 안내 미리보기 (F-11B). 실제 발송·예약·재시도는 없다.
 * 누른 시점에 마감이 지났고 최초 제출이 없는 대상자만 센다. 보완 요청자는 제외한다.
 * 계산 결과는 저장하지 않는다.
 */
import { deliverableOf, getUser } from './queries';
import { isAfter } from './time';
import type { AppData, Instant, Mission, User } from './types';

export interface ReminderPreview {
  mission: Mission;
  computedAt: Instant;
  /** 마감 전이면 false: 대상은 항상 0명 */
  duePassed: boolean;
  recipients: User[];
}

export function unsubmittedReminder(data: AppData, mission: Mission, now: Instant): ReminderPreview {
  const duePassed = isAfter(now, mission.dueAt);
  const recipients = duePassed
    ? mission.targetIds
        .filter((id) => !deliverableOf(data, mission.id, id))
        .map((id) => getUser(data, id))
        .filter((u): u is User => !!u)
    : [];
  return { mission, computedAt: now, duePassed, recipients };
}
