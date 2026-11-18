import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { Character } from '../../components/Character/Character';
import { DueBadge } from '../../components/DueBadge/DueBadge';
import { NoticeTag } from '../../components/NoticeTag/NoticeTag';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { authorLabel, boardPosts } from '../../domain/board';
import { adminHomeNotices, homeStatus, leaderTodo, memberProgress, roomSummary, urgentUnsubmitted, type StatusCard } from '../../domain/crewRoom';
import { dueState } from '../../domain/due';
import { inboxFor, type InboxItem } from '../../domain/inbox';
import { getCrew, getUser } from '../../domain/queries';
import { formatCount, formatDateOnly, formatDueLong, formatList } from '../../domain/time';
import type { User } from '../../domain/types';
import { leaderReviewTodo, memberTodo } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import type { Route } from '../../state/routes';
import { Landing } from './Landing';
import { LP_ART } from './landingArt';
import { SubmissionCover } from '../../components/SubmissionCover/SubmissionCover';
import { Tag } from '../../components/Tag/Tag';
import { crewProfile } from '../../domain/crewProfile';
import { parseYouTube } from '../../domain/linkCover';
import { showcaseViews } from '../../domain/showcase';
import styles from './Home.module.css';

/**
 * 홈 (v0.7 6.1·6.2, 사용자 확정 견본 v3). 로그인 전에는 공개 홈(Landing), 로그인 뒤에는 역할별 홈.
 * 로그인 홈은 '지금 확인해야 하는가?'만 담는다(자세한 것은 크루방):
 *   환영 상자(인사 + 내 현황 숫자 + 캐릭터) → 2열: [가장 먼저 할 일 · 새 소식] | [크루방 바로가기 · 전체 크루 게시판]
 * 크루장은 같은 뼈대에 '검토를 기다리는 미션', 관리자는 회색 환영 상자 + 공지사항 + 새 소식(사용자 확정: 통일).
 */
export function HomePage() {
  const { session } = useStore();
  if (!session) return <Landing />;
  return <MemberHome user={session} />;
}

function MemberHome({ user }: { user: User }) {
  const { navigate, pending, clearPending } = useStore();
  const pendingLabel = pending?.screen === 'mission' && pending.feedbackId ? '선택했던 피드백 보기' : '선택했던 기능으로 이동';
  return (
    <div className={styles.home}>
      <Welcome user={user} />
      {pending && (
        <div className={styles.pending}>
          <p>로그인 전에 선택했던 화면이 있어요.</p>
          <div className={styles.row}>
            <Button
              variant="strong"
              onClick={async () => {
                const target: Route = pending;
                if (await navigate(target)) clearPending();
              }}
            >
              {pendingLabel}
            </Button>
            <Button variant="quiet" onClick={clearPending}>
              닫기
            </Button>
          </div>
        </div>
      )}
      <div className={styles.layout}>
        <div className={styles.mainCol}>
          {user.role === 'member' && <FirstTask user={user} />}
          {user.role === 'leader' && <ReviewFirst user={user} />}
          {user.role === 'admin' && <AdminNotices user={user} />}
          <News user={user} />
          <ShowcaseTiles />
        </div>
        <aside className={styles.asideCol} aria-label={user.role === 'admin' ? '커뮤니티' : '내 크루와 게시판'}>
          {user.role !== 'admin' && <RoomLink user={user} />}
          <BoardLatest admin={user.role === 'admin'} />
        </aside>
      </div>
    </div>
  );
}

