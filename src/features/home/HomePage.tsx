import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { MissionCard, MissionCardGrid } from '../../components/MissionCard/MissionCard';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { Tag } from '../../components/Tag/Tag';
import { crewMembers, getCrew, getUser } from '../../domain/queries';
import { formatList } from '../../domain/time';
import type { Mission } from '../../domain/types';
import { ROLE_LABEL } from '../../domain/types';
import { leaderReviewTodo, memberTodo } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import { pageStyles as ps } from '../common/Page';

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
 * P-01 서비스 홈 — 선택한 예시 사용자의 다음 행동과 크루 진입점 (v0.4 01장 4절).
 * 기존 기록의 조회 화면이다. 정렬(제작 가정): 마감 오름차순, 같으면 ID 순. 지난 마감도 숨기지 않는다.
 * 완료 점수·추천은 만들지 않는다.
 */
export function HomePage() {
  const { data, user, navigate } = useStore();
  const crew = getCrew(data, user.crewId);
  const isLeader = user.role === 'leader';
  const toCrew = () => crew && void navigate({ screen: 'crew', crewId: crew.id });

  let todoSection;
  if (isLeader) {
    const todo = leaderReviewTodo(data, user);
    todoSection =
      todo.length === 0 ? (
        <div className={ps.panel}>
          <EmptyState title="지금 검토할 제출물이 없어요">
            크루원이 제출하면 여기에 보여요. 크루의 모든 미션은 아래 내 크루에서 볼 수 있어요.
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
              // 홈 바로가기도 퀵 리뷰의 소속·돌아갈 경로는 해당 미션이다
              onOpen={() => void navigate({ screen: 'review', missionId: mission.id })}
            />
          ))}
        </MissionCardGrid>
      );
  } else {
    const todo = memberTodo(data, user);
    todoSection =
      todo.length === 0 ? (
        <div className={ps.panel}>
          <EmptyState title="지금 할 일이 없어요">
            제출할 미션이나 보완 요청이 생기면 여기에 보여요. 지난 미션은 아래 내 크루에서 볼 수 있어요.
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
      );
  }

  return (
    <div className={`${ps.screen} ${ps.explore}`}>
      <div className={ps.group}>
        <p className={ps.muted}>{user.name}님, 안녕하세요</p>
        <h1 className={ps.title}>{isLeader ? `${user.name}님, 검토할 미션이에요` : `${user.name}님, 이번에 할 일이에요`}</h1>
      </div>
      {todoSection}
      {crew && (
        <section className={ps.group} aria-labelledby="my-crew-title">
          <h2 className={ps.sectionTitle} id="my-crew-title">
            내 크루
          </h2>
          <div className={`${ps.panelPad} ${ps.crewCard}`}>
            <div>
              <p className={ps.crewName}>{crew.name} 크루</p>
              <p className={ps.muted}>
                {ROLE_LABEL[user.role]}로 참여 중
                {crew.leaderId !== user.id && ` · 크루장 ${getUser(data, crew.leaderId)?.name}`} · 크루원{' '}
                {crewMembers(data, crew.id).length}명
              </p>
            </div>
            <Button onClick={toCrew}>크루로 이동</Button>
          </div>
        </section>
      )}
    </div>
  );
}
