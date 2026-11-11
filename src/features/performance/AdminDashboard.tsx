import { ChartCard, HBars, RevenueBars, RevenueLegend, StatusLegend, StatusStackBars } from '../../components/Charts/Charts';
import { getCrew } from '../../domain/queries';
import { monthlyRevenue } from '../../domain/revenue';
import { STATUS_LABEL, SUBMISSION_STATUSES } from '../../domain/status';
import { crewCompletion, weekLabel, weeklyStatus } from '../../domain/stats';
import { PROPOSAL_STATUS_LABEL, PROPOSAL_STATUSES } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import styles from './Performance.module.css';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

/**
 * 관리자 대시보드 탭 (5단계, 사용자 결정): 전체 크루 화면 안. 순위는 보이지 않는다 (크루는 이름순).
 * 집계 범위(권한)는 그대로 관리자의 담당 크루다. 수익은 관리자 입력 기록이며 정산이 아니다.
 */
export function AdminDashboard() {
  const { data, user } = useStore();
  const crewIds = [...user.managedCrewIds].sort((a, b) => (getCrew(data, a)?.name ?? '').localeCompare(getCrew(data, b)?.name ?? '', 'ko'));
  const completion = crewCompletion(data, crewIds);
  const weeks = weeklyStatus(data, crewIds);
  const months = monthlyRevenue(data, user).map((m) => ({ x: `${Number(m.month.slice(5))}월`, paid: m.paid, scheduled: m.scheduled }));
  const proposals = data.proposals.filter((p) => {
    const c = data.users.find((u) => u.id === p.creatorId)?.crewId;
    return !!c && crewIds.includes(c);
  });
  const stages = PROPOSAL_STATUSES.map((s) => ({ label: PROPOSAL_STATUS_LABEL[s], value: proposals.filter((p) => p.status === s).length }));

  return (
    <div className={styles.dash}>
      <ChartCard
        title="크루별 미션 완료율"
        caption="같은 기준(대상자-미션 조합). 크루 이름순이며 순위가 아니에요."
        table={{ head: ['크루', '완료', '대상', '완료율'], rows: completion.map((c) => [getCrew(data, c.crewId)?.name ?? '', c.completed, c.total, c.rate === null ? '–' : `${Math.round(c.rate * 100)}%`]) }}
      >
        <HBars
          label="크루별 미션 완료율"
          rows={completion.map((c) => ({ label: getCrew(data, c.crewId)?.name ?? '', value: c.rate ?? 0, display: c.rate === null ? '대상 없음' : `${Math.round(c.rate * 100)}%` }))}
        />
      </ChartCard>
      <ChartCard
        title="월별 수익 기록 합계"
        caption="관리자가 입력한 기록(기준일의 월). 정산이 아니고, 크루장 화면에는 없어요."
        legend={<RevenueLegend />}
        table={{ head: ['월', '지급 완료', '지급 예정', '합계'], rows: months.map((m) => [m.x, won(m.paid), won(m.scheduled), won(m.paid + m.scheduled)]) }}
      >
        <RevenueBars months={months} />
      </ChartCard>
      <ChartCard
        title="주차별 제출 상태 (전체 크루)"
        caption="그 주(월~일)에 마감된 미션의 대상자-미션 조합 (건)"
        legend={<StatusLegend />}
        table={{
          head: ['주', ...SUBMISSION_STATUSES.map((s) => STATUS_LABEL[s]), '대상'],
          rows: weeks.map((w) => [weekLabel(w.week), ...SUBMISSION_STATUSES.map((s) => w.counts[s]), w.total]),
        }}
      >
        <StatusStackBars groups={weeks.map((w) => ({ x: weekLabel(w.week), counts: w.counts, total: w.total }))} />
      </ChartCard>
      <ChartCard title="제안 단계별 건수" caption="지금 상태 기준. 제안 준비 → 제안 전달 → 협의 중 → 진행 확정 / 보류 / 종료" table={{ head: ['단계', '건수'], rows: stages.map((s) => [s.label, s.value]) }}>
        <HBars label="제안 단계별 건수" rows={stages.map((s) => ({ label: s.label, value: s.value, display: `${s.value}건` }))} />
      </ChartCard>
    </div>
  );
}