/** 환영 상자: 인사 + 내 현황 숫자 줄 + 캐릭터. 관리자는 회색 바탕 + `운영 관리로` */
function Welcome({ user }: { user: User }) {
  const { data, navigate } = useStore();
  const pendingReviews = user.role === 'leader' ? leaderReviewTodo(data, user).length : 0;
  const title =
    user.role === 'admin'
      ? `${user.name}님, 안녕하세요! 운영 현황 안내드립니다.`
      : user.role === 'leader'
        ? pendingReviews > 0
          ? `${user.name}님, 오늘 검토할 제출물이 있어요`
          : `${user.name}님, 크루 활동을 확인해 볼까요?`
        : `${user.name}님, 이번 주 콘텐츠를 만들어볼까요?`;
  return (
    <section className={styles.welcome} data-admin={user.role === 'admin' || undefined} aria-labelledby="personal-title">
      <div className={styles.welcomeText}>
        <h1 className={styles.welcomeTitle} id="personal-title">
          {title}
        </h1>
        {user.role !== 'admin' && !user.crewId && <p className={styles.muted}>아직 배정된 크루가 없어요. 이용 가이드에서 사용 방법을 볼 수 있어요.</p>}
        <StatusStrip user={user} />
      </div>
      {user.role === 'admin' ? (
        <Button variant="action" onClick={() => void navigate({ screen: 'overview' })}>
          운영 관리로
        </Button>
      ) : (
        <Character size="welcome" />
      )}
    </section>
  );
}

/** 내 현황 숫자 줄 (v0.7 5.5): 칸 전체가 링크. 크루장 '미제출'은 누르면 마감 지남/임박 목록이 펼쳐진다 */
function StatusStrip({ user }: { user: User }) {
  const { data, navigate, setListFilter } = useStore();
  const [now] = useState(() => new Date().toISOString());
  const [openUnsub, setOpenUnsub] = useState(false);
  const crewId = user.crewId;
  const go = (card: StatusCard) => {
    switch (card.key) {
      case 'rate':
      case 'week':
        // v0.7: 달성률·이번 주 할 일은 크루방으로
        return crewId ? void navigate({ screen: 'crew', crewId }) : undefined;
      case 'review': {
        if (!crewId) return;
        const first = leaderTodo(data, crewId, now).reviews[0];
        if (first) return void navigate({ screen: 'review', missionId: first.mission.id, filter: 'pending_review' });
        setListFilter('todo');
        return void navigate({ screen: 'missions', crewId });
      }
      case 'unsubmitted':
        return setOpenUnsub((o) => !o);
      case 'offers':
        return void navigate({ screen: 'my-proposals' });
      case 'inbox':
        return void navigate({ screen: 'inbox' });
      case 'questions':
        return crewId ? void navigate({ screen: 'qna', crewId }) : undefined;
      case 'stale-offers':
      case 'recommend':
        return void navigate({ screen: 'overview', view: 'offers' });
      case 'delayed':
        return void navigate({ screen: 'overview' });
    }
  };
  const cards = homeStatus(data, user, now);
  return (
    <>
      <ul className={styles.stats} aria-label={user.role === 'admin' ? '운영 현황' : '내 현황'} data-n={cards.length}>
        {cards.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              className={styles.stat}
              onClick={() => go(c)}
              aria-label={`${c.label} ${c.value ?? '없음'}${c.value === null ? '' : c.unit}${c.key === 'unsubmitted' ? `, ${c.hint}` : ''}`}
              aria-expanded={c.key === 'unsubmitted' ? openUnsub : undefined}
              aria-controls={c.key === 'unsubmitted' ? 'home-unsubmitted' : undefined}
            >
              <span className={styles.statLabel}>
                {c.label}
                {c.key === 'unsubmitted' && <span aria-hidden="true"> {openUnsub ? '▴' : '▾'}</span>}
              </span>
              <span className={styles.statNum}>
                {c.value === null ? '–' : <span className="num">{formatCount(c.value)}</span>}
                {c.value !== null && <small>{c.unit}</small>}
              </span>
              <span className={styles.statSub}>{c.hint}</span>
            </button>
          </li>
        ))}
      </ul>
      {openUnsub && crewId && <UnsubmittedPanel crewId={crewId} now={now} onClose={() => setOpenUnsub(false)} />}
    </>
  );
}

