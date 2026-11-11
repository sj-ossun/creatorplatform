import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button/Button';
import { NextUp } from '../../components/NextUp/NextUp';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { VersionTimeline } from '../../components/VersionTimeline/VersionTimeline';
import { postOf } from '../../domain/performance';
import {
  deliverableOf,
  feedbacksForVersion,
  getCrew,
  getFeedback,
  getMission,
  getUser,
  latestVersion,
  statusOf,
  versionsOf,
} from '../../domain/queries';
import { STATUS_LABEL } from '../../domain/status';
import { formatDetail } from '../../domain/time';
import type { Mission } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import { DueLine, pageStyles as ps } from '../common/Page';
import { MissionCrumbs } from '../common/MissionCrumbs';
import { PostSummary } from './PostSection';
import { SubmitForm } from './SubmitForm';

/**
 * P-04 미션 상세 (크루원): 다음 행동·최근 피드백 → 목표·기준 → 제출·수정 입력 → 이력 (v0.6 02 9장).
 * 완료 후 게시·성과는 하위 페이지 P-07 에서 입력하고, 여기에는 요약만 보여준다.
 * F-03·F-06·F-07 진입. 고정 미션 목록·사이드바 없이 독립된 단일 본문.
 */
export function MemberMissionPage({ missionId, feedbackId }: { missionId: string; feedbackId?: string }) {
  const { data, user } = useStore();
  const mission = getMission(data, missionId);
  if (!mission) return null;
  const status = statusOf(data, mission.id, user.id);
  return (
    <div className={`${ps.screen} ${ps.reading}`}>
      <MissionCrumbs mission={mission} />
      <div className={ps.pageHead}>
        <h1 className={ps.title}>{mission.title}</h1>
        <StatusChip status={status} />
      </div>
      <p className={ps.metaLine}>
        <DueLine mission={mission} />
        <span>제출 형식 {mission.format === 'link' ? '영상 공유 링크' : '텍스트'}</span>
        <span>{getCrew(data, mission.crewId)?.name} 크루</span>
      </p>
      <MissionDetail key={`${mission.id}-${feedbackId ?? ''}`} mission={mission} feedbackId={feedbackId} />
    </div>
  );
}

