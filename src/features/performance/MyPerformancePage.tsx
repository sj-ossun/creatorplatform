import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { ChartCard, LineChart } from '../../components/Charts/Charts';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { getCrew } from '../../domain/queries';
import { formatWon, revenuesForMember, sumRevenue } from '../../domain/revenue';
import { memberStats, viewsSeries, type MemberStats } from '../../domain/stats';
import { formatCount, formatDay } from '../../domain/time';
import { PAY_STATUS_LABEL, PROPOSAL_KIND_LABEL } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import { PageHeader, pageStyles as ps } from '../common/Page';
import styles from './Performance.module.css';

const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}`);

export function StatTiles({ s }: { s: MemberStats }) {
  return (
    <div className={styles.tiles}>
      <div className={styles.tile}>
        <p className={styles.tileK}>배정 미션</p>
        <p className={styles.tileV}>
          {s.assigned}
          <small>개</small>
        </p>
        <p className={styles.tileM}>
          완료 {s.completed} · 진행 중 {s.assigned - s.completed}
        </p>
      </div>
      <div className={styles.tile}>
        <p className={styles.tileK}>완료율</p>
        <p className={styles.tileV}>
          {pct(s.completionRate)}
          {s.completionRate !== null && <small>%</small>}
        </p>
        <p className={styles.tileM}>
          완료 {s.completed} / 배정 {s.assigned}
        </p>
      </div>
      <div className={styles.tile}>
        <p className={styles.tileK}>기한 내 제출률</p>
        <p className={styles.tileV}>
          {pct(s.onTimeRate)}
          {s.onTimeRate !== null && <small>%</small>}
        </p>
        <p className={styles.tileM}>
          기한 내 {s.onTime} / 제출 {s.submitted} · 보완 요청 {s.revisionRequests}회
        </p>
      </div>
      <div className={styles.tile}>
        <p className={styles.tileK}>최근 조회수 합계</p>
        <p className={styles.tileV}>
          {s.viewsTotal === null ? '미입력' : formatCount(s.viewsTotal)}
          {s.viewsTotal !== null && <small>회</small>}
        </p>
        <p className={styles.tileM}>
          게시 {s.posts.length}건{s.lastCheckedOn ? ` · 마지막 확인 ${formatDay(s.lastCheckedOn)}` : ''}
        </p>
      </div>
    </div>
  );
}

/**
 * 크루원 '내 성과' (5단계, 사용자 결정). 크루 미션 결과물만 기록한다 (미션과 관계없는 콘텐츠 제외).
 * 조회수는 직접 확인해 입력한 값이고, 수익은 관리자가 입력한 기록이다 (정산 아님).
 */
export function MyPerformancePage() {
  const { data, user, navigate } = useStore();
  const s = memberStats(data, user);
  const [postId, setPostId] = useState(s.posts[0]?.post.id ?? '');
  const selected = s.posts.find((p) => p.post.id === postId) ?? s.posts[0];
  const series = selected ? viewsSeries(data, selected.post.id) : [];
  const revenue = revenuesForMember(data, user);
  const sum = sumRevenue(revenue.map((r) => r.record));

  return (
    <div className={ps.screen}>
      <PageHeader title="내 성과" help="크루 미션 결과물만 기록해요. 조회수는 직접 확인해 입력한 값이에요.">
        <span>
          {user.name} · {getCrew(data, user.crewId)?.name} 크루
        </span>
      </PageHeader>
      <StatTiles s={s} />
      <div className={styles.grid2}>
        <ChartCard
          title={selected ? `조회수 추이 · ${selected.mission.title}` : '조회수 추이'}
          caption="확인일별 직접 입력값. 미입력 확인일은 빼고 그려요."
          table={{ head: ['확인일', '조회수'], rows: series.map((p) => [formatDay(p.day), `${formatCount(p.views)}회`]) }}
        >
          {s.posts.length > 1 && (
            <label className={ps.muted}>
              결과물{' '}
              <select className={styles.select} value={selected?.post.id} onChange={(e) => setPostId(e.target.value)}>
                {s.posts.map((p) => (
                  <option key={p.post.id} value={p.post.id}>
                    {p.mission.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <LineChart points={series.map((p) => ({ x: formatDay(p.day), y: p.views }))} unit="회" label="조회수 추이" />
        </ChartCard>
        <section className={styles.panel} aria-labelledby="rev-title">
          <h2 className={styles.panelTitle} id="rev-title">
            수익 기록
          </h2>
          <p className={styles.cap}>관리자가 제안별로 입력한 기록이에요. 정산·지급 처리가 아니에요.</p>
          {revenue.length === 0 ? (
            <p className={styles.okText}>아직 수익 기록이 없어요.</p>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table} aria-label="수익 기록">
                  <thead>
                    <tr>
                      <th scope="col">제안</th>
                      <th scope="col" className={styles.num}>
                        금액
                      </th>
                      <th scope="col">지급</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.map(({ proposal, record }) => (
                      <tr key={record.id}>
                        <td data-label="제안">
                          {proposal.brand} · {PROPOSAL_KIND_LABEL[proposal.kind]}
                        </td>
                        <td className={styles.num} data-label="금액">
                          {record.amount === null ? '미입력' : formatWon(record.amount)}
                        </td>
                        <td data-label="지급">
                          <span className={styles.pay} data-paid={record.payStatus === 'paid' || undefined}>
                            {PAY_STATUS_LABEL[record.payStatus]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.cap}>
                합계 {formatWon(sum.total)} = 지급 완료 {formatWon(sum.paid)} + 지급 예정 {formatWon(sum.scheduled)}
                {sum.missing > 0 && ` · 금액 미입력 ${sum.missing}건`}
              </p>
            </>
          )}
        </section>
      </div>
      <section className={styles.panel} aria-labelledby="posts-title">
        <h2 className={styles.panelTitle} id="posts-title">
          게시한 결과물
        </h2>
        <p className={styles.cap}>미션 결과물만 기록해요. 미션과 관계없는 콘텐츠는 넣지 않아요.</p>
        {s.posts.length === 0 ? (
          <EmptyState title="아직 게시 기록이 없어요">검토가 끝난 미션의 상세에서 게시 기록을 남기면 여기에 모여요.</EmptyState>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label="게시한 결과물">
              <thead>
                <tr>
                  <th scope="col">미션</th>
                  <th scope="col">플랫폼</th>
                  <th scope="col">게시일</th>
                  <th scope="col" className={styles.num}>
                    최근 조회수
                  </th>
                  <th scope="col">마지막 확인</th>
                  <th scope="col">
                    <span className="sr-only">기록</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.posts.map((p) => (
                  <tr key={p.post.id}>
                    <td data-label="미션">{p.mission.title}</td>
                    <td data-label="플랫폼">{p.post.platform}</td>
                    <td data-label="게시일">{formatDay(p.post.publishedOn)}</td>
                    <td className={styles.num} data-label="최근 조회수">
                      {p.views === null ? '미입력' : `${formatCount(p.views)}회`}
                    </td>
                    <td data-label="마지막 확인">
                      {p.latest ? formatDay(p.latest.checkedOn) : '-'}{' '}
                      {p.needsRecord && p.requestedOn && <span className={styles.need}>기록 요청 받음</span>}
                    </td>
                    <td className={styles.num}>
                      <Button
                        size="sm"
                        variant={p.needsRecord && p.requestedOn ? 'action' : 'secondary'}
                        onClick={() => void navigate({ screen: 'record', missionId: p.mission.id })}
                        aria-label={`${p.mission.title} 성과 기록`}
                      >
                        성과 기록
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