/** 크루장 '미제출' 펼침: 마감 지남(이미 늦음) / 마감 임박(24시간 안, 재촉 알림 대상) */
function UnsubmittedPanel({ crewId, now, onClose }: { crewId: string; now: string; onClose: () => void }) {
  const { data, navigate } = useStore();
  const { late, soon } = urgentUnsubmitted(data, crewId, now);
  const name = (id: string) => getUser(data, id)?.name ?? '';
  const group = (kind: 'late' | 'soon', rows: typeof late) =>
    rows.length > 0 && (
      <>
        <li className={styles.unsubGroup}>
          <DueBadge state={kind} /> <span className="num">{rows.length}</span>명 · {kind === 'late' ? '이미 늦었어요' : '24시간 안, 아직 기간 안'}
        </li>
        {rows.map((r) => (
          <li key={`${r.mission.id}-${r.memberId}`} className={styles.unsubRow}>
            <div className={styles.unsubMain}>
              <b>
                {name(r.memberId)} · {r.mission.title}
              </b>
              <span>
                {kind === 'late' ? '지난 마감' : '마감'} <time dateTime={r.mission.dueAt}>{formatList(r.mission.dueAt)}</time>
              </span>
            </div>
            <Button size="sm" onClick={() => void navigate({ screen: 'mission', missionId: r.mission.id })} aria-label={kind === 'late' ? `${name(r.memberId)} ${r.mission.title} 미션 보기` : `${r.mission.title} 제출 재촉 알림 보내기`}>
              {kind === 'late' ? '미션 보기' : '제출 재촉 알림 보내기'}
            </Button>
          </li>
        ))}
      </>
    );
  return (
    <div className={styles.unsubPanel} id="home-unsubmitted">
      <div className={styles.unsubHead}>
        <h3>미제출 {late.length + soon.length}명</h3>
        <Button size="sm" variant="quiet" onClick={onClose}>
          접기
        </Button>
      </div>
      {late.length + soon.length === 0 ? (
        <p className={styles.muted}>마감이 지났거나 24시간 안으로 남은 미제출이 없어요.</p>
      ) : (
        <ul className={styles.unsubList} aria-label="급한 미제출 목록">
          {group('late', late)}
          {group('soon', soon)}
        </ul>
      )}
    </div>
  );
}

