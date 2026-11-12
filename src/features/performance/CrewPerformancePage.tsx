import { Breadcrumbs } from '../../components/Breadcrumbs/Breadcrumbs';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { FilterTabs } from '../../components/FilterTabs/FilterTabs';
import { crewMembers, getCrew, getUser } from '../../domain/queries';
import { requestedToday, requestRecord } from '../../domain/recordRequest';
import { STATUS_LABEL, SUBMISSION_STATUSES } from '../../domain/status';
import { feedbackEffect, memberStats, MIN_POSTS_TO_COMPARE, missionPerformance, weekLabel, weeklyStatus } from '../../domain/stats';
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
  return (
    <div className={styles.dash}>
      {/* 6-A: 막대 대신 주차별 숫자 표 (테스터 피드백) */}
      <section className={styles.panel} aria-labelledby="weekly-title">
        <h3 className={styles.panelTitle} id="weekly-title">
          주차별 제출 상태
        </h3>
        <p className={styles.cap}>그 주(월~일)에 마감된 미션의 대상자-미션 조합 (건)</p>
        {weeks.length === 0 ? (
          <p className={styles.okText}>아직 마감된 미션이 없어요.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label="주차별 제출 상태">
              <thead>
                <tr>
                  <th scope="col">주</th>
                  <th scope="col" className={styles.num}>
                    대상
                  </th>
                  {SUBMISSION_STATUSES.map((s) => (
                    <th key={s} scope="col" className={styles.num}>
                      <span className="status-glyph" data-status={s} aria-hidden="true" /> {STATUS_LABEL[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.week}>
                    <td data-label="주">{weekLabel(w.week)}</td>
                    <td className={styles.num} data-label="대상">
                      {w.total}건
                    </td>
                    {SUBMISSION_STATUSES.map((s) => (
                      <td key={s} className={styles.num} data-label={STATUS_LABEL[s]}>
                        {w.counts[s]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {/* 6-C 후속 (사용자 확정): 조회수 합계 추이 대신 미션별 성과·피드백 효과 */}
      <MissionPerformance crewId={crewId} />
      <FeedbackEffectPanel crewId={crewId} />
    </div>
  );
}

/**
 * 미션별 성과: 미션마다 게시 수, 게시물당 조회수 중앙값, 가장 높은 게시물.
 * 중앙값이라 한 편이 크게 터져도 크루 전체가 좋아 보이지 않는다. 조회수는 크리에이터 직접 입력값이다.
 */
function MissionPerformance({ crewId }: { crewId: string }) {
  const { data } = useStore();
  const rows = missionPerformance(data, crewId);
  return (
    <section className={styles.panel} aria-labelledby="mission-perf-title">
      <h3 className={styles.panelTitle} id="mission-perf-title">
        미션별 성과
      </h3>
      <p className={styles.cap}>조회수는 크리에이터 직접 입력이고, 게시물마다 가장 최근 확인값을 써요. 조회수가 입력된 게시물이 {MIN_POSTS_TO_COMPARE}편보다 적으면 비교하지 않아요.</p>
      {rows.length === 0 ? (
        <p className={styles.okText}>아직 미션이 없어요.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label="미션별 성과">
            <thead>
              <tr>
                <th scope="col">미션</th>
                <th scope="col" className={styles.num}>
                  게시 / 대상
                </th>
                <th scope="col" className={styles.num}>
                  게시물당 조회수 (중앙값)
                </th>
                <th scope="col">가장 높은 게시물</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.mission.id}>
                  <td data-label="미션">
                    {r.mission.title}
                    <span className={styles.subLine}>마감 {formatDay(r.mission.dueAt.slice(0, 10))}</span>
                  </td>
                  <td className={styles.num} data-label="게시 / 대상">
                    {r.posted} / {r.targets}명
                  </td>
                  <td className={styles.num} data-label="조회수 중앙값">
                    {r.medianViews === null ? '–' : `${formatCount(r.medianViews)}회`}
                  </td>
                  <td data-label="가장 높은 게시물">
                    {r.best ? (
                      <>
                        {getUser(data, r.best.memberId)?.name} · {formatCount(r.best.views)}회
                        <span className={styles.subLine}>확인일 {formatDay(r.best.checkedOn)}, 직접 입력</span>
                      </>
                    ) : (
                      <span className={styles.subLine}>비교할 게시물이 아직 적어요</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** 피드백 효과: 최근 미션 3개의 제출·피드백 기록에서 계산 (직접 입력값을 쓰지 않는다) */
function FeedbackEffectPanel({ crewId }: { crewId: string }) {
  const { data } = useStore();
  const e = feedbackEffect(data, crewId);
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–');
  return (
    <section className={styles.panel} aria-labelledby="feedback-effect-title">
      <h3 className={styles.panelTitle} id="feedback-effect-title">
        피드백 효과
      </h3>
      <p className={styles.cap}>
        최근 미션 {e.missions}개 · 미션 배정 {e.assignments}건 기준. 제출·피드백 기록에서 계산해요.
      </p>
      <ul className={styles.effects} aria-label="피드백 효과">
        <li className={styles.effect}>
          <span className={styles.effectLabel}>1차 제출에 바로 완료</span>
          <span className={styles.effectValue}>{pct(e.firstPass.done, e.firstPass.reviewed)}</span>
          <span className={styles.subLine}>
            {e.firstPass.done}건 / 검토한 1차 제출 {e.firstPass.reviewed}건
          </span>
        </li>
        <li className={styles.effect}>
          <span className={styles.effectLabel}>보완 요청 뒤 다시 제출</span>
          <span className={styles.effectValue}>{pct(e.resubmitted.done, e.resubmitted.requested)}</span>
          <span className={styles.subLine}>
            {e.resubmitted.done}건 / 보완 요청 {e.resubmitted.requested}건
          </span>
        </li>
        <li className={styles.effect}>
          <span className={styles.effectLabel}>다시 제출까지 걸린 날</span>
          <span className={styles.effectValue}>{e.medianDays === null ? '–' : `${e.medianDays}일`}</span>
          <span className={styles.subLine}>중앙값</span>
        </li>
      </ul>
    </section>
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
