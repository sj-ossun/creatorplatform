import { Button } from '../../components/Button/Button';
import { Distribution, StatusBar, StatusCountList } from '../../components/Distribution/Distribution';
import { Field } from '../../components/Field/Field';
import { aggregateStatuses, type AggregateFilter } from '../../domain/aggregate';
import { getCrew, getUser } from '../../domain/queries';
import { formatDay, isValidDay } from '../../domain/time';
import type { AppData, User } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import type { OverviewFilter, Route } from '../../state/routes';
import { PageHeader, pageStyles as ps } from '../common/Page';
import { CrewScreen } from './CrewScreen';
import styles from './Overview.module.css';

export const EMPTY_FILTER: OverviewFilter = { crewId: '', from: '', to: '', missionId: '' };

/** 화면 필터 → 공통 집계 필터. 잘못된 기간은 적용하지 않고 오류를 돌려준다 */
export function toAggregateFilter(user: User, f: OverviewFilter): { filter: AggregateFilter; periodError?: string } {
  const filter: AggregateFilter = { crewIds: f.crewId ? [f.crewId] : user.managedCrewIds };
  if (f.missionId) filter.missionIds = [f.missionId];
  const fromOk = !f.from || isValidDay(f.from);
  const toOk = !f.to || isValidDay(f.to);
  if (!fromOk || !toOk) return { filter, periodError: '기간을 다시 확인해 주세요.' };
  if (f.from && f.to && f.from > f.to) return { filter, periodError: '시작일이 종료일보다 늦어요. 기간을 다시 확인해 주세요.' };
  if (f.from) filter.from = f.from;
  if (f.to) filter.to = f.to;
  return { filter };
}

export function scopeLabel(data: AppData, f: OverviewFilter, periodApplied: boolean) {
  const crew = f.crewId ? `${getCrew(data, f.crewId)?.name} 크루` : '담당 크루 전체';
  let period = '미션 마감일 기준 전체 기간';
  if (periodApplied && (f.from || f.to)) {
    period = `미션 마감일 ${f.from ? formatDay(f.from) : '처음'}~${f.to ? formatDay(f.to) : '지금'}`;
  }
  const mission = f.missionId ? `, ${data.missions.find((m) => m.id === f.missionId)?.title}` : '';
  return `${crew}, ${period}${mission}`;
}

/** SC-06 관리자 전체 크루 (F-08). 조회 화면이라 주황 버튼이 없다. */
export function OverviewScreen() {
  const { route } = useStore();
  const r = route.screen === 'overview' ? route : { screen: 'overview' as const };
  if (r.crewId) return <CrewScreen key={r.crewId} route={r} />;
  return <CrewOverview route={r} />;
}

function CrewOverview({ route }: { route: Extract<Route, { screen: 'overview' }> }) {
  const { data, user, navigate } = useStore();
  const f = route.filter ?? EMPTY_FILTER;
  const { filter, periodError } = toAggregateFilter(user, f);
  const result = aggregateStatuses(data, filter);
  const crews = user.managedCrewIds.filter((id) => !f.crewId || id === f.crewId).map((id) => getCrew(data, id)!);
  const missionOptions = data.missions.filter((m) => (f.crewId ? m.crewId === f.crewId : user.managedCrewIds.includes(m.crewId)));

  const setFilter = (patch: Partial<OverviewFilter>) => {
    const next = { ...f, ...patch };
    // 크루를 바꾸면 다른 크루의 미션 선택은 풀린다
    if (patch.crewId !== undefined && next.missionId) {
      const m = data.missions.find((x) => x.id === next.missionId);
      if (m && next.crewId && m.crewId !== next.crewId) next.missionId = '';
    }
    void navigate({ screen: 'overview', filter: next });
  };

  return (
    <div className={ps.screen}>
      <PageHeader title="전체 크루" />
      <section className={styles.filters} aria-label="조회 조건">
        <Field label="크루">
          {(p) => (
            <select {...p} name="filter-crew" value={f.crewId} onChange={(e) => setFilter({ crewId: e.target.value })}>
              <option value="">담당 크루 전체</option>
              {user.managedCrewIds.map((id) => (
                <option key={id} value={id}>
                  {getCrew(data, id)?.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="기간 시작" optional error={periodError}>
          {(p) => <input {...p} name="filter-from" type="date" value={f.from} onChange={(e) => setFilter({ from: e.target.value })} />}
        </Field>
        <Field label="기간 끝" optional help="미션 마감일 기준, 한국 시간">
          {(p) => <input {...p} name="filter-to" type="date" value={f.to} onChange={(e) => setFilter({ to: e.target.value })} />}
        </Field>
        <Field label="미션">
          {(p) => (
            <select {...p} name="filter-mission" value={f.missionId} onChange={(e) => setFilter({ missionId: e.target.value })}>
              <option value="">전체 미션</option>
              {missionOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          )}
        </Field>
      </section>

      <section className={styles.card} aria-label="제출 상태 집계">
        <Distribution result={result} scope={scopeLabel(data, f, !periodError)} />
      </section>

      <section className={styles.card} aria-labelledby="crew-table-title">
        <h2 className={ps.sectionTitle} id="crew-table-title">
          크루별 현황
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.crewtable}>
            <thead>
              <tr>
                <th scope="col">크루</th>
                <th scope="col" className={styles.hideSm}>
                  진행
                </th>
                <th scope="col">상태별</th>
                <th scope="col">
                  <span className="sr-only">이동</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {crews.map((crew) => {
                const row = aggregateStatuses(data, { ...filter, crewIds: [crew.id] });
                const members = crew.memberIds.filter((id) => getUser(data, id)?.role === 'member').length;
                return (
                  <tr key={crew.id}>
                    <td>
                      <span className={styles.crewName}>{crew.name}</span>
                      <span className={styles.crewMeta}>
                        크루장 {getUser(data, crew.leaderId)?.name}, {members}명
                      </span>
                    </td>
                    <td className={styles.hideSm}>
                      <StatusBar result={row} thin />
                    </td>
                    <td>
                      <StatusCountList result={row} />
                    </td>
                    <td className={styles.actionCell}>
                      <Button size="sm" onClick={() => void navigate({ screen: 'overview', filter: f, crewId: crew.id })}>
                        구성원 보기
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
