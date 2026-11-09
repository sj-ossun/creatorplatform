import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ListRow, RowList } from '../../components/ListRow/ListRow';
import { NextUp } from '../../components/NextUp/NextUp';
import { BackToList, PanelHead, SplitView } from '../../components/SplitView/SplitView';
import { VersionTimeline } from '../../components/VersionTimeline/VersionTimeline';
import {
  deliverableOf,
  feedbacksForVersion,
  getFeedback,
  getUser,
  latestVersion,
  missionsAssignedTo,
  statusOf,
  versionsOf,
} from '../../domain/queries';
import { STATUS_LABEL } from '../../domain/status';
import { formatDetail, formatList } from '../../domain/time';
import type { Mission } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import { DueLine, PageHeader, pageStyles as ps } from '../common/Page';
import { useDetailScroll } from '../common/useDetailScroll';
import { SubmitForm } from './SubmitForm';

/** SC-03 크루원 내 미션 (F-03, F-06) */
export function MyMissionsScreen() {
  const { data, user, route, navigate } = useStore();
  const r = route.screen === 'my-missions' ? route : { screen: 'my-missions' as const };
  const missions = missionsAssignedTo(data, user.id);
  const selected = missions.find((m) => m.id === r.missionId) ?? missions[0];
  const { detailRef, listRef, toDetail, toList } = useDetailScroll();

  const list = (
    <div ref={listRef}>
      <PanelHead title="배정된 미션" />
      {missions.length === 0 ? (
        <EmptyState title="배정된 미션이 없어요">크루장이 미션을 등록하면 여기에 보여요.</EmptyState>
      ) : (
        <RowList label="배정된 미션 목록">
          {missions.map((m) => {
            const status = statusOf(data, m.id, user.id);
            return (
              <ListRow
                key={m.id}
                selected={selected?.id === m.id}
                onSelect={async () => {
                  if (await navigate({ screen: 'my-missions', missionId: m.id })) toDetail();
                }}
                leading={<span className="status-glyph" data-status={status} aria-hidden="true" />}
                title={m.title}
                meta={
                  <>
                    <span>{STATUS_LABEL[status]}</span>
                    <span>
                      마감 <time dateTime={m.dueAt}>{formatList(m.dueAt)}</time>
                    </span>
                  </>
                }
              />
            );
          })}
        </RowList>
      )}
    </div>
  );

  const detail = selected ? (
    <>
      <BackToList onClick={toList} />
      <MissionDetail key={`${selected.id}-${r.feedbackId ?? ''}`} mission={selected} feedbackId={r.feedbackId} />
    </>
  ) : (
    <EmptyState title="배정된 미션이 없어요">크루장이 미션을 등록하면 여기에 보여요.</EmptyState>
  );

  return (
    <div className={ps.screen}>
      <PageHeader title="내 미션" />
      <SplitView ref={detailRef} list={list} detail={detail} listLabel="내 미션 목록" detailLabel="미션 상세" />
    </div>
  );
}

function MissionDetail({ mission, feedbackId }: { mission: Mission; feedbackId?: string }) {
  const { data, user } = useStore();
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
    case 'completed':
      nextUp = (
        <NextUp status={status} missionTitle={mission.title} title="검토가 끝났어요" meta={authorLine}>
          {latestFeedback?.comment || undefined}
        </NextUp>
      );
      break;
  }

  return (
    <div className={ps.detail}>
      <div className={ps.detailHead}>
        <h2 className={ps.detailTitle}>{mission.title}</h2>
      </div>
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
      </div>
      <section className={ps.section} aria-labelledby="criteria-title">
        <h3 className={ps.sectionTitle} id="criteria-title">
          미션 기준
        </h3>
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
          <h3 className={ps.sectionTitle} id="history-title">
            제출 기록
          </h3>
          <VersionTimeline data={data} deliverable={deliverable} format={mission.format} highlightFeedbackId={feedbackId} />
        </section>
      )}
    </div>
  );
}
