import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { StatusNumbers } from '../../components/Distribution/Distribution';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { Tag } from '../../components/Tag/Tag';
import { NoticeTag } from '../../components/NoticeTag/NoticeTag';
import { commentsOf } from '../../domain/community';
import { crewProfile } from '../../domain/crewProfile';
import { DUE_GROUP_LABEL, leaderTodo, memberProgress, recentPosts, roomNotices, roomQuestions, roomSummary, thisWeekTodo, type DueGroup } from '../../domain/crewRoom';
import { getCrew, getUser } from '../../domain/queries';
import { formatList } from '../../domain/time';
import { visibleMissions } from '../../domain/views';
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

      {isLeader && <LeaderTodoSection crewId={crew.id} now={now} />}

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
          </section>
        ) : (
          <MemberMissionCard onAll={(f) => toMissions(f)} now={now} />
        )}
        <PostsCard crewId={crew.id} />
        {/* 크루장의 답변 대기 질문은 위 '처리할 일'에 있어 Q&A 카드는 크루원에게만 */}
        {!isLeader && <QnaCard crewId={crew.id} />}
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

type TodoKind = 'review' | 'unsubmitted' | 'questions';

/**
 * 크루장 '처리할 일' (UI 개선 B): 맨 위에 미션 만들기와 상태 숫자 3개. 숫자를 누르면 아래 목록이 그 상태로 좁혀진다.
 * 목록 한 줄 = 이름 · 미션(또는 질문) · 제출 차수나 마감. 줄의 버튼으로 바로 처리하러 간다.
 */
function LeaderTodoSection({ crewId, now }: { crewId: string; now: string }) {
  const { data, navigate } = useStore();
  const todo = leaderTodo(data, crewId, now);
  const counts: Record<TodoKind, number> = { review: todo.reviews.length, unsubmitted: todo.unsubmitted.length, questions: todo.questions.length };
  const [kind, setKind] = useState<TodoKind>(() => (counts.review ? 'review' : counts.unsubmitted ? 'unsubmitted' : counts.questions ? 'questions' : 'review'));
  const urgent = todo.unsubmitted.filter((u) => u.group !== 'later');
  const name = (id: string) => getUser(data, id)?.name ?? '';
  const chips: { key: TodoKind; label: string; sub?: string }[] = [
    { key: 'review', label: '검토 대기' },
    {
      key: 'unsubmitted',
      label: '미제출',
      sub: urgent.length ? `마감 지남 ${todo.unsubmitted.filter((u) => u.group === 'overdue').length} · 24시간 안 ${todo.unsubmitted.filter((u) => u.group === 'soon').length}` : undefined,
    },
    { key: 'questions', label: '답변 대기' },
  ];
  const groups = (['overdue', 'soon', 'later'] as DueGroup[]).map((g) => [g, todo.unsubmitted.filter((u) => u.group === g)] as const).filter(([, rows]) => rows.length);
  return (
    <section className={styles.todo} aria-labelledby="leader-todo-title">
      <div className={styles.todoHead}>
        <h2 className={styles.todoTitle} id="leader-todo-title">
          처리할 일
        </h2>
        <Button variant="action" onClick={() => void navigate({ screen: 'mission-create', crewId })}>
          ＋ 미션 만들기
        </Button>
      </div>
      <div className={styles.chips} role="group" aria-label="상태로 목록 좁히기">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            className={styles.chip}
            aria-pressed={kind === c.key}
            aria-label={`${c.label} ${counts[c.key]}${c.sub ? `, ${c.sub}` : ''}`}
            onClick={() => setKind(c.key)}
          >
            <span className={styles.chipLabel}>{c.label}</span>
            <span className={styles.chipNum}>{counts[c.key]}</span>
            {c.sub && <span className={styles.chipSub}>{c.sub}</span>}
          </button>
        ))}
      </div>
      {kind === 'review' &&
        (todo.reviews.length === 0 ? (
          <p className={styles.empty}>지금 검토할 제출물이 없어요.</p>
        ) : (
          <ul className={styles.todoList} aria-label="검토 대기 목록">
            {todo.reviews.map((r) => (
              <li key={`${r.mission.id}-${r.memberId}`} className={styles.todoRow}>
                <div className={styles.todoMain}>
                  <b>
                    {name(r.memberId)} · {r.mission.title}
                  </b>
                  <span>
                    {r.versionNumber}차 제출 · <time dateTime={r.submittedAt}>{formatList(r.submittedAt)}</time>
                    {r.waitingLong && <span className={styles.longWait}> · 2일 넘게 기다림</span>}
                  </span>
                </div>
                <Button size="sm" onClick={() => void navigate({ screen: 'review', missionId: r.mission.id, memberId: r.memberId })} aria-label={`${name(r.memberId)} ${r.mission.title} 검토하기`}>
                  검토하기
                </Button>
              </li>
            ))}
          </ul>
        ))}
      {kind === 'unsubmitted' &&
        (todo.unsubmitted.length === 0 ? (
          <p className={styles.empty}>모두 제출했어요.</p>
        ) : (
          <ul className={styles.todoList} aria-label="미제출 목록">
            {groups.map(([g, rows]) => (
              <li key={g} className={styles.todoGroup}>
                <p className={styles.groupHead}>
                  {DUE_GROUP_LABEL[g]} <span>{rows.length}명</span>
                </p>
                <ul className={styles.todoSub}>
                  {rows.map((u) => (
                    <li key={`${u.mission.id}-${u.memberId}`} className={styles.todoRow}>
                      <div className={styles.todoMain}>
                        <b>
                          {name(u.memberId)} · {u.mission.title}
                        </b>
                        <span>
                          마감 <time dateTime={u.mission.dueAt}>{formatList(u.mission.dueAt)}</time>
                        </span>
                      </div>
                      {g !== 'later' && (
                        <Button size="sm" onClick={() => void navigate({ screen: 'mission', missionId: u.mission.id })} aria-label={`${u.mission.title} 미션 보기`}>
                          미션 보기
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ))}
      {kind === 'questions' &&
        (todo.questions.length === 0 ? (
          <p className={styles.empty}>답변을 기다리는 질문이 없어요.</p>
        ) : (
          <ul className={styles.todoList} aria-label="답변 대기 목록">
            {todo.questions.map((q) => (
              <li key={q.id} className={styles.todoRow}>
                <div className={styles.todoMain}>
                  <b>
                    {name(q.authorId)} · {q.title}
                  </b>
                  <span>
                    Q&amp;A · <time dateTime={q.createdAt}>{formatList(q.createdAt)}</time>
                    {q.private && ' · 비공개'}
                  </span>
                </div>
                <Button size="sm" onClick={() => void navigate({ screen: 'qna', crewId, postId: q.id })} aria-label={`${q.title} 답변하기`}>
                  답변하기
                </Button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
