import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { StatusNumbers } from '../../components/Distribution/Distribution';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { Tag } from '../../components/Tag/Tag';
import { NoticeTag } from '../../components/NoticeTag/NoticeTag';
import { commentsOf } from '../../domain/community';
import { crewProfile } from '../../domain/crewProfile';
import { memberProgress, recentPosts, roomNotices, roomQuestions, roomSummary, thisWeekTodo } from '../../domain/crewRoom';
import { getCrew, getUser } from '../../domain/queries';
import { formatList } from '../../domain/time';
import { leaderReviewTodo, visibleMissions } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import { pageStyles as ps } from '../common/Page';
import styles from './CrewHome.module.css';

/**
 * P-02 크루방 (6-C, 테스터 피드백 2번·사용자 결정). 들어오자마자 '내 크루의 방'이 보이게:
 * 크루 이름·현재 상황 한 줄, 그리고 활동 영역을 카드로 한 화면에 모은다.
 *   공지: 크루장 공지 + 운영(관리자) 공지
 *   미션: 크루원은 달성률·이번 주 할 일·남은/완료, 크루장은 미션 배정 상태 숫자·검토할 미션
 *   최근 게시물: 자유게시판 글
 *   Q&A: 크루원은 내 질문(답변 여부), 크루장은 답변을 기다리는 질문
 * 단계별 로드맵은 넣지 않는다 (테스터 피드백). 숫자는 모두 업무 기록에서 계산한다.
 */
export function CrewHomePage({ crewId }: { crewId: string }) {
  const { data, user, navigate, setListFilter } = useStore();
  const [now] = useState(() => new Date().toISOString());
  const crew = getCrew(data, crewId);
  if (!crew) return null;
  const { category, intro } = crewProfile(crew);
  const summary = roomSummary(data, crew.id, now);
  const isLeader = user.role === 'leader';
  const toMissions = (filter: 'all' | 'todo') => {
    setListFilter(filter);
    void navigate({ screen: 'missions', crewId: crew.id });
  };

  return (
    <div className={`${ps.screen} ${ps.explore}`}>
      <div className={styles.head}>
        <div className={ps.headRow}>
          <h1 className={ps.title}>{crew.name} 크루방</h1>
          {category && (
            <span className={styles.category}>
              <span className="sr-only">카테고리 </span>
              {category}
            </span>
          )}
        </div>
        <p className={styles.status} aria-label="크루 현재 상황">
          <span>크루장 {getUser(data, crew.leaderId)?.name}</span>
          <span>
            크루원 <span className="num">{summary.members}</span>명
          </span>
          <span>
            진행 중 미션 <span className="num">{summary.activeMissions}</span>개
          </span>
          <span>
            이번 주 마감 <span className="num">{summary.dueThisWeek}</span>개
          </span>
        </p>
        {intro && <p className={styles.introLine}>{intro}</p>}
      </div>

      <div className={styles.cards}>
        <NoticeCard crewId={crew.id} />
        {isLeader ? (
          <section className={styles.card} aria-labelledby="room-missions-title">
            <CardHead id="room-missions-title" title="미션 현황">
              <Button size="sm" variant="quiet" onClick={() => toMissions('all')}>
                미션 전체 보기
              </Button>
            </CardHead>
            <StatusNumbers result={{ ...summary.counts, unit: '건' }} totalLabel="미션 배정" label="크루 미션 배정 상태" />
            <p className={styles.unitNote}>크루원 1명 × 미션 1개 = 1건</p>
            <LeaderReviewList onAll={() => toMissions('todo')} />
            <div className={styles.cardActions}>
              <Button size="sm" variant="action" onClick={() => void navigate({ screen: 'mission-create', crewId: crew.id })}>
                미션 등록
              </Button>
            </div>
          </section>
        ) : (
          <MemberMissionCard onAll={(f) => toMissions(f)} now={now} />
        )}
        <PostsCard crewId={crew.id} />
        <QnaCard crewId={crew.id} />
      </div>
    </div>
  );
}

function CardHead({ id, title, children }: { id: string; title: string; children?: React.ReactNode }) {
  return (
    <div className={styles.cardHead}>
      <h2 className={styles.cardTitle} id={id}>
        {title}
      </h2>
      {children}
    </div>
  );
}

