import { Button } from '../../components/Button/Button';
import { useEffect, useRef, useState } from 'react';
import { opsAlerts, scopeSize } from '../../domain/ops';
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
  const now = new Date().toISOString();
  const alerts = opsAlerts(data, user, filter, now);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('pending');
  const [onlyCrews, setOnlyCrews] = useState<string[] | null>(null);
  // 크루 행: 단위는 늘 '미션 배정 건' (사용자 확정: 화면이 단위를 정한다)
  const rows = crews
    .map((crew) => ({ crew, row: { ...aggregateStatuses(data, { ...filter, crewIds: [crew.id] }), unit: '건' as const }, size: scopeSize(data, { ...filter, crewIds: [crew.id] }) }))
    .filter((x) => !query.trim() || x.crew.name.includes(query.trim()))
    .filter((x) => !onlyCrews || onlyCrews.includes(x.crew.id))
    .sort((a, b) => {
      const k = SORT_KEY[sort];
      if (!k) return a.crew.name.localeCompare(b.crew.name, 'ko');
      return b.row.counts[k] - a.row.counts[k] || a.crew.name.localeCompare(b.crew.name, 'ko');
    });
  const total = { ...result, unit: '건' as const };
  const size = scopeSize(data, filter);

  return (
    <div className={ps.screen}>
      <PageHeader title="운영 관리" />
      <FilterTabs
        label="운영 관리 보기"
        idPrefix="ops"
        panelId="ops-panel"
        selected={route.view ?? 'status'}
        onSelect={(k) => void navigate({ screen: 'overview', view: k })}
        items={[
          { key: 'status' as const, label: '크루 현황' },
          { key: 'dashboard' as const, label: '대시보드' },
          { key: 'offers' as const, label: '광고 제안' },
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

      <section className={ps.group} aria-labelledby="ops-alerts-title">
        <h2 className={ps.sectionTitle} id="ops-alerts-title">
          확인할 것
        </h2>
        <div className={styles.alerts}>
          <AlertCard
            label="검토 지연"
            count={alerts.delayed.count}
            desc={`2일 넘게 검토를 기다리는 제출 · ${alerts.delayed.crewIds.length}개 크루. 크루장 확인이 필요해요`}
            action="해당 크루만 보기"
            onAction={() => setOnlyCrews(alerts.delayed.crewIds)}
          />
          <AlertCard
            label="마감 지난 미제출"
            count={alerts.overdue.count}
            desc={`마감이 지났는데 첫 제출이 없음 · ${alerts.overdue.crewIds.length}개 크루. 참여 관리가 필요해요`}
            action="많은 크루 순으로"
            onAction={() => {
              setOnlyCrews(null);
              setSort('not_submitted');
            }}
          />
          <AlertCard
            label="보완 요청 후 대기"
            count={alerts.revision.count}
            desc={`보완 요청을 받고 아직 다시 내지 않음 · ${alerts.revision.crewIds.length}개 크루`}
            action="많은 크루 순으로"
            onAction={() => {
              setOnlyCrews(null);
              setSort('revision');
            }}
          />
          <AlertCard
            label="응답 없는 제안"
            count={alerts.staleOffers}
            desc="2일 넘게 응답이 없는 광고 제안 (받는 사람 기준)"
            action="광고 제안 탭으로"
            onAction={() => void navigate({ screen: 'overview', view: 'offers' })}
          />
        </div>
        <p className={styles.scope}>범위: {scopeLabel(data, f, !periodError)}</p>
      </section>

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
          <div className={styles.tableBar}>
            <p className={styles.scope}>
              단위 <strong>미션 배정 건</strong> (크루원 1명 × 미션 1개 = 1건)
            </p>
            <div className={styles.tableCtrl}>
              <label className={styles.ctrl}>
                <span className="sr-only">크루 이름 검색</span>
                <input type="search" placeholder="크루 이름 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <label className={styles.ctrl}>
                <span className="sr-only">정렬</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬">
                  <option value="pending">검토 대기 많은 순</option>
                  <option value="not_submitted">미제출 많은 순</option>
                  <option value="revision">보완 요청 많은 순</option>
                  <option value="name">이름순</option>
                </select>
              </label>
            </div>
          </div>
          {onlyCrews && (
            <p className={styles.filterNote}>
              검토 지연이 있는 크루만 보고 있어요.{' '}
              <Button size="sm" variant="quiet" onClick={() => setOnlyCrews(null)}>
                모든 크루 보기
              </Button>
            </p>
          )}
          {rows.length === 0 ? (
            <div className={ps.panel}>
              <EmptyState title="검색과 맞는 크루가 없어요" action={<Button onClick={() => { setQuery(''); setOnlyCrews(null); }}>검색 지우기</Button>} />
            </div>
          ) : (
          <StatusTable
            label="크루별 현황"
            titleHeader="크루"
            hasAction
            columns={[{ label: '카테고리' }, { label: '미션 배정', numeric: true }]}
            totalRow={{
              title: (
                <>
                  합계 <span className={styles.crewMeta}>{size.crews}개 크루 · 크루원 {size.members}명 · 미션 {size.missions}개</span>
                </>
              ),
              cells: [
                <span key="c" />,
                <span key="t">
                  <span className="num">{total.total}</span>건
                </span>,
              ],
              counts: total,
            }}
            rows={rows.map(({ crew, row, size: cs }) => {
              const { category } = crewProfile(crew);
              const late = alerts.delayedByCrew[crew.id] ?? 0;
              const isSel = selected?.id === crew.id;
              return {
                id: crew.id,
                title: crew.name,
                openLabel: `${crew.name} 구성원 보기`,
                onOpen: () => void navigate({ screen: 'overview', filter: f, crewId: crew.id }),
                sub: `크루장 ${getUser(data, crew.leaderId)?.name} · 크루원 ${crewMembers(data, crew.id).length}명 · 미션 ${cs.missions}개`,
                emphasize: late > 0 ? { pending_review: `2일 넘게 기다린 제출 ${late}건 포함` } : undefined,
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
          )}
          <p className={styles.scope}>진한 테두리 숫자는 2일 넘게 기다린 검토 대기가 있다는 뜻이에요. 기간은 미션 마감일 기준(한국 시간)이에요.</p>
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
              이 크루 Q&A게시판 보기 (읽기 전용)
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

type SortKey = 'pending' | 'not_submitted' | 'revision' | 'name';
const SORT_KEY: Record<SortKey, 'pending_review' | 'not_submitted' | 'revision_requested' | null> = {
  pending: 'pending_review',
  not_submitted: 'not_submitted',
  revision: 'revision_requested',
  name: null,
};

/** '확인할 것' 카드: 0건이면 흐리게 '문제 없음' */
function AlertCard({ label, count, desc, action, onAction }: { label: string; count: number; desc: string; action: string; onAction: () => void }) {
  const ok = count === 0;
  return (
    <div className={styles.alert} data-ok={ok || undefined} aria-label={`${label} ${count}건`}>
      <p className={styles.alertK}>{label}</p>
      <p className={styles.alertV}>
        <span className="num">{count}</span>
        <small>건</small>
      </p>
      <p className={styles.alertD}>{ok ? '문제 없음' : desc}</p>
      {!ok && (
        <button type="button" className={styles.alertGo} onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
