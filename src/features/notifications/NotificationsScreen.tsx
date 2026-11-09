import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ListRow, RowList } from '../../components/ListRow/ListRow';
import { SimFrame } from '../../components/SimFrame/SimFrame';
import { BackToList, PanelHead, SplitView } from '../../components/SplitView/SplitView';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { notificationsVisibleTo } from '../../domain/access';
import { getCrew, getDeliverable, getFeedback, getMission, getUser } from '../../domain/queries';
import { STATUS_LABEL } from '../../domain/status';
import { formatDetail, formatList } from '../../domain/time';
import type { AppData, NotificationExample } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import { PageHeader, pageStyles as ps } from '../common/Page';
import { useDetailScroll } from '../common/useDetailScroll';

function describe(data: AppData, n: NotificationExample) {
  const feedback = getFeedback(data, n.feedbackId)!;
  const mission = getMission(data, n.missionId)!;
  const recipient = getUser(data, n.recipientId)!;
  const author = getUser(data, feedback.authorId)!;
  const version = data.versions.find((v) => v.id === feedback.versionId)!;
  const deliverable = getDeliverable(data, n.deliverableId)!;
  return { feedback, mission, recipient, author, version, deliverable };
}

/** SC-08 알림 미리보기 (F-11A). 실제 발송 없음. */
export function NotificationsScreen() {
  const { data, user, route, navigate, switchUser } = useStore();
  const r = route.screen === 'notifications' ? route : { screen: 'notifications' as const };
  const items = notificationsVisibleTo(data, user);
  const selected = items.find((n) => n.id === r.notificationId) ?? items[0];
  const { detailRef, listRef, toDetail, toList } = useDetailScroll();

  const list = (
    <div ref={listRef}>
      <PanelHead title="피드백 도착 알림" aside="최근 만든 순서" />
      {items.length === 0 ? (
        <EmptyState title="아직 만든 알림 예시가 없어요">
          피드백을 저장하면 받는 크루원에게 보낼 알림 예시가 여기에 생겨요.
        </EmptyState>
      ) : (
        <RowList label="알림 예시 목록">
          {items.map((n) => {
            const d = describe(data, n);
            return (
              <ListRow
                key={n.id}
                selected={selected?.id === n.id}
                onSelect={async () => {
                  if (await navigate({ screen: 'notifications', notificationId: n.id })) toDetail();
                }}
                leading={<span className="status-glyph" data-status={d.feedback.result} aria-hidden="true" />}
                title={`${d.recipient.name} · ${d.mission.title}`}
                meta={
                  <>
                    <span>
                      {d.version.number}차 제출 {STATUS_LABEL[d.feedback.result]}
                    </span>
                    <time dateTime={n.createdAt}>{formatList(n.createdAt)}</time>
                  </>
                }
              />
            );
          })}
        </RowList>
      )}
    </div>
  );

  let detail;
  if (!selected) {
    detail = (
      <EmptyState title="아직 만든 알림 예시가 없어요">
        퀵 리뷰에서 완료 처리나 보완 요청을 저장하면 알림 예시가 함께 만들어져요.
      </EmptyState>
    );
  } else {
    const d = describe(data, selected);
    const current = d.deliverable.status;
    const canResubmit = current === 'revision_requested';
    const what = d.feedback.result === 'completed' ? '완료 피드백을' : '보완 요청을';
    detail = (
      <div className={ps.detail}>
        <BackToList onClick={toList} />
        <SimFrame
          message={`${d.author.name} 크루장이 ‘${d.mission.title}’ ${d.version.number}차 제출에 ${what} 남겼어요.`}
          action={
            <Button
              onClick={() =>
                void switchUser(d.recipient.id, () => ({
                  screen: 'my-missions',
                  missionId: d.mission.id,
                  feedbackId: d.feedback.id,
                }))
              }
            >
              내 피드백 보기
            </Button>
          }
          rows={[
            { label: '받는 사람', value: `${d.recipient.name} (${getCrew(data, d.recipient.crewId)?.name ?? ''})` },
            { label: '여는 곳', value: `내 미션 › ${d.mission.title} › ${d.version.number}차 제출 피드백` },
            {
              label: '누르면',
              value: `예시 사용자가 ‘${d.recipient.name}’ 크루원으로 바뀌어요. 실제 로그인이 아닌 시연용 전환이에요.`,
            },
            {
              label: '만든 시각',
              value: <time dateTime={selected.createdAt}>{formatDetail(selected.createdAt)}</time>,
            },
          ]}
        />
        <section className={ps.section} aria-labelledby="linked-title">
          <h2 className={ps.sectionTitle} id="linked-title">
            연결된 피드백과 현재 상태
          </h2>
          <dl className={ps.criteria}>
            <div>
              <dt>{d.version.number}차 제출 피드백</dt>
              <dd className={ps.prose}>
                <StatusChip status={d.feedback.result} /> {d.feedback.comment || '남긴 설명이 없어요.'}
              </dd>
            </div>
            <div>
              <dt>현재 상태 (최신 제출 기준)</dt>
              <dd>
                <StatusChip status={current} />
              </dd>
            </div>
            <div>
              <dt>수정본 제출</dt>
              <dd>{canResubmit ? '지금 수정본을 제출할 수 있어요.' : '지금은 수정본을 제출할 수 없어요.'}</dd>
            </div>
          </dl>
        </section>
      </div>
    );
  }

  return (
    <div className={ps.screen}>
      <PageHeader title="알림 미리보기">
        <span>실제로 보내지 않아요. 받는 사람·문구·여는 곳을 확인하는 화면이에요.</span>
      </PageHeader>
      <SplitView ref={detailRef} list={list} detail={detail} listLabel="알림 예시 목록" detailLabel="알림 미리보기" />
    </div>
  );
}
