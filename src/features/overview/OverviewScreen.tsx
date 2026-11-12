import { Button } from '../../components/Button/Button';
import { useEffect, useRef } from 'react';
import { StatusNumbers } from '../../components/Distribution/Distribution';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { StatusTable } from '../../components/StatusTable/StatusTable';
import { crewProfile } from '../../domain/crewProfile';
import { Field } from '../../components/Field/Field';
import { aggregateStatuses, type AggregateFilter } from '../../domain/aggregate';
import { crewMembers, getCrew, getUser } from '../../domain/queries';
import { formatDay, isValidDay } from '../../domain/time';
import type { AppData, User } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import type { OverviewFilter, Route } from '../../state/routes';
import { PageHeader, pageStyles as ps } from '../common/Page';
import { CrewMembers, MemberDetailPage } from './CrewPages';
import { FilterTabs } from '../../components/FilterTabs/FilterTabs';
import { AdminDashboard } from '../performance/AdminDashboard';
import { AdminOffers } from '../offers/AdminOffers';
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
  const crew = f.crewId ? `${getCrew(data, f.crewId)?.name} 크루` : '전체 크루';
  let period = '미션 마감일 기준 전체 기간';
  if (periodApplied && (f.from || f.to)) {
    period = `미션 마감일 ${f.from ? formatDay(f.from) : '처음'}~${f.to ? formatDay(f.to) : '지금'}`;
  }
  const mission = f.missionId ? `, ${data.missions.find((m) => m.id === f.missionId)?.title}` : '';
  return `${crew}, ${period}${mission}`;
}

/**
 * P-09 전체 크루 (v0.6 02 14장, F-08). 화면 이름은 사용자 결정으로 '전체 크루'를 유지한다.
 * 집계 범위(권한)는 그대로 관리자의 담당 크루다. 지금 예시 관리자는 모든 크루를 담당한다.
 * 합계(식 + 막대) → 크루별 숫자 표 → 크루를 고르면 같은 페이지 아래 구성원 → P-10 개인 상세.
 */
export function OverviewScreen() {
  const { route } = useStore();
  const r = route.screen === 'overview' ? route : { screen: 'overview' as const };
  if (r.crewId && r.memberId) return <MemberDetailPage key={r.memberId} route={r} />;
  return <CrewOverview route={r} />;
}

/** 합계 (6-A, 테스터 피드백): 막대·더하기 식 없이 대상 건수와 상태별 숫자만 */
function SummaryEquation({ result, scope }: { result: ReturnType<typeof aggregateStatuses>; scope: string }) {
  return (
    <section className={styles.card} aria-label="제출 상태 집계">
      <StatusNumbers result={result} label="제출 상태 집계" />
      <p className={styles.scope}>{scope}</p>
    </section>
  );
}

