import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { FeedbackComposer, ReviewResultBox } from '../../components/FeedbackComposer/FeedbackComposer';
import { FilterTabs } from '../../components/FilterTabs/FilterTabs';
import { ListRow, RowList } from '../../components/ListRow/ListRow';
import { BackToList, PanelHead, SplitView } from '../../components/SplitView/SplitView';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { Tag } from '../../components/Tag/Tag';
import { VersionTimeline } from '../../components/VersionTimeline/VersionTimeline';
import { aggregateStatuses } from '../../domain/aggregate';
import { getFeedback, missionsOfCrew, nextPending, reviewEntries, type ReviewEntry } from '../../domain/queries';
import { STATUS_LABEL, SUBMISSION_STATUSES, type SubmissionStatus } from '../../domain/status';
import { formatList } from '../../domain/time';
import type { Feedback, Mission } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import type { Route } from '../../state/routes';
import { DueLine, PageHeader, pageStyles as ps } from '../common/Page';
import { useDetailScroll } from '../common/useDetailScroll';

const EMPTY_FILTER: Record<SubmissionStatus, string> = {
  pending_review: '검토 대기인 제출물이 없어요',
  revision_requested: '보완 요청인 제출물이 없어요',
  completed: '완료인 제출물이 없어요',
  not_submitted: '미제출인 대상자가 없어요',
};

interface Processed {
  /** 처리한 순간의 화면. 화면 조건이 바뀌면 읽기 전용 결과를 내린다 */
  route: Route;
  memberId: string;
  feedback: Feedback;
}

/** SC-02 퀵 리뷰 (F-04, F-05) */
export function ReviewScreen() {
  const { data, user, route, navigate } = useStore();
  const r = route.screen === 'review' ? route : { screen: 'review' as const };
  const missions = missionsOfCrew(data, user.crewId);
  const mission = missions.find((m) => m.id === r.missionId) ?? missions[0];

  if (!mission) {
    return (
      <div className={ps.screen}>
        <PageHeader title="퀵 리뷰" />
        <div className={ps.panel}>
          <EmptyState
            title="아직 등록한 미션이 없어요"
            action={
              <Button variant="action" onClick={() => void navigate({ screen: 'missions', creating: true })}>
                미션 등록
              </Button>
            }
          >
            미션을 등록하면 대상자의 제출물을 여기에서 검토할 수 있어요.
          </EmptyState>
        </div>
      </div>
    );
  }
  return <ReviewWorkspace key={mission.id} mission={mission} missions={missions} route={r} />;
}

