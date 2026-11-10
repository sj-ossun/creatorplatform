import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { MissionCard, MissionCardGrid } from '../../components/MissionCard/MissionCard';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { Tag } from '../../components/Tag/Tag';
import { crewMembers, getCrew } from '../../domain/queries';
import { formatList } from '../../domain/time';
import { leaderReviewTodo, memberTodo } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import { pageStyles as ps } from '../common/Page';
import type { Mission } from '../../domain/types';

function Due({ mission }: { mission: Mission }) {
  return (
    <>
      <span>
        마감 <time dateTime={mission.dueAt}>{formatList(mission.dueAt)}</time>
      </span>
      {mission.demoDue && <Tag variant="sim">시연용 기한</Tag>}
    </>
  );
}

/**
 * UI-01 홈 — 필요한 행동으로 바로 진입. 새 업무 데이터가 아니라 기존 기록의 조회 결과다.
 * 정렬(제작 가정): 마감 오름차순, 같으면 ID 순. 지난 마감도 숨기지 않는다.
 * 완료율·성장 점수·추천은 만들지 않는다.
 */
export function HomePage() {
  const { data, user, navigate } = useStore();
  const crew = getCrew(data, user.crewId);
  const toList = () => void navigate({ screen: 'missions' });

  if (user.role === 'leader') {
    const todo = leaderReviewTodo(data, user);
    return (
      <div className={ps.screen}>
        <div className={ps.pageHead}>
          <div>
            <p className={ps.muted}>
              {crew?.name} 크루 · 크루원 {crewMembers(data, user.crewId).length}명
            </p>
            <h1 className={ps.title}>{user.name}님, 검토할 미션이에요</h1>
          </div>
          <Button variant="quiet" onClick={toList}>
            모든 미션 보기
          </Button>
        </div>
        {todo.length === 0 ? (
          <div className={ps.panel}>
            <EmptyState title="지금 검토할 제출물이 없어요" action={<Button onClick={toList}>미션 목록 보기</Button>}>
              크루원이 제출하면 여기에 보여요.
            </EmptyState>
          </div>
        ) : (
          <MissionCardGrid label="검토할 미션">
            {todo.map(({ mission, counts }, i) => (
              <MissionCard
                key={mission.id}
                title={mission.title}
                status={
                  <span className={ps.metaLine}>
                    <span>
                      <span className="status-glyph" data-status="pending_review" aria-hidden="true" /> 검토 대기{' '}
                      <span className="num">{counts.counts.pending_review}</span>명
                    </span>
                    <span>
                      대상 <span className="num">{counts.total}</span>명
                    </span>
                  </span>
                }
                meta={<Due mission={mission} />}
                actionLabel="검토하기"
                primary={i === 0}
                onOpen={() => void navigate({ screen: 'review', missionId: mission.id })}
              />
            ))}
          </MissionCardGrid>
        )}
      </div>
    );
  }

  const todo = memberTodo(data, user);
  return (
    <div className={ps.screen}>
      <div className={ps.pageHead}>
        <div>
          <p className={ps.muted}>{crew?.name} 크루</p>
          <h1 className={ps.title}>{user.name}님, 이번에 할 일이에요</h1>
        </div>
        <Button variant="quiet" onClick={toList}>
          모든 미션 보기
        </Button>
      </div>
      {todo.length === 0 ? (
        <div className={ps.panel}>
          <EmptyState title="지금 할 일이 없어요" action={<Button onClick={toList}>미션 목록 보기</Button>}>
            제출할 미션이나 보완 요청이 생기면 여기에 보여요.
          </EmptyState>
        </div>
      ) : (
        <MissionCardGrid label="이번에 할 일">
          {todo.map(({ mission, status }, i) => (
            <MissionCard
              key={mission.id}
              title={mission.title}
              status={<StatusChip status={status} />}
              meta={<Due mission={mission} />}
              actionLabel={status === 'revision_requested' ? '수정본 작성하기' : '제출하러 가기'}
              primary={i === 0}
              onOpen={() => void navigate({ screen: 'mission', missionId: mission.id })}
            />
          ))}
        </MissionCardGrid>
      )}
    </div>
  );
}
