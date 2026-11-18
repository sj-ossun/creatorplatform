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
import { useState } from 'react';
import { FilterTabs } from '../../components/FilterTabs/FilterTabs';
import { Tag } from '../../components/Tag/Tag';
import { unsubmittedReminder, type ReminderPreview } from '../../domain/reminders';
import type { Mission } from '../../domain/types';
import { DueLine } from '../common/Page';
import { withRo } from '../../domain/korean';

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
/** SC-08 알림 미리보기. 피드백 도착(F-11A)과 미제출 안내(F-11B). 실제 발송 없음. */
export function NotificationsScreen() {
  const { route, navigate, user } = useStore();
  // 크루원은 본인이 받은 피드백 알림 예시만 본다 (미제출 안내는 크루장·관리자)
  const memberView = user.role === 'member';
  const tab = !memberView && route.screen === 'notifications' && route.tab === 'unsubmitted' ? 'unsubmitted' : 'feedback';
  return (
    <div className={ps.screen}>
      <PageHeader title="알림 예시">
        <span>실제로 보내지 않아요. 받는 사람·문구·여는 곳을 확인하는 화면이에요.</span>
      </PageHeader>
      {!memberView && (
      <FilterTabs
        label="알림 종류"
        idPrefix="notice"
        panelId="notice-panel"
        selected={tab}
        onSelect={(k) => void navigate({ screen: 'notifications', tab: k })}
        items={[
          { key: 'feedback', label: '피드백 도착' },
          { key: 'unsubmitted', label: '미제출 안내' },
        ]}
      />
      )}
      <div role={memberView ? undefined : 'tabpanel'} id="notice-panel" aria-labelledby={memberView ? undefined : `notice-tab-${tab}`}>
        {tab === 'feedback' ? <FeedbackNotifications /> : <UnsubmittedReminders />}
      </div>
    </div>
  );
}

function FeedbackNotifications() {
  const { data, user, route, navigate, requireLogin } = useStore();
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
    detail = (
      <div className={ps.detail}>
        <BackToList onClick={toList} />
        <SimFrame
          message={`${d.recipient.name} 님, ‘${d.mission.title}’ ${d.version.number}차 제출에 피드백이 도착했어요.`}
          action={
            <Button
              size="sm"
              onClick={() => {
                const target = { screen: 'mission' as const, missionId: d.mission.id, feedbackId: d.feedback.id };
                // 받는 사람으로 이미 로그인했으면 바로 연다. 아니면 계정을 바꾸지 않고 로그인 안내로 (F-11A)
                if (user.id === d.recipient.id) void navigate(target);
                else void requireLogin(target, 'feedback');
              }}
            >
              내 피드백 보기
            </Button>
          }
          rows={[
            { label: '받는 사람', value: `${d.recipient.name} (${getCrew(data, d.recipient.crewId)?.name ?? ''})` },
            { label: '여는 곳', value: `내 미션 › ${d.mission.title} › ${d.version.number}차 제출` },
            {
              label: '누르면',
              value: `받는 사람 계정으로 로그인하라는 안내가 나와요. ${withRo(d.recipient.name)} 시연 로그인하면 홈에 ‘선택했던 피드백 보기’가 보여요. 계정은 자동으로 바뀌지 않아요.`,
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

  return <SplitView ref={detailRef} list={list} detail={detail} listLabel="알림 예시 목록" detailLabel="알림 미리보기" />;
}

/** F-11B: 크루장은 자기 크루, 관리자는 담당 크루 미션에서 미리보기를 만든다 */
function UnsubmittedReminders() {
  const { data, user, route, navigate } = useStore();
  const r = route.screen === 'notifications' ? route : { screen: 'notifications' as const };
  const crewIds = user.role === 'admin' ? user.managedCrewIds : user.crewId ? [user.crewId] : [];
  const missions = data.missions
    .filter((m) => crewIds.includes(m.crewId))
    .sort((a, b) => b.dueAt.localeCompare(a.dueAt));
  const selected = missions.find((m) => m.id === r.missionId) ?? missions[0];
  const { detailRef, listRef, toDetail, toList } = useDetailScroll();

  const list = (
    <div ref={listRef}>
      <PanelHead title="미션" aside="마감이 늦은 순서" />
      {missions.length === 0 ? (
        <EmptyState title="아직 등록한 미션이 없어요" />
      ) : (
        <RowList label="미션 목록">
          {missions.map((m) => (
            <ListRow
              key={m.id}
              selected={selected?.id === m.id}
              onSelect={async () => {
                if (await navigate({ screen: 'notifications', tab: 'unsubmitted', missionId: m.id })) toDetail();
              }}
              title={m.title}
              meta={
                <>
                  {user.role === 'admin' && <span>{getCrew(data, m.crewId)?.name}</span>}
                  <span>
                    마감 <time dateTime={m.dueAt}>{formatList(m.dueAt)}</time>
                  </span>
                  {m.demoDue && <Tag variant="sim">시연용 기한</Tag>}
                </>
              }
            />
          ))}
        </RowList>
      )}
    </div>
  );

  return (
    <SplitView
      ref={detailRef}
      list={list}
      detail={
        selected ? (
          <div className={ps.detail}>
            <BackToList onClick={toList} />
            <ReminderDetail key={selected.id} mission={selected} />
          </div>
        ) : (
          <EmptyState title="아직 등록한 미션이 없어요" />
        )
      }
      listLabel="미션 목록"
      detailLabel="미제출 안내 미리보기"
    />
  );
}

function ReminderDetail({ mission }: { mission: Mission }) {
  const { data } = useStore();
  const [preview, setPreview] = useState<ReminderPreview | null>(null);
  return (
    <>
      <div className={ps.detailHead}>
        <h2 className={ps.detailTitle}>{mission.title}</h2>
        <p className={ps.muted}>
          <DueLine mission={mission} />
        </p>
      </div>
      <p className={ps.note}>
        누른 시점에 마감이 지났고 아직 한 번도 제출하지 않은 대상자만 계산해요. 보완 요청을 받은 사람은 이미 제출했으므로 빠져요.
      </p>
      <div className={ps.actions}>
        <Button onClick={() => setPreview(unsubmittedReminder(data, mission, new Date().toISOString()))}>
          {preview ? '지금 시각으로 다시 계산' : '미제출 안내 미리보기'}
        </Button>
      </div>
      {preview && (
        <SimFrame
          message={
            preview.recipients.length > 0
              ? `‘${mission.title}’ 마감이 지났어요. 아직 제출하지 않았다면 지금 제출해 주세요. 마감 뒤에도 제출할 수 있어요.`
              : '지금 안내할 대상이 없어요'
          }
          rows={[
            {
              label: '받는 사람',
              value:
                preview.recipients.length > 0 ? (
                  <>
                    대상 <span className="num">{preview.recipients.length}</span>명: {preview.recipients.map((u) => u.name).join(', ')}
                  </>
                ) : (
                  `대상 0명${preview.duePassed ? '' : ' (아직 마감 전이에요)'}`
                ),
            },
            { label: '여는 곳', value: `내 미션 › ${mission.title}` },
            { label: '계산 시각', value: <time dateTime={preview.computedAt}>{formatDetail(preview.computedAt)}</time> },
          ]}
        />
      )}
    </>
  );
}