/** 크루원 '가장 먼저 할 일' (v0.7 5.6): 마감이 가장 가까운 미제출·보완 요청 하나 + 남은 할 일 한 줄 목록 */
function FirstTask({ user }: { user: User }) {
  const { data, navigate } = useStore();
  const [now] = useState(() => new Date().toISOString());
  const todo = memberTodo(data, user);
  const crew = getCrew(data, user.crewId);
  const first = todo[0];
  return (
    <section aria-labelledby="first-title">
      <div className={styles.secHead}>
        <h2 className={styles.secTitle} id="first-title">
          가장 먼저 할 일
        </h2>
        <span className={styles.muted}>마감이 가장 가까운 순서</span>
      </div>
      {!first ? (
        <p className={styles.emptyCard}>지금 할 일이 없어요. 새 미션이나 보완 요청이 생기면 여기에 보여요.</p>
      ) : (
        <>
          <article className={styles.firstCard} aria-labelledby="first-task">
            <div className={styles.firstBody}>
              <p className={styles.metaRow}>
                <StatusChip status={first.status} />
                <DueBadge state={dueState(first.mission, first.status, now)} />
                {crew && <span>{crew.name} 크루</span>}
              </p>
              <h3 id="first-task">{first.mission.title}</h3>
              <p className={styles.muted}>{first.status === 'revision_requested' ? `크루장 ${getUser(data, crew?.leaderId ?? '')?.name ?? ''}이 보완할 점을 남겼어요.` : '아직 제출하지 않았어요.'}</p>
              <p className={styles.urgent}>{formatDueLong(first.mission.dueAt, now)}</p>
            </div>
            <Button variant="action" onClick={() => void navigate({ screen: 'mission', missionId: first.mission.id })}>
              {first.status === 'revision_requested' ? '수정본 제출하기' : '미션 열기'}
            </Button>
          </article>
          {todo.length > 1 && (
            <ul className={styles.nextList} aria-label="남은 할 일">
              {todo.slice(1, 4).map(({ mission, status }) => (
                <li key={mission.id}>
                  <StatusChip status={status} />
                  <button type="button" className={styles.nextLink} onClick={() => void navigate({ screen: 'mission', missionId: mission.id })}>
                    {mission.title}
                  </button>
                  <span className={styles.muted}>{formatDateOnly(mission.dueAt, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/** 크루장 '검토를 기다리는 미션': 가장 먼저 검토할 미션 하나(주황 '검토하기') + 나머지 한 줄 */
function ReviewFirst({ user }: { user: User }) {
  const { data, navigate } = useStore();
  const todo = leaderReviewTodo(data, user);
  const first = todo[0];
  return (
    <section aria-labelledby="first-title">
      <div className={styles.secHead}>
        <h2 className={styles.secTitle} id="first-title">
          검토를 기다리는 미션
        </h2>
        <span className={styles.muted}>마감이 가까운 순서</span>
      </div>
      {!first ? (
        <p className={styles.emptyCard}>지금 검토할 제출물이 없어요. 크루원이 제출하면 여기에 보여요.</p>
      ) : (
        <>
          <article className={styles.firstCard} aria-labelledby="first-task">
            <div className={styles.firstBody}>
              <p className={styles.metaRow}>
                <span className={styles.pendingChip}>
                  <span className="status-glyph" data-status="pending_review" aria-hidden="true" /> 검토 대기 <span className="num">{first.counts.counts.pending_review}</span>명
                </span>
              </p>
              <h3 id="first-task">
                <button type="button" className={styles.titleLink} onClick={() => void navigate({ screen: 'mission', missionId: first.mission.id })}>
                  {first.mission.title}
                </button>
              </h3>
              <p className={styles.urgent}>{formatDueLong(first.mission.dueAt)}</p>
            </div>
            <Button variant="action" onClick={() => void navigate({ screen: 'review', missionId: first.mission.id, filter: 'pending_review' })} aria-label={`${first.mission.title} 검토하기`}>
              검토하기
            </Button>
          </article>
          {todo.length > 1 && (
            <ul className={styles.nextList} aria-label="다른 검토 대기">
              {todo.slice(1, 4).map(({ mission, counts }) => (
                <li key={mission.id}>
                  <span className={styles.pendingChip}>
                    <span className="status-glyph" data-status="pending_review" aria-hidden="true" /> 검토 대기 <span className="num">{counts.counts.pending_review}</span>명
                  </span>
                  <button type="button" className={styles.nextLink} onClick={() => void navigate({ screen: 'review', missionId: mission.id, filter: 'pending_review' })} aria-label={`${mission.title} 검토하기`}>
                    {mission.title}
                  </button>
                  <span className={styles.muted}>{formatDateOnly(mission.dueAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/** 관리자 공지사항 (E3): 담당 크루 전체의 운영 공지 + 크루장 공지 최신 2건. v0.7: 주황 테두리 대신 흰 띠 */
function AdminNotices({ user }: { user: User }) {
  const { data, navigate } = useStore();
  const notices = adminHomeNotices(data, user, 2);
  return (
    <section aria-labelledby="home-notice-title">
      <div className={styles.secHead}>
        <h2 className={styles.secTitle} id="home-notice-title">
          공지사항
        </h2>
        <button type="button" className={styles.linkBtn} onClick={() => void navigate({ screen: 'overview', view: 'notices' })}>
          공지 관리로
        </button>
      </div>
      {notices.length === 0 ? (
        <p className={styles.emptyCard}>아직 공지가 없어요.</p>
      ) : (
        <ul className={styles.noticeStrip} aria-label="최근 공지">
          {notices.map((n) => (
            <li key={n.id}>
              <NoticeTag source={n.source} />
              <button
                type="button"
                className={styles.nsLink}
                onClick={() => void navigate(n.postId ? { screen: 'notice', crewId: n.crewId, postId: n.postId } : { screen: 'notice', crewId: n.crewId, adminNoticeId: n.id })}
              >
                {n.title}
              </button>
              <span className={styles.muted}>
                {n.crewLabel} · {formatList(n.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 새 소식 (v0.7 5.7): 크루를 가리지 않는 확인 사항. 피드백 도착은 '가장 먼저 할 일'에 있어 넣지 않는다 */
const NEWS_KINDS: Record<User['role'], InboxItem['kind'][]> = {
  member: ['offer', 'offer-update', 'offer-remind', 'notice', 'admin-notice', 'answer'],
  leader: ['offer', 'offer-update', 'offer-remind', 'question', 'notice', 'admin-notice', 'stale'],
  admin: ['offer-response', 'offer-recommend', 'offer-stale', 'stale', 'proposal'],
};

function News({ user }: { user: User }) {
  const { data, navigate } = useStore();
  const items = inboxFor(data, user)
    .filter((i) => NEWS_KINDS[user.role].includes(i.kind))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4);
  return (
    <section aria-labelledby="news-title">
      <div className={styles.secHead}>
        <h2 className={styles.secTitle} id="news-title">
          새 소식
        </h2>
        <button type="button" className={styles.linkBtn} onClick={() => void navigate({ screen: 'inbox' })}>
          알림함 전체
        </button>
      </div>
      {items.length === 0 ? (
        <p className={styles.emptyCard}>새 소식이 없어요.</p>
      ) : (
        <ul className={styles.newsList} aria-label="새 소식">
          {items.map((i) => (
            <li key={i.id}>
              <span className={styles.newsIcon} aria-hidden="true">
                {NEWS_ICON[i.kind] ?? NEWS_ICON.default}
              </span>
              <div className={styles.newsBody}>
                <button type="button" className={styles.newsLink} onClick={() => void navigate(i.target as Route)}>
                  {i.text}
                </button>
                <p className={styles.muted}>
                  <time dateTime={i.at}>{formatList(i.at)}</time>
                </p>
              </div>
              {i.kind === 'notice' ? <NoticeTag source="crew" /> : i.kind === 'admin-notice' ? <NoticeTag source="admin" /> : <span className={styles.newsTag}>{i.label}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const MEGAPHONE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10v4h3l6 4V6L7 10z" />
    <path d="M17 9a4 4 0 0 1 0 6" />
  </svg>
);
const GIFT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <path d="M4 9h16v4H4zM6 13h12v7H6zM12 9v11" />
  </svg>
);
const BUBBLE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <path d="M4 5h16v11H9l-5 4z" />
  </svg>
);
const NEWS_ICON: Record<string, JSX.Element> = { notice: MEGAPHONE, 'admin-notice': MEGAPHONE, answer: BUBBLE, question: BUBBLE, default: GIFT };

/** 내 크루 바로가기 (v0.7 6.2 오른쪽): 테두리 `크루방으로` */
function RoomLink({ user }: { user: User }) {
  const { data, navigate } = useStore();
  const crew = getCrew(data, user.crewId);
  if (!crew) return null;
  const summary = roomSummary(data, crew.id, new Date().toISOString());
  const done = user.role === 'member' ? memberProgress(data, user).completed : 0;
  return (
    <section className={styles.panel} aria-labelledby="myroom-title">
      <p className={styles.muted}>내 크루</p>
      <h2 className={styles.roomName} id="myroom-title">
        {crew.name} 크루방
      </h2>
      <p className={styles.roomSub}>
        진행 중 미션 <span className="num">{summary.activeMissions}</span>개 · {user.role === 'member' ? <>완료한 콘텐츠 <span className="num">{done}</span>개</> : <>크루원 <span className="num">{summary.members}</span>명</>}
      </p>
      <Button className={styles.block} onClick={() => void navigate({ screen: 'crew', crewId: crew.id })}>
        크루방으로
      </Button>
      <p className={styles.hint}>{user.role === 'member' ? '미션 전체, 피드백, 완성한 콘텐츠는 크루방에서 볼 수 있어요.' : '미션 등록·수정, 크루 성과는 크루방에서 할 수 있어요.'}</p>
    </section>
  );
}

/** 전체 크루 게시판 최신 3개: [질문] 표시, '작성자 | 날짜 | 댓글 n' */
function BoardLatest({ admin }: { admin: boolean }) {
  const { data, user, navigate } = useStore();
  const posts = boardPosts(data, user).filter((p) => !p.hidden).slice(0, 3);
  return (
    <section className={styles.panel} aria-labelledby="home-board-title">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle} id="home-board-title">
          {admin ? '커뮤니티' : '전체 크루 게시판'}
        </h2>
        <button type="button" className={styles.linkBtn} onClick={() => void navigate({ screen: 'board' })}>
          전체보기
        </button>
      </div>
      {admin && <p className={styles.hint}>담당 크루의 공지·자유게시판·Q&amp;A(읽기 전용)와 전체 크루 게시판</p>}
      {posts.length === 0 ? (
        <p className={styles.muted}>아직 올라온 글이 없어요.</p>
      ) : (
        <ul className={styles.boardList} aria-label="전체 크루 게시판 최신 글">
          {posts.map((p) => (
            <li key={p.id}>
              <button type="button" className={styles.boardLink} onClick={() => void navigate({ screen: 'board', postId: p.id })}>
                {p.question && <span className={styles.qTag}>질문</span>}
                {p.title}
              </button>
              <p className={styles.muted}>
                {authorLabel(data, p.authorId)}
                <span className={styles.sep} aria-hidden="true" />
                {formatList(p.createdAt)}
                <span className={styles.sep} aria-hidden="true" />
                댓글 {data.globalComments.filter((c) => c.postId === p.id && !c.deletedAt && !c.hidden).length}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * 우수 사례 작은 카드 (사용자 확정 배치 B, 2026-11-18): 새 소식 아래 3칸. 공개 동의한 사례만, 최근 지정 순.
 * 카드를 누르면 우수 사례 페이지의 그 사례로. 사례가 없으면 칸을 숨긴다. 휴대폰은 옆으로 미는 카드.
 */
function ShowcaseTiles() {
  const { data, navigate } = useStore();
  const views = showcaseViews(data).slice(0, 3);
  if (views.length === 0) return null;
  return (
    <section aria-labelledby="home-cases-title">
      <div className={styles.secHead}>
        <h2 className={styles.secTitle} id="home-cases-title">
          우수 사례
        </h2>
        <button type="button" className={styles.linkBtn} onClick={() => void navigate({ screen: 'showcases' })}>
          우수 사례 전체
        </button>
      </div>
      <p className={styles.caseFlag}>
        <Tag variant="sim">시연용 가상 사례</Tag>
      </p>
      <ul className={styles.caseTiles} aria-label="우수 사례">
        {views.map((v, i) => {
          const category = crewProfile(v.crew).category;
          const title = v.showcase.headline ?? v.mission.title;
          const m = v.metric;
          return (
            <li key={v.showcase.id} className={styles.caseTile}>
              <button type="button" className={styles.caseBtn} onClick={() => void navigate({ screen: 'showcases', showcaseId: v.showcase.id })} aria-label={`${v.creator.name} 우수 사례: ${title}`}>
                {parseYouTube(v.post.url) ? (
                  <SubmissionCover content={v.post.url} format="link" category={category} />
                ) : (
                  <span className={styles.caseArt} aria-hidden="true" dangerouslySetInnerHTML={{ __html: LP_ART.cases[i % LP_ART.cases.length] }} />
                )}
                <span className={styles.caseBody}>
                  <span className={styles.caseTop}>
                    {category && <span className={styles.caseCat}>{category}</span>}
                    <span className={styles.muted}>
                      {v.crew.name} · {v.creator.name}
                    </span>
                  </span>
                  <span className={styles.caseTitle}>{title}</span>
                  <span className={styles.muted}>{m.kind === 'views' ? <>조회수 <span className="num">{formatCount(m.latest.views!)}</span></> : '조회수 확인 전'}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