function MissionDetail({ mission, feedbackId }: { mission: Mission; feedbackId?: string }) {
  const { data, user, navigate } = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const nextUpRef = useRef<HTMLDivElement>(null);
  const status = statusOf(data, mission.id, user.id);
  const deliverable = deliverableOf(data, mission.id, user.id);
  const latest = deliverable && latestVersion(data, deliverable);
  const latestFeedback = latest ? feedbacksForVersion(data, latest.id).at(-1) : undefined;
  const fromNotification = feedbackId ? getFeedback(data, feedbackId) : undefined;
  const notifiedVersion = fromNotification && deliverable
    ? versionsOf(data, deliverable.id).find((v) => v.id === fromNotification.versionId)
    : undefined;

  useEffect(() => {
    // 제출 가능 상태가 아니면 폼을 닫는다 (다른 화면에서 상태가 바뀐 경우)
    if (status !== 'not_submitted' && status !== 'revision_requested') setFormOpen(false);
  }, [status]);

  function closeForm(saved: boolean) {
    setFormOpen(false);
    if (saved) requestAnimationFrame(() => nextUpRef.current?.querySelector('h3')?.focus());
  }

  const authorLine = latestFeedback && (
    <>
      {getUser(data, latestFeedback.authorId)?.name} 크루장 ·{' '}
      <time dateTime={latestFeedback.createdAt}>{formatDetail(latestFeedback.createdAt)}</time>
    </>
  );

  let nextUp;
  switch (status) {
    case 'not_submitted':
      nextUp = (
        <NextUp
          status={status}
          missionTitle={mission.title}
          title="기준을 확인하고 제출해 주세요"
          meta={<DueLine mission={mission} />}
          action={
            !formOpen && (
              <Button variant="action" onClick={() => setFormOpen(true)}>
                제출하기
              </Button>
            )
          }
        >
          아래 미션 기준을 확인한 뒤 {mission.format === 'link' ? '영상 공유 링크' : '텍스트'}로 제출해 주세요.
        </NextUp>
      );
      break;
    case 'pending_review':
      nextUp = (
        <NextUp
          status={status}
          missionTitle={mission.title}
          title="크루장의 검토를 기다리고 있어요"
          meta={
            latest && (
              <>
                {latest.number}차 제출 · <time dateTime={latest.submittedAt}>{formatDetail(latest.submittedAt)}</time>
              </>
            )
          }
        />
      );
      break;
    case 'revision_requested':
      nextUp = (
        <NextUp
          status={status}
          missionTitle={mission.title}
          title="수정본을 제출해 주세요"
          meta={authorLine}
          action={
            !formOpen && (
              <Button variant="action" onClick={() => setFormOpen(true)}>
                수정본 제출하기
              </Button>
            )
          }
        >
          {latestFeedback?.comment}
        </NextUp>
      );
      break;
    case 'completed': {
      const posted = deliverable && postOf(data, deliverable.id);
      nextUp = (
        <NextUp
          status={status}
          missionTitle={mission.title}
          title="검토가 끝났어요"
          meta={authorLine}
          action={
            // 게시·성과 기록은 선택 작업이라 주 버튼이 아니다. 하위 페이지 P-07 로 이동
            <Button onClick={() => void navigate({ screen: 'record', missionId: mission.id })}>
              {posted ? '게시·성과 기록' : '게시 기록 남기기'}
            </Button>
          }
        >
          {latestFeedback?.comment || undefined}
        </NextUp>
      );
      break;
    }
  }

  return (
    <div className={ps.detail}>
      {fromNotification && notifiedVersion && (
        <p className={ps.info} role="note">
          알림에서 열었어요. {notifiedVersion.number}차 제출에 남긴 피드백을 표시했어요. 지금 상태는 ‘{STATUS_LABEL[status]}’예요.
        </p>
      )}
      {/* v0.6 02 9장 순서: 다음 행동·최근 피드백 → 목표·기준 → 내 제출/수정 입력 → 제출·피드백 이력 */}
      <div ref={nextUpRef} className={ps.section}>
        {nextUp}
      </div>
      <section className={ps.section} aria-labelledby="criteria-title">
        <h2 className={ps.sectionTitle} id="criteria-title">
          미션 목표와 제출 기준
        </h2>
        <dl className={ps.criteria}>
          <div>
            <dt>목표·제출 기준</dt>
            <dd className={ps.prose}>{mission.criteria}</dd>
          </div>
          <div>
            <dt>제출 형식</dt>
            <dd>{mission.format === 'link' ? '영상 공유 링크' : '텍스트'}</dd>
          </div>
          <div>
            <dt>마감</dt>
            <dd>
              <DueLine mission={mission} prefix="" />
            </dd>
          </div>
        </dl>
      </section>
      {formOpen && (
        <section className={ps.section} aria-labelledby="submit-title">
          <h2 className={ps.sectionTitle} id="submit-title">
            {status === 'revision_requested' ? '수정본 입력' : '내 제출 입력'}
          </h2>
          <SubmitForm mission={mission} resubmit={status === 'revision_requested'} onClose={closeForm} />
        </section>
      )}
      {status === 'completed' && deliverable && postOf(data, deliverable.id) && (
        <section className={ps.section} aria-labelledby="post-summary-title">
          <h2 className={ps.sectionTitle} id="post-summary-title">
            게시·성과 요약
          </h2>
          <div className={ps.criteria}>
            <PostSummary mission={mission} deliverable={deliverable} />
          </div>
        </section>
      )}
      {deliverable && (
        <section className={ps.section} aria-labelledby="history-title">
          <h2 className={ps.sectionTitle} id="history-title">
            제출·피드백 이력
          </h2>
          <VersionTimeline data={data} deliverable={deliverable} format={mission.format} highlightFeedbackId={feedbackId} />
        </section>
      )}
    </div>
  );
}