function ReviewWorkspace({
  mission,
  missions,
  route,
}: {
  mission: Mission;
  missions: Mission[];
  route: Extract<Route, { screen: 'review' }>;
}) {
  const { data, navigate, route: currentRoute } = useStore();
  const filter = route.filter ?? 'pending_review';
  const [processed, setProcessed] = useState<Processed | null>(null);
  const [leaving, setLeaving] = useState<{ entry: ReviewEntry; index: number } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const { detailRef, listRef, toDetail, toList } = useDetailScroll();

  const activeProcessed = processed && processed.route === currentRoute ? processed : null;
  const all = reviewEntries(data, mission);
  const filtered = all.filter((e) => e.status === filter);
  const listed = [...filtered];
  if (leaving && activeProcessed && !listed.some((e) => e.member.id === leaving.entry.member.id)) {
    listed.splice(Math.min(leaving.index, listed.length), 0, leaving.entry);
  }

  const selectedId = activeProcessed?.memberId ?? route.memberId ?? filtered[0]?.member.id;
  const selected =
    all.find((e) => e.member.id === selectedId && (e.status === filter || e.member.id === activeProcessed?.memberId)) ??
    undefined;

  const counts = aggregateStatuses(data, { missionIds: [mission.id] });

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(null), 220);
    return () => clearTimeout(t);
  }, [leaving]);

  useEffect(() => {
    if (activeProcessed) resultRef.current?.focus();
  }, [activeProcessed]);

  const go = (patch: Partial<Extract<Route, { screen: 'review' }>>) =>
    navigate({ screen: 'review', missionId: mission.id, filter, ...patch });

  function onSaved(entry: ReviewEntry, feedback: Feedback) {
    const index = filtered.findIndex((e) => e.member.id === entry.member.id);
    setLeaving({ entry, index: Math.max(index, 0) });
    setProcessed({ route: currentRoute, memberId: entry.member.id, feedback });
  }

  const next = nextPending(data, mission, activeProcessed?.memberId);

  const list = (
    <div ref={listRef}>
      <PanelHead
        title={filter === 'pending_review' ? '먼저 제출한 순서' : '이름순'}
        aside={
          <span className="num">
            {filtered.length}명
          </span>
        }
      />
      {listed.length === 0 ? (
        <EmptyState title={EMPTY_FILTER[filter]}>다른 상태를 고르거나 다른 미션을 선택하세요.</EmptyState>
      ) : (
        <RowList label={`${STATUS_LABEL[filter]} 목록`}>
          {listed.map((e) => (
            <ListRow
              key={e.member.id}
              leaving={leaving?.entry.member.id === e.member.id && e.status !== filter}
              selected={selected?.member.id === e.member.id}
              onSelect={async () => {
                if (await go({ memberId: e.member.id })) toDetail();
              }}
              leading={<span className="status-glyph" data-status={e.status} aria-hidden="true" />}
              title={e.member.name}
              trailing={
                e.latest && (
                  <time dateTime={e.latest.submittedAt}>{formatList(e.latest.submittedAt)}</time>
                )
              }
              meta={
                <>
                  <span className="sr-only">{STATUS_LABEL[e.status]},</span>
                  {e.latest ? `${e.latest.number}차 제출` : '제출 없음'}
                  {e.latest?.late && <Tag>기한 후 제출</Tag>}
                </>
              }
            />
          ))}
        </RowList>
      )}
    </div>
  );

  let detail;
  if (!selected) {
    detail = filtered.length === 0 ? (
      <EmptyState title={EMPTY_FILTER[filter]}>다른 상태를 고르거나 다른 미션을 선택하세요.</EmptyState>
    ) : (
      <EmptyState title="제출자를 고르세요">왼쪽 목록에서 검토할 사람을 고르세요.</EmptyState>
    );
  } else {
    const { member, deliverable, latest } = selected;
    const showComposer =
      !activeProcessed && deliverable?.status === 'pending_review' && latest && latest.id === deliverable.latestVersionId;
    detail = (
      <div className={ps.detail}>
        <BackToList onClick={toList} />
        <div className={ps.who}>
          <div>
            <h2 className={ps.whoName}>{member.name}</h2>
            <p className={ps.muted}>{latest ? `결과물 1건, 제출 ${latest.number}회` : '아직 제출 없음'}</p>
          </div>
          <StatusChip status={selected.status} />
        </div>
        {deliverable ? (
          <VersionTimeline data={data} deliverable={deliverable} format={mission.format} />
        ) : (
          <EmptyState title="아직 제출한 결과물이 없어요">제출하면 여기에서 검토할 수 있어요.</EmptyState>
        )}
        {showComposer && deliverable && latest && (
          <FeedbackComposer
            key={latest.id}
            deliverableId={deliverable.id}
            version={latest}
            memberName={member.name}
            onSaved={(fb) => onSaved(selected, fb)}
          />
        )}
        {activeProcessed && activeProcessed.memberId === member.id && (
          <div className={ps.section} ref={resultRef} tabIndex={-1} aria-label="방금 처리한 결과">
            <ReviewResultBox feedback={getFeedback(data, activeProcessed.feedback.id) ?? activeProcessed.feedback} />
            <div className={ps.actions}>
              {next ? (
                <Button
                  variant="action"
                  onClick={async () => {
                    if (await go({ filter: 'pending_review', memberId: next.member.id })) toDetail();
                  }}
                >
                  다음 검토 대기: {next.member.name}
                </Button>
              ) : (
                <Button disabled>남은 검토 대기 없음</Button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={ps.screen}>
      <PageHeader title={mission.title} crumb="미션 › 퀵 리뷰">
        <DueLine mission={mission} />
      </PageHeader>
      {missions.length > 1 && (
        <div className={ps.selectRow}>
          <label htmlFor="review-mission" className={ps.muted}>
            미션
          </label>
          <select
            id="review-mission"
            className={ps.select}
            value={mission.id}
            onChange={(e) => void navigate({ screen: 'review', missionId: e.target.value })}
          >
            {missions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <FilterTabs
        label="제출 상태"
        idPrefix="review"
        panelId="review-panel"
        selected={filter}
        onSelect={(k) => void go({ filter: k, memberId: undefined })}
        items={SUBMISSION_STATUSES.map((s) => ({
          key: s,
          label: STATUS_LABEL[s],
          count: counts.counts[s],
          glyph: <span className="status-glyph" data-status={s} aria-hidden="true" />,
        }))}
      />
      <div role="tabpanel" id="review-panel" aria-labelledby={`review-tab-${filter}`}>
        <SplitView ref={detailRef} list={list} detail={detail} listLabel="제출자 목록" detailLabel="선택한 제출물" />
      </div>
    </div>
  );
}
