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
import { PostSection, type PostFormMode } from './PostSection';
import { SubmitForm } from './SubmitForm';

/**
 * P-04 미션 상세 (크루원): 다음 행동 → 피드백 → 제출·수정 폼 → 기준 → 이력 → (완료 후) 게시·성과 P-07.
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
  const { data, user } = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const [postMode, setPostMode] = useState<PostFormMode>('none');
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
            !posted &&
            postMode === 'none' && (
              // 게시 기록은 선택 작업이라 주황 버튼이 아니다 (디자인 6.11)
              <Button onClick={() => setPostMode('post')}>게시 기록 남기기</Button>
            )
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
      <div ref={nextUpRef} className={ps.section}>
        {nextUp}
        {formOpen && (
          <SubmitForm mission={mission} resubmit={status === 'revision_requested'} onClose={closeForm} />
        )}
        {status === 'completed' && deliverable && (
          <PostSection mission={mission} deliverable={deliverable} mode={postMode} setMode={setPostMode} />
        )}
      </div>
      <section className={ps.section} aria-labelledby="criteria-title">
        <h2 className={ps.sectionTitle} id="criteria-title">
          미션 기준
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
      {deliverable && (
        <section className={ps.section} aria-labelledby="history-title">
          <h2 className={ps.sectionTitle} id="history-title">
            내 제출·피드백 기록
          </h2>
          <VersionTimeline data={data} deliverable={deliverable} format={mission.format} highlightFeedbackId={feedbackId} />
        </section>
      )}
    </div>
  );
}