/** 공지: 크루장 공지와 운영 공지 최신 3건. 운영 공지는 내용까지 바로 읽는다 */
function NoticeCard({ crewId }: { crewId: string }) {
  const { data, navigate } = useStore();
  const notices = roomNotices(data, crewId);
  return (
    <section className={`${styles.card} ${styles.noticeCard}`} aria-labelledby="room-notices-title">
      <CardHead id="room-notices-title" title="공지">
        <Button size="sm" variant="quiet" onClick={() => void navigate({ screen: 'notice', crewId })}>
          공지 전체 보기
        </Button>
      </CardHead>
      {notices.length === 0 ? (
        <p className={styles.empty}>아직 공지가 없어요. 크루장 공지와 운영 공지가 여기에 보여요.</p>
      ) : (
        <ul className={styles.noticeList} aria-label="최근 공지">
          {notices.map((n) => (
            <li key={n.id} className={styles.noticeItem}>
              <NoticeTag source={n.source} />
              <div className={styles.noticeBody}>
                <button
                  type="button"
                  className={styles.noticeLink}
                  onClick={() => void navigate(n.postId ? { screen: 'notice', crewId, postId: n.postId } : { screen: 'notice', crewId, adminNoticeId: n.id })}
                >
                  {n.title}
                </button>
                {n.body && <p className={styles.noticeText}>{n.body}</p>}
                <p className={styles.meta}>
                  {n.by} · <time dateTime={n.at}>{formatList(n.at)}</time>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 크루원 미션: 달성률(원형), 이번 주 할 일, 남은 미션·완료, 할 일 최대 3개 */
function MemberMissionCard({ onAll, now }: { onAll: (f: 'all' | 'todo') => void; now: string }) {
  const { data, user, navigate } = useStore();
  const p = memberProgress(data, user);
  const week = thisWeekTodo(data, user, now);
  return (
    <section className={styles.card} aria-labelledby="room-missions-title">
      <CardHead id="room-missions-title" title="내 미션">
        <Button size="sm" variant="quiet" onClick={() => onAll('all')}>
          미션 전체 보기 ({visibleMissions(data, user).length})
        </Button>
      </CardHead>
      <div className={styles.progress}>
        <Ring rate={p.rate} />
        <dl className={styles.stats}>
          <div>
            <dt>이번 주 할 일</dt>
            <dd>
              <span className="num">{week.length}</span>건
            </dd>
          </div>
          <div>
            <dt>남은 미션</dt>
            <dd>
              <span className="num">{p.remaining}</span>개
            </dd>
          </div>
          <div>
            <dt>완료한 미션</dt>
            <dd>
              <span className="num">{p.completed}</span>개
            </dd>
          </div>
        </dl>
      </div>
      {week.length === 0 ? (
        <p className={styles.empty}>이번 주에 할 일이 없어요.</p>
      ) : (
        <ul className={styles.rows} aria-label="이번 주 할 일">
          {week.slice(0, 3).map(({ mission, status }) => (
            <li key={mission.id} className={styles.row}>
              <button type="button" className={styles.rowLink} onClick={() => void navigate({ screen: 'mission', missionId: mission.id })}>
                {mission.title}
              </button>
              <span className={styles.meta}>
                <StatusChip status={status} />
                마감 <time dateTime={mission.dueAt}>{formatList(mission.dueAt)}</time>
                {mission.demoDue && <Tag variant="sim">시연용 기한</Tag>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {week.length > 3 && (
        <div className={styles.cardActions}>
          <Button size="sm" onClick={() => onAll('todo')}>
            내 할 일 전체 보기 ({week.length})
          </Button>
        </div>
      )}
    </section>
  );
}

/** 달성률 원형 (완료 / 배정). 색만으로 전하지 않도록 숫자를 가운데에 쓴다 */
function Ring({ rate }: { rate: number | null }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const v = rate ?? 0;
  return (
    <figure className={styles.ring} aria-label={rate === null ? '내 미션 달성률: 배정된 미션 없음' : `내 미션 달성률 ${rate}%`}>
      <svg viewBox="0 0 84 84" aria-hidden="true">
        <circle cx="42" cy="42" r={r} className={styles.ringTrack} />
        {v > 0 && <circle cx="42" cy="42" r={r} className={styles.ringValue} strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 42 42)" />}
      </svg>
      <figcaption className={styles.ringText}>
        <span className={styles.ringNum}>{rate === null ? '–' : <span className="num">{rate}</span>}</span>
        {rate !== null && <span className={styles.ringUnit}>%</span>}
        <span className={styles.ringLabel}>달성률</span>
      </figcaption>
    </figure>
  );
}

function LeaderReviewList({ onAll }: { onAll: () => void }) {
  const { data, user, navigate } = useStore();
  const todo = leaderReviewTodo(data, user);
  if (todo.length === 0) return <p className={styles.empty}>지금 검토할 제출물이 없어요.</p>;
  return (
    <>
      <ul className={styles.rows} aria-label="검토를 기다리는 미션">
        {todo.slice(0, 3).map(({ mission, counts }) => (
          <li key={mission.id} className={styles.row}>
            <button type="button" className={styles.rowLink} onClick={() => void navigate({ screen: 'review', missionId: mission.id })}>
              {mission.title}
            </button>
            <span className={styles.meta}>
              <span className="status-glyph" data-status="pending_review" aria-hidden="true" /> 검토 대기 <span className="num">{counts.counts.pending_review}</span>명
            </span>
          </li>
        ))}
      </ul>
      {todo.length > 3 && (
        <Button size="sm" variant="quiet" onClick={onAll}>
          검토할 미션 전체 보기 ({todo.length})
        </Button>
      )}
    </>
  );
}

function PostsCard({ crewId }: { crewId: string }) {
  const { data, user, navigate } = useStore();
  const posts = recentPosts(data, user, crewId);
  return (
    <section className={styles.card} aria-labelledby="room-posts-title">
      <CardHead id="room-posts-title" title="최근 게시물">
        <Button size="sm" variant="quiet" onClick={() => void navigate({ screen: 'community', crewId })}>
          자유게시판 보기
        </Button>
      </CardHead>
      {posts.length === 0 ? (
        <p className={styles.empty}>아직 올라온 글이 없어요. 자유게시판에 작업이나 소식을 나눠 보세요.</p>
      ) : (
        <ul className={styles.rows} aria-label="최근 게시물">
          {posts.map((p) => (
            <li key={p.id} className={styles.row}>
              <button type="button" className={styles.rowLink} onClick={() => void navigate({ screen: 'community', crewId, postId: p.id })}>
                {p.title}
              </button>
              <span className={styles.meta}>
                {getUser(data, p.authorId)?.name} · <time dateTime={p.createdAt}>{formatList(p.createdAt)}</time> · 댓글{' '}
                <span className="num">{commentsOf(data, p.id).filter((c) => !c.deletedAt).length}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QnaCard({ crewId }: { crewId: string }) {
  const { data, user, navigate } = useStore();
  const isLeader = user.role === 'leader';
  const items = roomQuestions(data, user, crewId);
  const answeredMine = !isLeader && items.some((i) => i.answered);
  return (
    <section className={styles.card} aria-labelledby="room-qna-title">
      <CardHead id="room-qna-title" title={isLeader ? 'Q&A · 답변을 기다리는 질문' : 'Q&A · 내 질문'}>
        <Button size="sm" variant="quiet" onClick={() => void navigate({ screen: 'qna', crewId })}>
          Q&amp;A게시판 보기
        </Button>
      </CardHead>
      {answeredMine && <p className={styles.answeredNote}>내 질문에 크루장 답변이 달렸어요.</p>}
      {items.length === 0 ? (
        <p className={styles.empty}>{isLeader ? '답변을 기다리는 질문이 없어요.' : '아직 올린 질문이 없어요. 궁금한 점을 크루장에게 물어보세요.'}</p>
      ) : (
        <ul className={styles.rows} aria-label={isLeader ? '답변을 기다리는 질문' : '내 질문'}>
          {items.map(({ post, answered }) => (
            <li key={post.id} className={styles.row}>
              <button type="button" className={styles.rowLink} onClick={() => void navigate({ screen: 'qna', crewId, postId: post.id })}>
                {post.title}
              </button>
              <span className={styles.meta}>
                <Tag>{answered ? '답변 완료' : '답변 대기'}</Tag>
                {post.private && <Tag variant="internal">비공개</Tag>}
                {isLeader && <span>{getUser(data, post.authorId)?.name}</span>}
                <time dateTime={post.createdAt}>{formatList(post.createdAt)}</time>
              </span>
            </li>
          ))}
        </ul>
      )}
      {!isLeader && (
        <div className={styles.cardActions}>
          <Button size="sm" onClick={() => void navigate({ screen: 'qna', crewId, writing: true })}>
            질문하기
          </Button>
        </div>
      )}
    </section>
  );
}
