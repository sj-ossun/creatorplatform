import { Breadcrumbs } from '../../components/Breadcrumbs/Breadcrumbs';
import { Button } from '../../components/Button/Button';
import { ChartCard, LineChart, StatusLegend, StatusStackBars } from '../../components/Charts/Charts';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { FilterTabs } from '../../components/FilterTabs/FilterTabs';
import { crewMembers, getCrew, getUser } from '../../domain/queries';
import { requestedToday, requestRecord } from '../../domain/recordRequest';
import { STATUS_LABEL, SUBMISSION_STATUSES } from '../../domain/status';
import { memberStats, weekLabel, weeklyStatus, weeklyViews } from '../../domain/stats';
import { formatCount, formatDay } from '../../domain/time';
import type { User } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import type { Route } from '../../state/routes';
import { pageStyles as ps } from '../common/Page';
import { ActivityTab, PerformanceTab } from '../overview/CrewPages';
import { StatTiles } from './MyPerformancePage';
import styles from './Performance.module.css';

type CrewPerfRoute = Extract<Route, { screen: 'crew-performance' }>;
const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`);

/**
 * 크루장 '크루 성과 관리' (5단계, 사용자 결정). 탭: 크루원 성과 | 대시보드.
 * 크루원이 직접 남긴 성과를 보고, 게시 후 7일 넘게 기록이 없으면 기록을 요청한다 (같은 결과물 하루 한 번).
 * 크루장은 성과 값을 대신 고치지 않고, 크루원별 수익·제안은 보지 않는다.
 */
export function CrewPerformancePage({ route }: { route: CrewPerfRoute }) {
  const { data, navigate } = useStore();
  const crew = getCrew(data, route.crewId)!;
  if (route.memberId) return <MemberView route={route} />;
  const tab = route.tab ?? 'members';
  return (
    <div className={ps.screen}>
      <div className={ps.pageHead}>
        <div>
          <h1 className={ps.title}>크루 성과 관리</h1>
          <p className={ps.muted}>{crew.name} 크루 · 크루원이 직접 남긴 성과를 확인하고, 기록이 비어 있으면 요청해요. 수익·제안은 보이지 않아요.</p>
        </div>
      </div>
      <FilterTabs
        label="크루 성과"
        idPrefix="crewperf"
        panelId="crewperf-panel"
        selected={tab}
        onSelect={(k) => void navigate({ screen: 'crew-performance', crewId: crew.id, tab: k })}
        items={[
          { key: 'members' as const, label: '크루원 성과' },
          { key: 'dashboard' as const, label: '대시보드' },
        ]}
      />
      <div role="tabpanel" id="crewperf-panel" aria-labelledby={`crewperf-tab-${tab}`} className={ps.group}>
        {tab === 'members' ? <MembersTable crewId={crew.id} /> : <LeaderDashboard crewId={crew.id} />}
      </div>
    </div>
  );
}

function MembersTable({ crewId }: { crewId: string }) {
  const { data, user, execute, busy, navigate } = useStore();
  const now = new Date().toISOString();
  const members = crewMembers(data, crewId).filter((m) => m.role === 'member');
  const rows = members.map((m) => ({ member: m, s: memberStats(data, m, now) }));
  const need = rows.filter((r) => r.s.needsRecord).length;
  if (members.length === 0) return <EmptyState title="크루원이 없어요" />;
  return (
    <>
      {need > 0 && <p className={styles.callout}>기록 요청 필요 {need}명 — 게시 후 7일 넘게 성과 기록이 없는 결과물이 있어요.</p>}
      <div className={`${styles.panel}`}>
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label="크루원 성과">
            <thead>
              <tr>
                <th scope="col">크루원</th>
                <th scope="col" className={styles.num}>
                  미션 완료율
                </th>
                <th scope="col" className={styles.num}>
                  기한 내 제출률
                </th>
                <th scope="col" className={styles.num}>
                  게시
                </th>
                <th scope="col" className={styles.num}>
                  최근 조회수 합계
                </th>
                <th scope="col">마지막 성과 기록</th>
                <th scope="col">상태</th>
                <th scope="col">
                  <span className="sr-only">행동</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member, s }) => {
                const targets = s.posts.filter((p) => p.needsRecord);
                const canRequest = targets.filter((p) => !requestedToday(data, p.deliverable.id, now));
                return (
                  <tr key={member.id}>
                    <td data-label="크루원">
                      <strong>{member.name}</strong>
                    </td>
                    <td className={styles.num} data-label="미션 완료율">
                      {pct(s.completionRate)}
                    </td>
                    <td className={styles.num} data-label="기한 내 제출률">
                      {pct(s.onTimeRate)}
                    </td>
                    <td className={styles.num} data-label="게시">
                      {s.posts.length}건
                    </td>
                    <td className={styles.num} data-label="최근 조회수 합계">
                      {s.viewsTotal === null ? '미입력' : `${formatCount(s.viewsTotal)}회`}
                    </td>
                    <td data-label="마지막 성과 기록">{s.lastCheckedOn ? formatDay(s.lastCheckedOn) : '-'}</td>
                    <td data-label="상태">{s.needsRecord ? <span className={styles.need}>기록 요청 필요</span> : <span className={styles.okText}>기록 정상</span>}</td>
                    <td>
                      <div className={styles.actions}>
                        {targets.length > 0 &&
                          (canRequest.length > 0 ? (
                            <Button
                              size="sm"
                              disabled={busy}
                              aria-label={`${member.name}에게 성과 기록 요청`}
                              onClick={async () => {
                                const at = new Date().toISOString();
                                for (const p of canRequest) {
                                  await execute((d) => requestRecord(d, user.id, p.deliverable.id, at), () => `${member.name}님에게 성과 기록을 요청했어요. 알림함에 보여요.`);
                                }
                              }}
                            >
                              기록 요청
                            </Button>
                          ) : (
                            <Button size="sm" disabled aria-label={`${member.name} 오늘 요청함`}>
                              오늘 요청함
                            </Button>
                          ))}
                        <Button
                          size="sm"
                          aria-label={`${member.name} 성과 보기`}
                          onClick={() => void navigate({ screen: 'crew-performance', crewId, memberId: member.id })}
                        >
                          보기
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={styles.cap}>‘기록 요청’은 크루원 알림함에 ‘성과 기록 요청’으로 가요. 같은 결과물에는 하루 한 번 보낼 수 있어요. 크루장은 성과 값을 대신 고치지 않아요.</p>
      </div>
    </>
  );
}

function LeaderDashboard({ crewId }: { crewId: string }) {
  const { data } = useStore();
  const weeks = weeklyStatus(data, [crewId]);
  const views = weeklyViews(data, [crewId]);
  return (
    <div className={styles.dash}>
      <ChartCard
        title="주차별 제출 상태"
        caption="그 주(월~일)에 마감된 미션의 대상자-미션 조합 (건)"
        legend={<StatusLegend />}
        table={{
          head: ['주', ...SUBMISSION_STATUSES.map((s) => STATUS_LABEL[s]), '대상'],
          rows: weeks.map((w) => [weekLabel(w.week), ...SUBMISSION_STATUSES.map((s) => w.counts[s]), w.total]),
        }}
      >
        <StatusStackBars groups={weeks.map((w) => ({ x: weekLabel(w.week), counts: w.counts, total: w.total }))} />
      </ChartCard>
      <ChartCard
        title="조회수 합계 추이"
        caption="게시물별 그 주까지의 마지막 확인값 합계 (직접 입력, 미입력 제외)"
        table={{ head: ['주', '조회수 합계'], rows: views.map((v) => [weekLabel(v.week), `${formatCount(v.views)}회`]) }}
      >
        <LineChart points={views.map((v) => ({ x: weekLabel(v.week), y: v.views }))} unit="회" label="조회수 합계 추이" />
      </ChartCard>
    </div>
  );
}

/** 크루장이 보는 크루원 성과 (읽기 전용): 요약 + 활동·콘텐츠 성과. 제안·수익은 없다 */
function MemberView({ route }: { route: CrewPerfRoute }) {
  const { data, navigate } = useStore();
  const crew = getCrew(data, route.crewId)!;
  const member = getUser(data, route.memberId!) as User;
  const tab = route.detailTab ?? 'performance';
  return (
    <div className={ps.screen}>
      <Breadcrumbs
        items={[
          { label: `${crew.name} 크루`, onClick: () => void navigate({ screen: 'crew', crewId: crew.id }) },
          { label: '성과', onClick: () => void navigate({ screen: 'crew-performance', crewId: crew.id }) },
          { label: member.name },
        ]}
      />
      <h1 className={ps.title}>{member.name} 성과</h1>
      <StatTiles s={memberStats(data, member)} />
      <FilterTabs
        label="크루원 성과 보기"
        idPrefix="memberperf"
        panelId="memberperf-panel"
        selected={tab}
        onSelect={(k) => void navigate({ ...route, detailTab: k })}
        items={[
          { key: 'performance' as const, label: '콘텐츠 성과' },
          { key: 'activity' as const, label: '활동' },
        ]}
      />
      <div role="tabpanel" id="memberperf-panel" aria-labelledby={`memberperf-tab-${tab}`} className={`${ps.section} ${ps.reading}`}>
        {tab === 'performance' ? <PerformanceTab member={member} /> : <ActivityTab member={member} />}
      </div>
      <div>
        <Button onClick={() => void navigate({ screen: 'crew-performance', crewId: crew.id })}>크루 성과로 돌아가기</Button>
      </div>
    </div>
  );
}
