import { Button } from '../../components/Button/Button';
import { Distribution } from '../../components/Distribution/Distribution';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ListRow, RowList } from '../../components/ListRow/ListRow';
import { BackToList, PanelHead, SplitView } from '../../components/SplitView/SplitView';
import { Tag } from '../../components/Tag/Tag';
import { aggregateStatuses } from '../../domain/aggregate';
import { getUser, missionsOfCrew } from '../../domain/queries';
import { formatDetail, formatList } from '../../domain/time';
import type { Mission } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import { DueLine, PageHeader, pageStyles as ps } from '../common/Page';
import { useDetailScroll } from '../common/useDetailScroll';
import { MissionForm } from './MissionForm';

/** SC-01 크루장 미션 목록·등록 */
export function MissionsScreen() {
  const { data, user, route, navigate } = useStore();
  const r = route.screen === 'missions' ? route : { screen: 'missions' as const };
  const missions = missionsOfCrew(data, user.crewId);
  const selected = r.creating ? undefined : missions.find((m) => m.id === r.missionId) ?? missions[0];
  const { detailRef, listRef, toDetail, toList } = useDetailScroll();

  const list = (
    <div ref={listRef}>
      <PanelHead
        title="미션"
        aside={
          missions.length > 0 && !r.creating ? (
            <Button
              variant="action"
              size="sm"
              onClick={async () => {
                if (await navigate({ screen: 'missions', creating: true })) toDetail();
              }}
            >
              미션 등록
            </Button>
          ) : undefined
        }
      />
      {missions.length === 0 ? (
        <EmptyState
          title="아직 등록한 미션이 없어요"
          action={
            !r.creating && (
              <Button
                variant="action"
                onClick={async () => {
                  if (await navigate({ screen: 'missions', creating: true })) toDetail();
                }}
              >
                미션 등록
              </Button>
            )
          }
        >
          {r.creating ? '오른쪽 폼에서 첫 미션을 등록하세요.' : undefined}
        </EmptyState>
      ) : (
        <RowList label="미션 목록">
          {missions.map((m) => {
            const agg = aggregateStatuses(data, { missionIds: [m.id] });
            return (
              <ListRow
                key={m.id}
                selected={selected?.id === m.id}
                onSelect={async () => {
                  if (await navigate({ screen: 'missions', missionId: m.id })) toDetail();
                }}
                title={m.title}
                meta={
                  <>
                    <span>
                      마감 <time dateTime={m.dueAt}>{formatList(m.dueAt)}</time>
                    </span>
                    <span>
                      대상 {agg.total}명 · 검토 대기 {agg.counts.pending_review}명
                    </span>
                    {m.demoDue && <Tag variant="sim">시연용 기한</Tag>}
                  </>
                }
              />
            );
          })}
        </RowList>
      )}
    </div>
  );

  let detail;
  if (r.creating) {
    detail = (
      <>
        <BackToList onClick={toList} />
        <MissionForm onCancel={() => void navigate({ screen: 'missions' })} />
      </>
    );
  } else if (selected) {
    detail = (
      <>
        <BackToList onClick={toList} />
        <MissionDetail mission={selected} />
      </>
    );
  } else {
    detail = <EmptyState title="미션을 고르세요">미션을 등록하면 여기에서 기준과 제출 현황을 볼 수 있어요.</EmptyState>;
  }

  return (
    <div className={ps.screen}>
      <PageHeader title="미션" />
      <SplitView ref={detailRef} list={list} detail={detail} listLabel="미션 목록" detailLabel="미션 상세" />
    </div>
  );
}

function MissionDetail({ mission }: { mission: Mission }) {
  const { data, navigate } = useStore();
  const agg = aggregateStatuses(data, { missionIds: [mission.id] });
  const targets = mission.targetIds.map((id) => getUser(data, id)?.name).filter(Boolean);
  return (
    <div className={ps.detail}>
      <div className={ps.detailHead}>
        <h2 className={ps.detailTitle}>{mission.title}</h2>
        <p className={ps.muted}>
          <DueLine mission={mission} />
        </p>
      </div>
      <Distribution result={agg} scope="이 미션의 대상자 기준" />
      <dl className={ps.criteria}>
        <div>
          <dt>목표·제출 기준</dt>
          <dd className={ps.prose}>{mission.criteria}</dd>
        </div>
        <div>
          <dt>제출 형식</dt>
          <dd>{mission.format === 'link' ? '영상 공유 링크' : '텍스트'}</dd>
        </div>
        <div>
          <dt>대상자</dt>
          <dd>{targets.join(', ')}</dd>
        </div>
        <div>
          <dt>등록</dt>
          <dd>
            <time dateTime={mission.createdAt}>{formatDetail(mission.createdAt)}</time>
          </dd>
        </div>
      </dl>
      <div className={ps.actions}>
        <Button onClick={() => void navigate({ screen: 'review', missionId: mission.id })}>퀵 리뷰 열기</Button>
      </div>
    </div>
  );
}
