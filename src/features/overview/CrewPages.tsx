import { Breadcrumbs, type Crumb } from '../../components/Breadcrumbs/Breadcrumbs';
import { StatusCountList } from '../../components/Distribution/Distribution';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { FilterTabs } from '../../components/FilterTabs/FilterTabs';
import { MetricValue } from '../../components/MetricValue/MetricValue';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { StatusTable } from '../../components/StatusTable/StatusTable';
import { ExternalLink, VersionTimeline } from '../../components/VersionTimeline/VersionTimeline';
import { aggregateStatuses, type AggregateFilter } from '../../domain/aggregate';
import { metricOf, postOf } from '../../domain/performance';
import { proposalsOf } from '../../domain/proposals';
import { crewMembers, deliverableOf, getCrew, getUser, missionsAssignedTo, statusOf } from '../../domain/queries';
import { formatDay } from '../../domain/time';
import type { User } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import type { DetailTab, Route } from '../../state/routes';
import { DueLine, pageStyles as ps } from '../common/Page';
import styles from './Overview.module.css';
import { ProposalsTab } from './ProposalsTab';
import { ShowcaseControl } from '../showcase/ShowcaseControl';

type OverviewRoute = Extract<Route, { screen: 'overview' }>;

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'activity', label: '활동' },
  { key: 'performance', label: '콘텐츠 성과' },
  { key: 'proposals', label: '광고·커머스 제안' },
];

/** 관리자 화면 위치 표시: 전체 크루 / 크루 / 구성원 */
function crumbsFor(navigate: (r: Route) => Promise<boolean>, route: OverviewRoute, crewName: string, memberName?: string) {
  const items: Crumb[] = [{ label: '전체 크루', onClick: () => void navigate({ screen: 'overview', filter: route.filter }) }];
  if (memberName) {
    items.push({ label: `${crewName} 크루`, onClick: () => void navigate({ screen: 'overview', filter: route.filter, crewId: route.crewId }) });
    items.push({ label: memberName });
  } else {
    items.push({ label: `${crewName} 크루` });
  }
  return items;
}

/**
 * 선택한 크루의 구성원 (v0.6 02 14장): P-09 같은 페이지 아래에 표시한다.
 * 이름 · 선택 범위의 대상·상태 · 개인 보기. 제안 건수는 개인 상세의 탭에서 본다.
 */
export function CrewMembers({ crewId, route, filter }: { crewId: string; route: OverviewRoute; filter: AggregateFilter }) {
  const { data, navigate } = useStore();
  const crew = getCrew(data, crewId)!;
  const members = crewMembers(data, crew.id);
  if (members.length === 0) {
    return (
      <div className={ps.panel}>
        <EmptyState title="구성원이 없어요" />
      </div>
    );
  }
  return (
    <StatusTable
      label={`${crew.name} 구성원 목록`}
      titleHeader="구성원"
      hasAction
      columns={[{ label: '대상', numeric: true }]}
      rows={members.map((m) => {
        const counts = aggregateStatuses(data, { ...filter, crewIds: [crew.id], memberId: m.id });
        return {
          id: m.id,
          title: m.name,
          openLabel: `${m.name} 개인 보기`,
          onOpen: () => void navigate({ screen: 'overview', filter: route.filter, crewId: crew.id, memberId: m.id }),
          actionLabel: '개인 보기',
          cells: [
            <span key="t">
              <span className="num">{counts.total}</span>
              {counts.unit}
            </span>,
          ],
          counts,
        };
      })}
    />
  );
}

/** 크리에이터 개인 상세 — 상세형 + 탭 (SC-07, 구조안 v0.2) */
export function MemberDetailPage({ route }: { route: OverviewRoute }) {
  const { data, navigate } = useStore();
  const crew = getCrew(data, route.crewId!)!;
  const member = getUser(data, route.memberId!)!;
  const tab = route.tab ?? 'activity';
  const all = aggregateStatuses(data, { crewIds: [crew.id], memberId: member.id });
  return (
    <div className={ps.screen}>
      <Breadcrumbs items={crumbsFor(navigate, route, crew.name, member.name)} />
      <div className={ps.detailHeader}>
        <h1 className={ps.title}>{member.name}</h1>
        <p className={ps.metaLine}>
          <span>{crew.name} 크루원</span>
          <span>
            배정 미션 <span className="num">{all.total}</span>개
          </span>
        </p>
        <StatusCountList result={all} />
      </div>
      <FilterTabs
        label="개인 상세"
        idPrefix="member"
        panelId="member-panel"
        selected={tab}
        onSelect={(k) => void navigate({ ...route, tab: k })}
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: t.key === 'proposals' ? proposalsOf(data, member.id).length : undefined,
        }))}
      />
      <div role="tabpanel" id="member-panel" aria-labelledby={`member-tab-${tab}`} className={`${ps.section} ${ps.reading}`}>
        {tab === 'activity' && <ActivityTab member={member} />}
        {tab === 'performance' && <PerformanceTab member={member} />}
        {tab === 'proposals' && <ProposalsTab key={member.id} member={member} />}
      </div>
    </div>
  );
}

/** 활동: 미션, 상태, 제출 버전·시각, 피드백 이력 */
export function ActivityTab({ member }: { member: User }) {
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
export function PerformanceTab({ member }: { member: User }) {
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
                <>
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
                <ShowcaseControl deliverable={deliverable!} name={`${member.name} ${mission.title}`} />
                </>
              )
            }
          />
        );
      })}
    </div>
  );
}
