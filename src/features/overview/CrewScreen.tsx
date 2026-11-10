import { Button } from '../../components/Button/Button';
import { StatusCountList } from '../../components/Distribution/Distribution';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { FilterTabs } from '../../components/FilterTabs/FilterTabs';
import { ListRow, RowList } from '../../components/ListRow/ListRow';
import { MetricValue } from '../../components/MetricValue/MetricValue';
import { BackToList, PanelHead, SplitView } from '../../components/SplitView/SplitView';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { ExternalLink, VersionTimeline } from '../../components/VersionTimeline/VersionTimeline';
import { aggregateStatuses } from '../../domain/aggregate';
import { metricOf, postOf } from '../../domain/performance';
import { proposalsOf } from '../../domain/proposals';
import { crewMembers, deliverableOf, getCrew, missionsAssignedTo, statusOf } from '../../domain/queries';
import { formatDay } from '../../domain/time';
import type { User } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import type { DetailTab, Route } from '../../state/routes';
import { DueLine, PageHeader, pageStyles as ps } from '../common/Page';
import { useDetailScroll } from '../common/useDetailScroll';
import { EMPTY_FILTER, scopeLabel, toAggregateFilter } from './OverviewScreen';
import styles from './Overview.module.css';
import { ProposalsTab } from './ProposalsTab';

type OverviewRoute = Extract<Route, { screen: 'overview' }>;

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'activity', label: '활동' },
  { key: 'performance', label: '콘텐츠 성과' },
  { key: 'proposals', label: '광고·커머스 제안' },
];

/** 크루 구성원 목록 | 개인 상세 (SC-06 → SC-07). 관리자 화면도 같은 목록|상세 구조를 쓴다. */
export function CrewScreen({ route }: { route: OverviewRoute }) {
  const { data, user, navigate } = useStore();
  const crew = getCrew(data, route.crewId!)!;
  const f = route.filter ?? EMPTY_FILTER;
  const { filter, periodError } = toAggregateFilter(user, f);
  const members = crewMembers(data, crew.id);
  const selected = members.find((m) => m.id === route.memberId) ?? members[0];
  const tab = route.tab ?? 'activity';
  const { detailRef, listRef, toDetail, toList } = useDetailScroll();

  const go = (patch: Partial<OverviewRoute>) => navigate({ ...route, ...patch });

  const list = (
    <div ref={listRef}>
      <PanelHead title={`${crew.name} 구성원`} aside={<span className="num">{members.length}명</span>} />
      {members.length === 0 ? (
        <EmptyState title="구성원이 없어요" />
      ) : (
        <RowList label={`${crew.name} 구성원 목록`}>
          {members.map((m) => {
            const agg = aggregateStatuses(data, { ...filter, crewIds: [crew.id], memberId: m.id });
            return (
              <ListRow
                key={m.id}
                selected={selected?.id === m.id}
                onSelect={async () => {
                  if (await go({ memberId: m.id })) toDetail();
                }}
                title={m.name}
                meta={<StatusCountList result={agg} />}
              />
            );
          })}
        </RowList>
      )}
    </div>
  );

  const detail = selected ? (
    <div className={ps.detail}>
      <BackToList onClick={toList} />
      <div className={ps.who}>
        <div>
          <h2 className={ps.whoName}>{selected.name}</h2>
          <p className={ps.muted}>{crew.name} 크루원</p>
        </div>
      </div>
      <FilterTabs
        label="개인 상세"
        idPrefix="member"
        panelId="member-panel"
        selected={tab}
        onSelect={(k) => void go({ memberId: selected.id, tab: k })}
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: t.key === 'proposals' ? proposalsOf(data, selected.id).length : undefined,
        }))}
      />
      <div role="tabpanel" id="member-panel" aria-labelledby={`member-tab-${tab}`} className={ps.section}>
        {tab === 'activity' && <ActivityTab member={selected} />}
        {tab === 'performance' && <PerformanceTab member={selected} />}
        {tab === 'proposals' && <ProposalsTab key={selected.id} member={selected} />}
      </div>
    </div>
  ) : (
    <EmptyState title="구성원을 고르세요" />
  );

  return (
    <div className={ps.screen}>
      <PageHeader title={`${crew.name} 크루`} crumb="전체 크루 › 구성원">
        <span>구성원별 개수 기준: {scopeLabel(data, f, !periodError)}</span>
      </PageHeader>
      <div>
        <Button variant="quiet" onClick={() => void navigate({ screen: 'overview', filter: f })}>
          전체 크루로
        </Button>
      </div>
      <SplitView ref={detailRef} list={list} detail={detail} listLabel="구성원 목록" detailLabel="크리에이터 상세" />
    </div>
  );
}

/** 활동: 미션, 상태, 제출 버전·시각, 피드백 이력 */
function ActivityTab({ member }: { member: User }) {
  const { data } = useStore();
  const missions = missionsAssignedTo(data, member.id);
  if (missions.length === 0) return <EmptyState title="배정된 미션이 없어요" />;
  return (
    <>
      {missions.map((m) => {
        const deliverable = deliverableOf(data, m.id, member.id);
        return (
          <section key={m.id} className={styles.missionBlock} aria-label={m.title}>
            <div className={styles.blockHead}>
              <h3 className={styles.blockTitle}>{m.title}</h3>
              <StatusChip status={statusOf(data, m.id, member.id)} />
            </div>
            <p className={ps.muted}>
              <DueLine mission={m} />
            </p>
            {deliverable ? (
              <VersionTimeline data={data} deliverable={deliverable} format={m.format} />
            ) : (
              <p className={ps.muted}>아직 제출한 결과물이 없어요.</p>
            )}
          </section>
        );
      })}
    </>
  );
}

/** 콘텐츠 성과: 게시물별 수동 입력 기록. 자동 수집·순위·수익 추정 없음 */
function PerformanceTab({ member }: { member: User }) {
  const { data } = useStore();
  const rows = missionsAssignedTo(data, member.id)
    .map((m) => ({ mission: m, deliverable: deliverableOf(data, m.id, member.id) }))
    .filter((r) => r.deliverable?.status === 'completed');
  if (rows.length === 0) {
    return (
      <EmptyState title="검토가 끝난 결과물이 없어요">완료된 결과물이 생기면 게시·성과 기록을 여기에서 볼 수 있어요.</EmptyState>
    );
  }
  return (
    <div>
      <p className={ps.muted}>조회수는 크루원이 직접 확인해 입력한 값이에요. 마지막 확인일을 함께 보여줘요.</p>
      {rows.map(({ mission, deliverable }) => {
        const post = postOf(data, deliverable!.id);
        return (
          <MetricValue
            key={mission.id}
            data={data}
            title={mission.title}
            metric={metricOf(data, deliverable!.id)}
            extra={
              post && (
                <dl className={ps.kv}>
                  <div>
                    <dt>플랫폼</dt>
                    <dd>{post.platform}</dd>
                  </div>
                  <div>
                    <dt>게시 URL</dt>
                    <dd>
                      <ExternalLink href={post.url} />
                    </dd>
                  </div>
                  <div>
                    <dt>게시일</dt>
                    <dd>{formatDay(post.publishedOn)}</dd>
                  </div>
                </dl>
              )
            }
          />
        );
      })}
    </div>
  );
}