function CrewOverview({ route }: { route: Extract<Route, { screen: 'overview' }> }) {
  const { data, user, navigate } = useStore();
  const f = route.filter ?? EMPTY_FILTER;
  const { filter, periodError } = toAggregateFilter(user, f);
  const result = aggregateStatuses(data, filter);
  const crews = user.managedCrewIds.filter((id) => !f.crewId || id === f.crewId).map((id) => getCrew(data, id)!);
  const missionOptions = data.missions.filter((m) => (f.crewId ? m.crewId === f.crewId : user.managedCrewIds.includes(m.crewId)));
  // 선택한 크루가 지금 필터 범위 밖이면 선택하지 않은 것으로 본다
  const selected = route.crewId && crews.some((c) => c.id === route.crewId) ? getCrew(data, route.crewId) : undefined;
  const membersRef = useRef<HTMLHeadingElement>(null);
  const prevSelected = useRef(selected?.id);
  useEffect(() => {
    if (selected && selected.id !== prevSelected.current) membersRef.current?.focus();
    prevSelected.current = selected?.id;
  }, [selected]);

  const setFilter = (patch: Partial<OverviewFilter>) => {
    const next = { ...f, ...patch };
    // 크루를 바꾸면 다른 크루의 미션 선택은 풀린다
    if (patch.crewId !== undefined && next.missionId) {
      const m = data.missions.find((x) => x.id === next.missionId);
      if (m && next.crewId && m.crewId !== next.crewId) next.missionId = '';
    }
    // 크루 필터 밖의 구성원 선택은 풀린다
    const keepCrew = route.crewId && (!next.crewId || next.crewId === route.crewId) ? route.crewId : undefined;
    void navigate({ screen: 'overview', filter: next, crewId: keepCrew });
  };
  const empty = result.total === 0;

  return (
    <div className={ps.screen}>
      <PageHeader title="전체 크루" />
      <FilterTabs
        label="전체 크루 보기"
        idPrefix="ops"
        panelId="ops-panel"
        selected={route.view ?? 'status'}
        onSelect={(k) => void navigate({ screen: 'overview', view: k })}
        items={[
          { key: 'status' as const, label: '현황' },
          { key: 'dashboard' as const, label: '대시보드' },
          { key: 'offers' as const, label: '제안' },
        ]}
      />
      {route.view === 'dashboard' ? (
        <div role="tabpanel" id="ops-panel" aria-labelledby="ops-tab-dashboard">
          <AdminDashboard />
        </div>
      ) : route.view === 'offers' ? (
        <div role="tabpanel" id="ops-panel" aria-labelledby="ops-tab-offers">
          <AdminOffers route={route} />
        </div>
      ) : (
      <div role="tabpanel" id="ops-panel" aria-labelledby="ops-tab-status" className={ps.screen}>
      <section className={styles.filters} aria-label="조회 조건">
        <Field label="크루">
          {(p) => (
            <select {...p} name="filter-crew" value={f.crewId} onChange={(e) => setFilter({ crewId: e.target.value })}>
              <option value="">전체 크루</option>
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

      <SummaryEquation result={result} scope={scopeLabel(data, f, !periodError)} />

      {empty ? (
        <div className={ps.panel}>
          <EmptyState
            title="조건에 맞는 대상이 없어요"
            action={<Button onClick={() => void navigate({ screen: 'overview', filter: EMPTY_FILTER })}>필터 해제</Button>}
          >
            고른 크루·기간·미션에 해당하는 대상자-미션 조합이 없어요.
          </EmptyState>
        </div>
      ) : (
        <section className={ps.group} aria-labelledby="crew-table-title">
          <h2 className={ps.sectionTitle} id="crew-table-title">
            크루별 현황
          </h2>
          <StatusTable
            label="크루별 현황"
            titleHeader="크루"
            hasAction
            columns={[{ label: '카테고리' }, { label: '대상', numeric: true }]}
            rows={crews.map((crew) => {
              const row = aggregateStatuses(data, { ...filter, crewIds: [crew.id] });
              const { category } = crewProfile(crew);
              const isSel = selected?.id === crew.id;
              return {
                id: crew.id,
                title: crew.name,
                openLabel: `${crew.name} 구성원 보기`,
                onOpen: () => void navigate({ screen: 'overview', filter: f, crewId: crew.id }),
                sub: `크루장 ${getUser(data, crew.leaderId)?.name} · 크루원 ${crewMembers(data, crew.id).length}명`,
                selected: isSel,
                actionLabel: '구성원 보기',
                cells: [
                  category ? (
                    <span className={styles.category} key="c">
                      {category}
                    </span>
                  ) : (
                    <span key="c">-</span>
                  ),
                  <span key="t">
                    <span className="num">{row.total}</span>
                    {row.unit}
                  </span>,
                ],
                counts: row,
              };
            })}
          />
        </section>
      )}

      {!empty && selected && (
        <section className={ps.group} aria-labelledby="members-title">
          <h2 className={ps.sectionTitle} id="members-title" ref={membersRef} tabIndex={-1}>
            {selected.name} 크루 구성원
          </h2>
          <div className={ps.pageHead}>
            <p className={ps.muted}>개수 기준: {scopeLabel(data, { ...f, crewId: selected.id }, !periodError)}</p>
            <Button size="sm" onClick={() => void navigate({ screen: 'qna', crewId: selected.id })}>
              이 크루 QnA 보기 (읽기 전용)
            </Button>
          </div>
          <CrewMembers crewId={selected.id} route={route} filter={filter} />
        </section>
      )}
      </div>
      )}
    </div>
  );
}
