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

/** UI-02 미션 목록 — 탐색 화면. 필터는 조회용이며 업무 상태를 추가하지 않는다 */
export function MissionListPage() {
  const { data, user, navigate, listFilter, setListFilter } = useStore();
  const role = user.role === 'leader' ? 'leader' : 'member';
  const all = visibleMissions(data, user);
  const missions = filterMissions(data, user, listFilter);
  const empty = EMPTY[role][listFilter];
  const todoCount = filterMissions(data, user, 'todo').length;

  return (
    <div className={`${ps.screen} ${ps.explore}`}>
      <div className={ps.pageHead}>
        <div>
          <h1 className={ps.title}>미션</h1>
          <p className={ps.muted}>
            {getCrew(data, user.crewId)?.name} 크루 · {role === 'leader' ? '크루에 등록한 미션' : '나에게 배정된 미션'}
          </p>
        </div>
        {role === 'leader' && (
          <Button variant="action" onClick={() => void navigate({ screen: 'mission-create' })}>
            미션 등록
          </Button>
        )}
      </div>
      <div className={ps.group}>
      <FilterTabs
        label="미션 보기"
        idPrefix="missions"
        panelId="missions-panel"
        selected={listFilter}
        onSelect={setListFilter}
        items={[
          { key: 'all', label: '전체', count: all.length },
          { key: 'todo', label: role === 'leader' ? '검토할 미션' : '내 할 일', count: todoCount },
          { key: 'done', label: '완료', count: filterMissions(data, user, 'done').length },
        ]}
      />
      <div role="tabpanel" id="missions-panel" aria-labelledby={`missions-tab-${listFilter}`}>
        {missions.length === 0 ? (
          <div className={ps.panel}>
            <EmptyState
              title={empty.title}
              action={
                role === 'leader' && listFilter === 'all' ? undefined : listFilter !== 'all' ? (
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
                  onOpen: () => void navigate({ screen: 'mission', missionId: m.id, tab: c.counts.pending_review > 0 ? 'review' : 'overview' }),
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
