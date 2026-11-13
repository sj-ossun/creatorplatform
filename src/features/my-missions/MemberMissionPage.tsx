import { useRef } from 'react';
import { Button } from '../../components/Button/Button';
import { NextUp } from '../../components/NextUp/NextUp';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { VersionTimeline } from '../../components/VersionTimeline/VersionTimeline';
import { postOf } from '../../domain/performance';
import {
  deliverableOf,
  feedbacksForVersion,
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
import { ShowcaseConsent } from '../showcase/ShowcaseConsent';

/**
 * P-04 미션 상세 (크루원). UI 개선 B 배치는 MissionDetail 주석 참고.
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
      {/* UI 개선 B: 상태·마감·형식을 한 줄로 (크루 이름은 위 크루 메뉴에 있다) */}
      <p className={ps.metaLine}>
        <DueLine mission={mission} />
        <span>{mission.format === 'link' ? '영상 공유 링크' : '텍스트'} 제출</span>
      </p>
      <MissionDetail key={`${mission.id}-${feedbackId ?? ''}`} mission={mission} feedbackId={feedbackId} />
    </div>
  );
}

/**
 * UI 개선 B (사용자 확정, Google Classroom 과제 제출 참고): 미션을 열면 바로 제출.
 * 제출할 수 있을 때: 미션 목표·제출 기준(접힘) → 보완 요청이면 크루장 피드백 → 제출 입력(처음부터 펼침)
 * 제출한 뒤: 상태와 제출 내용 → 목표·기준(접힘) → 우수 사례 동의 → 게시·성과 요약 → 제출·피드백 이력
 * 두 번째 '제출하기' 클릭과 '기준을 확인하고 제출해 주세요' 반복 안내는 없앴다.
 */
function MissionDetail({ mission, feedbackId }: { mission: Mission; feedbackId?: string }) {
  const { data, user, navigate } = useStore();
  const nextUpRef = useRef<HTMLDivElement>(null);
  const status = statusOf(data, mission.id, user.id);
  const deliverable = deliverableOf(data, mission.id, user.id);
  const latest = deliverable && latestVersion(data, deliverable);
  const latestFeedback = latest ? feedbacksForVersion(data, latest.id).at(-1) : undefined;
  const fromNotification = feedbackId ? getFeedback(data, feedbackId) : undefined;
  const notifiedVersion = fromNotification && deliverable
    ? versionsOf(data, deliverable.id).find((v) => v.id === fromNotification.versionId)
    : undefined;
  const canSubmit = status === 'not_submitted' || status === 'revision_requested';

  function afterSave(saved: boolean) {
    if (saved) requestAnimationFrame(() => nextUpRef.current?.querySelector('h3')?.focus());
  }

  const authorLine = latestFeedback && (
    <>
      {getUser(data, latestFeedback.authorId)?.name} 크루장 ·{' '}
      <time dateTime={latestFeedback.createdAt}>{formatDetail(latestFeedback.createdAt)}</time>
    </>
  );

  let nextUp = null;
  switch (status) {
    case 'pending_review':
      nextUp = (
        <NextUp
          status={status}
          missionTitle={mission.title}
          title="제출했어요. 크루장의 검토를 기다리고 있어요"
          meta={
            latest && (
              <>
                {latest.number}차 제출 · <time dateTime={latest.submittedAt}>{formatDetail(latest.submittedAt)}</time>
              </>
            )
          }
        >
          {latest && <span className={ps.submitted}>{latest.content}</span>}
        </NextUp>
      );
      break;
    case 'revision_requested':
      // 크루장 실제 피드백을 입력란 바로 위에 (버튼 없이)
      nextUp = (
        <NextUp status={status} missionTitle={mission.title} title={`크루장 피드백 · ${latest?.number ?? ''}차 제출`} meta={authorLine}>
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

  // 검토안 순서: 목표·기준(접힘) → (보완 요청 피드백) → 입력. 제출할 수 없는 상태면 상태 안내가 먼저
  const criteria = (
      <details className={ps.fold}>
      <summary className={ps.foldSummary}>미션 목표·제출 기준</summary>
      <dl className={ps.criteria}>
        <div>
          <dt>목표·제출 기준</dt>
          <dd className={ps.prose}>{mission.criteria}</dd>
        </div>
        <div>
          <dt>제출 형식</dt>
          <dd>{mission.format === 'link' ? '영상 공유 링크' : '텍스트'}</dd>
        </div>
      </dl>
    </details>
  );

  return (
    <div className={ps.detail}>
      {fromNotification && notifiedVersion && (
        <p className={ps.info} role="note">
          알림에서 열었어요. {notifiedVersion.number}차 제출에 남긴 피드백을 표시했어요. 지금 상태는 ‘{STATUS_LABEL[status]}’예요.
        </p>
      )}
      {canSubmit && criteria}
      {nextUp && (
        <div ref={nextUpRef} className={ps.section}>
          {nextUp}
        </div>
      )}
      {canSubmit && (
        <section className={ps.section} aria-labelledby="submit-title">
          <h2 className={ps.sectionTitle} id="submit-title">
            {status === 'revision_requested' ? '수정본 제출' : '제출'}
          </h2>
          <SubmitForm key={status} mission={mission} resubmit={status === 'revision_requested'} onClose={afterSave} inline />
        </section>
      )}
      {!canSubmit && criteria}
      {deliverable && <ShowcaseConsent deliverable={deliverable} />}
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
