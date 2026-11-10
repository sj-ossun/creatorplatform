import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { FilterTabs } from '../../components/FilterTabs/FilterTabs';
import { MissionCard, MissionCardGrid } from '../../components/MissionCard/MissionCard';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { Tag } from '../../components/Tag/Tag';
import { StatusTable } from '../../components/StatusTable/StatusTable';
import { getCrew } from '../../domain/queries';
import { formatList } from '../../domain/time';
import { filterMissions, memberStatus, missionCounts, visibleMissions, type ListFilter } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import { pageStyles as ps } from '../common/Page';

const EMPTY: Record<'member' | 'leader', Record<ListFilter, { title: string; text: string }>> = {
  member: {
    all: { title: '배정된 미션이 없어요', text: '크루장이 미션을 등록하면 여기에 보여요.' },
    todo: { title: '지금 할 일이 없어요', text: '제출할 미션이나 보완 요청이 생기면 여기에 보여요.' },
    done: { title: '검토가 끝난 미션이 없어요', text: '크루장이 완료 처리하면 여기에 보여요.' },
  },
  leader: {
    all: { title: '아직 등록한 미션이 없어요', text: '미션을 등록하면 대상자의 내 미션에 바로 보여요.' },
    todo: { title: '검토할 미션이 없어요', text: '크루원이 제출하면 여기에 보여요.' },
    done: { title: '모두 완료된 미션이 없어요', text: '대상자 전원이 완료되면 여기에 보여요.' },
  },
};

/**
 * P-03 미션 목록 — 크루 안의 탐색 화면 (v0.4 01장 4절). 선택한 상세를 오른쪽 패널로 붙이지 않는다.
 * 필터(조회용): 크루원 전체/내 할 일/완료, 크루장 전체/검토할 미션. 기본 정렬은 최근 생성순.
 */
export function MissionListPage({ crewId }: { crewId: string }) {
  const { data, user, navigate, listFilter, setListFilter } = useStore();
  const role = user.role === 'leader' ? 'leader' : 'member';
  // 크루장에게는 '완료' 필터가 없다. 남아 있던 값은 전체로 본다
  const filter: ListFilter = role === 'leader' && listFilter === 'done' ? 'all' : listFilter;
  const all = visibleMissions(data, user);
  const missions = filterMissions(data, user, filter);
  const empty = EMPTY[role][filter];
  const todoCount = filterMissions(data, user, 'todo').length;

  return (
    <div className={`${ps.screen} ${ps.explore}`}>
      <div className={ps.pageHead}>
        <div>
          <h1 className={ps.title}>미션</h1>
          <p className={ps.muted}>
            {getCrew(data, crewId)?.name} 크루 · {role === 'leader' ? '크루에 등록한 미션' : '나에게 배정된 미션'}
          </p>
        </div>
        {role === 'leader' && (
          <Button variant="action" onClick={() => void navigate({ screen: 'mission-create', crewId })}>
            미션 등록
          </Button>
        )}
      </div>
      <div className={ps.group}>
      <FilterTabs
        label="미션 보기"
        idPrefix="missions"
        panelId="missions-panel"
        selected={filter}
        onSelect={setListFilter}
        items={[
          { key: 'all' as ListFilter, label: '전체', count: all.length },
          { key: 'todo' as ListFilter, label: role === 'leader' ? '검토할 미션' : '내 할 일', count: todoCount },
          ...(role === 'member' ? [{ key: 'done' as ListFilter, label: '완료', count: filterMissions(data, user, 'done').length }] : []),
        ]}
      />
      <div role="tabpanel" id="missions-panel" aria-labelledby={`missions-tab-${filter}`}>
        {missions.length === 0 ? (
          <div className={ps.panel}>
            <EmptyState
              title={empty.title}
              action={
                role === 'leader' && filter === 'all' ? undefined : filter !== 'all' ? (
                  <Button onClick={() => setListFilter('all')}>전체 미션 보기</Button>
                ) : undefined
              }
            >
              {empty.text}
            </EmptyState>
          </div>
        ) : (
          role === 'leader' ? (
            // 크루장: 표 형태 목록. 미션이 늘어도 마감·상태를 한눈에 비교한다 (구조안 v0.2)
            <StatusTable
              label="미션 목록"
              titleHeader="미션"
              columns={[{ label: '마감' }, { label: '대상', numeric: true }]}
              rows={missions.map((m) => {
                const c = missionCounts(data, m.id);
                return {
                  id: m.id,
                  title: m.title,
                  openLabel: `${m.title} 미션 보기`,
                  onOpen: () => void navigate({ screen: 'mission', missionId: m.id }),
                  cells: [
                    <span className={ps.due} key="due">
                      <time dateTime={m.dueAt}>{formatList(m.dueAt)}</time>
                      {m.demoDue && <Tag variant="sim">시연용 기한</Tag>}
                    </span>,
                    <span key="t">
                      <span className="num">{c.total}</span>명
                    </span>,
                  ],
                  counts: c,
                };
              })}
            />
          ) : (
            <MissionCardGrid label="미션 목록">
              {missions.map((m) => (
                <MissionCard
                  key={m.id}
                  title={m.title}
                  status={<StatusChip status={memberStatus(data, m, user)} />}
                  meta={
                    <>
                      <span>
                        마감 <time dateTime={m.dueAt}>{formatList(m.dueAt)}</time>
                      </span>
                      {m.demoDue && <Tag variant="sim">시연용 기한</Tag>}
                      <span>{m.format === 'link' ? '영상 공유 링크' : '텍스트'} 제출</span>
                    </>
                  }
                  actionLabel="미션 보기"
                  onOpen={() => void navigate({ screen: 'mission', missionId: m.id })}
                />
              ))}
            </MissionCardGrid>
          )
        )}
      </div>
      </div>
    </div>
  );
}
