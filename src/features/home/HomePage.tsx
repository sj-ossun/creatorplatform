import type { ReactNode } from 'react';
import { HeroPoster } from '../../components/HeroPoster/HeroPoster';
import { NoticeTag } from '../../components/NoticeTag/NoticeTag';
import { Button } from '../../components/Button/Button';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { Tag } from '../../components/Tag/Tag';
import { getCrew } from '../../domain/queries';
import { crewBrowse, homeStatus, roomNotices, thisWeekTodo, type StatusCard } from '../../domain/crewRoom';
import { authorLabel, boardPosts, excerpt } from '../../domain/board';
import { formatDay, formatList } from '../../domain/time';
import type { Mission, User } from '../../domain/types';
import { leaderReviewTodo } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import type { Route } from '../../state/routes';
import styles from '../public/Public.module.css';
import sc from '../showcase/Showcase.module.css';
import { showcaseViews } from '../../domain/showcase';
import { crewProfile } from '../../domain/crewProfile';
import { formatCount } from '../../domain/time';

const STEPS = ['로그인', '크루 확인', '미션 수행', '피드백 반영'];

function Due({ mission }: { mission: Mission }) {
  return (
    <span className={styles.due}>
      마감 <time dateTime={mission.dueAt}>{formatList(mission.dueAt)}</time>
      {mission.demoDue && <Tag variant="sim">시연용 기한</Tag>}
    </span>
  );
}

/**
 * P-01 공통 홈 (v0.6 N-01, 6-C). 로그인 전후 같은 페이지.
 *   로그인 전: 포스터(제목·활동 흐름·시작 버튼) → 우수 사례(공개 요약) → 크루 둘러보기 → 이용 과정 → 가이드
 *   로그인 후 (UI 개선 D): 인사·`크루방으로` → 내 현황(숫자 + 이번 주 미션) → 공지사항 → 전체 크루 게시판 | 크루 둘러보기 → 우수 사례 → 가이드
 * 자세한 내용은 크루방에서 본다.
 */
export function HomePage() {
  const { session, navigate } = useStore();
  return (
    <div className={styles.home}>
      {session && <Personal user={session} />}

      {!session && (
        <>
          {/* 포스터의 큰 제목이 곧 페이지 제목. 실제 버튼은 포스터 안 단계 아래 (그림 리본은 장식) */}
          <HeroPoster titleId="hero-title">
            {/* 포스터 바탕이 주황이라 시작 버튼은 검정 (사용자 확정 예외) */}
            <Button variant="strong" onClick={() => void navigate({ screen: 'login', from: { screen: 'home' } })}>
              로그인하고 시작하기
            </Button>
          </HeroPoster>
          <p className={styles.small}>시연용 가상 계정으로 로그인해요. 실제 비밀번호는 입력하지 않아요.</p>
        </>
      )}

      {session ? (
        <>
          {/* D: 내 현황 다음에 공지사항(로고 주황 테두리), 그 아래 전체 크루 게시판 | 크루 둘러보기 (휴대폰은 게시판이 위) */}
          <NoticeBox user={session} />
          <div className={styles.homeCols}>
            <BoardLatest />
            <CrewBrowse compact />
          </div>
          <ShowcaseBanner />
        </>
      ) : (
        <>
          <ShowcaseBanner />
          <CrewBrowse />
        </>
      )}

      {!session && (
      <section className={styles.block} aria-labelledby="steps-title">
        <h2 className={styles.blockTitle} id="steps-title">
          이용 과정
        </h2>
        <ol className={styles.steps}>
          {STEPS.map((s, i) => (
            <li key={s} className={styles.step}>
              <span className={styles.stepNo}>{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </section>
      )}

      <section className={styles.guideBand} aria-labelledby="guide-link-title">
        <div>
          <h2 className={styles.blockTitle} id="guide-link-title">
            처음이라면 이용 가이드부터
          </h2>
          <p>로그인부터 미션 제출, 피드백 반영까지 순서대로 안내해요.</p>
        </div>
        <Button onClick={() => void navigate({ screen: 'guide' })}>이용 가이드 보기</Button>
      </section>
    </div>
  );
}

/** 로그인 사용자 바로가기 + 다음 행동 (최대 3개, 마감 오름차순·같으면 ID). 숫자는 업무 기록에서 계산한다 */
function Personal({ user }: { user: User }) {
  const { data, navigate, pending, clearPending, setListFilter } = useStore();
  const crew = getCrew(data, user.crewId);

  const toMissions = (filter: 'all' | 'todo') => {
    if (!crew) return;
    setListFilter(filter);
    void navigate({ screen: 'missions', crewId: crew.id });
  };

  let shortcuts;
  let next = null;
  if (user.role === 'admin') {
    shortcuts = (
      <Button variant="action" onClick={() => void navigate({ screen: 'overview' })}>
        운영 관리로
      </Button>
    );
  } else if (!crew) {
    shortcuts = null;
  } else {
    // 6-C: 공통 홈을 유지하고 큰 `크루방으로` 버튼 (사용자 결정)
    shortcuts = (
      <Button variant="action" onClick={() => void navigate({ screen: 'crew', crewId: crew.id })}>
        크루방으로
      </Button>
    );
    if (user.role === 'leader') {
      const todo = leaderReviewTodo(data, user);
      next = (
        <NextList
          title="검토를 기다리는 미션"
          empty="지금 검토할 제출물이 없어요. 크루원이 제출하면 여기에 보여요."
          total={todo.length}
          onAll={() => toMissions('todo')}
          allLabel="검토할 미션 전체 보기"
          items={todo.slice(0, 3).map(({ mission, counts }) => ({
            mission,
            status: (
              <span className={styles.count}>
                <span className="status-glyph" data-status="pending_review" aria-hidden="true" /> 검토 대기{' '}
                <span className="num">{counts.counts.pending_review}</span>명
              </span>
            ),
          }))}
          onOpen={(m) => void navigate({ screen: 'mission', missionId: m.id })}
        />
      );
    } else {
      // D: 홈에는 이번 주 미션 요약(상태·마감, 최대 3개). 자세한 건 크루방
      const todo = thisWeekTodo(data, user, new Date().toISOString());
      next = (
        <NextList
          title="이번 주 미션"
          empty="이번 주에 할 미션이 없어요. 새 미션이나 보완 요청이 생기면 여기에 보여요."
          total={todo.length}
          onAll={() => toMissions('todo')}
          allLabel="내 할 일 전체 보기"
          items={todo.slice(0, 3).map(({ mission, status }) => ({ mission, status: <StatusChip status={status} /> }))}
          onOpen={(m) => void navigate({ screen: 'mission', missionId: m.id })}
        />
      );
    }
  }

  const pendingLabel = pending?.screen === 'mission' && pending.feedbackId ? '선택했던 피드백 보기' : '선택했던 기능으로 이동';

  return (
    <section className={styles.personal} aria-labelledby="personal-title">
      <div className={styles.personalHead}>
        <div>
          <h1 className={styles.personalTitle} id="personal-title">
            {user.name}님, 활동을 이어가세요.
          </h1>
          <p className={styles.personalSub}>
            {user.role === 'admin'
              ? `담당 크루 ${user.managedCrewIds.length}곳의 현황은 운영 관리에서 볼 수 있어요.`
              : crew
                ? `${crew.name} 크루`
                : '아직 배정된 크루가 없어요. 이용 가이드에서 사용 방법을 볼 수 있어요.'}
          </p>
        </div>
        <div className={styles.ctas}>{shortcuts}</div>
      </div>
      <StatusCards user={user} />
      {pending && (
        <div className={styles.pending}>
          <p>로그인 전에 선택했던 화면이 있어요.</p>
          <div className={styles.ctas}>
            {/* 한 화면에 주황 버튼은 하나: 위 '크루방으로'가 주 버튼 */}
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
      {next}
    </section>
  );
}

function NextList({
  title,
  empty,
  items,
  total,
  onOpen,
  onAll,
  allLabel,
}: {
  title: string;
  empty: string;
  items: { mission: Mission; status: ReactNode }[];
  total: number;
  onOpen: (m: Mission) => void;
  onAll: () => void;
  allLabel: string;
}) {
  return (
    <div className={styles.next}>
      <div className={styles.nextHead}>
        <h3 className={styles.nextTitle}>{title}</h3>
        {total > 0 && (
          <Button variant="quiet" onClick={onAll}>
            {allLabel}
            {total > items.length ? ` (${total})` : ''}
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className={styles.nextEmpty}>{empty}</p>
      ) : (
        <ul className={styles.nextList} aria-label={title}>
          {items.map(({ mission, status }) => (
            <li key={mission.id} className={styles.nextItem}>
              <div className={styles.nextBody}>
                <p className={styles.nextName}>{mission.title}</p>
                <p className={styles.nextMeta}>
                  {status}
                  <Due mission={mission} />
                </p>
              </div>
              <Button size="sm" onClick={() => onOpen(mission)} aria-label={`${mission.title} 미션 보기`}>
                미션 보기
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 로그인 홈 '내 현황' (6-C): 역할별 요약 숫자. 누르면 해당 화면으로 간다 */
function StatusCards({ user }: { user: User }) {
  const { data, navigate, setListFilter } = useStore();
  const now = new Date().toISOString();
  const crewId = user.crewId;
  const go = (card: StatusCard) => {
    switch (card.key) {
      case 'rate':
        return void navigate({ screen: 'my-performance' });
      case 'week':
      case 'review':
        if (!crewId) return;
        setListFilter('todo');
        return void navigate({ screen: 'missions', crewId });
      case 'due-soon':
        if (!crewId) return;
        setListFilter('all');
        return void navigate({ screen: 'missions', crewId });
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
      case 'reports':
        return void navigate({ screen: 'overview', view: 'reports' });
    }
  };
  const cards = homeStatus(data, user, now);
  return (
    <section aria-labelledby="my-status-title" className={styles.statusBlock}>
      <h2 className={styles.statusTitle} id="my-status-title">
        내 현황
      </h2>
      <ul className={styles.statusCards}>
        {cards.map((c) => (
          <li key={c.key}>
            <button type="button" className={styles.statusCard} onClick={() => go(c)} aria-label={`${c.label} ${c.value ?? '없음'}${c.value === null ? '' : c.unit}`}>
              <span className={styles.statusLabel}>{c.label}</span>
              <span className={styles.statusValue}>
                {c.value === null ? '–' : <span className="num">{formatCount(c.value)}</span>}
                {c.value !== null && <span className={styles.statusUnit}>{c.unit}</span>}
              </span>
              <span className={styles.statusHint}>{c.hint}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 우수 사례 (6-C 두 단계 공개, 사용자 결정): 공개 홈에는 홍보용 요약만 최대 3건.
 * 카테고리·크루, 성과 한 줄, 숫자가 있으면 출처(크리에이터 직접 입력)와 확인일. 크리에이터 이름·링크·학습 포인트는 크루 로그인 후.
 */
function ShowcaseBanner() {
  const { data, session, navigate } = useStore();
  const views = showcaseViews(data).slice(0, 3);
  if (views.length === 0) return null;
  return (
    <section className={sc.banner} aria-labelledby="showcase-banner-title">
      <div className={sc.bannerHead}>
        <h2 className={sc.bannerTitle} id="showcase-banner-title">
          우수 사례
        </h2>
        <Tag variant="sim">시연용 가상 사례</Tag>
      </div>
      <ul className={sc.summaryList} aria-label="우수 사례 요약">
        {views.map((v) => {
          const { category } = crewProfile(v.crew);
          return (
            <li key={v.showcase.id} className={sc.summary}>
              <span className={sc.summaryCrew}>
                {category && <span className={sc.category}>{category}</span>}
                {v.crew.name} 크루
              </span>
              <p className={sc.summaryHeadline}>{v.showcase.headline ?? v.mission.title}</p>
              {v.metric.kind === 'views' && (
                <p className={sc.bannerMeta}>
                  조회수 <span className="num">{formatCount(v.metric.latest.views!)}</span>회 · 크리에이터 직접 입력, 확인일 {formatDay(v.metric.latest.checkedOn)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div>
        {session ? (
          <Button onClick={() => void navigate({ screen: 'showcases' })}>우수 사례 자세히 보기</Button>
        ) : (
          <Button onClick={() => void navigate({ screen: 'login', from: { screen: 'showcases' } })}>크루로 로그인하고 자세히 보기</Button>
        )}
      </div>
    </section>
  );
}

/** 크루 둘러보기 (6-C 공개): 가입 버튼 없는 소개. 크루장 이름·개인 정보는 넣지 않는다 */
function CrewBrowse({ compact = false }: { compact?: boolean }) {
  const { data } = useStore();
  const items = crewBrowse(data, new Date().toISOString());
  if (items.length === 0) return null;
  if (compact) {
    // 로그인 홈: 게시판 옆 좁은 칸용 (이름·카테고리·숫자 한 줄)
    return (
      <section className={styles.sideCard} aria-labelledby="crew-browse-title">
        <h2 className={styles.sideTitle} id="crew-browse-title">
          크루 둘러보기
        </h2>
        <ul className={styles.miniCrews} aria-label="크루 소개">
          {items.map((it) => (
            <li key={it.crew.id} className={styles.miniCrew} aria-label={`${it.crew.name} 크루 소개`}>
              <span className={styles.crewCardHead}>
                {it.category && <span className={sc.category}>{it.category}</span>}
                <b>{it.crew.name} 크루</b>
              </span>
              {it.keywords.length > 0 && <span className={styles.small}>{it.keywords.map((k) => `#${k}`).join(' ')}</span>}
              <span className={styles.small}>
                크루원 {it.members}명 · 이번 달 미션 {it.monthMissions}개 · 우수 사례 {it.showcases}건
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section className={styles.block} aria-labelledby="crew-browse-title">
      <div>
        <h2 className={styles.blockTitle} id="crew-browse-title">
          크루 둘러보기
        </h2>
        <p className={styles.small}>카테고리별 크루가 무엇을 하는지 소개해요. 크루 합류는 운영팀이 따로 안내해요.</p>
      </div>
      <ul className={styles.crewCards} aria-label="크루 소개">
        {items.map((it) => (
          <li key={it.crew.id} className={styles.crewCard} aria-label={`${it.crew.name} 크루 소개`}>
            <div className={styles.crewCardHead}>
              {it.category && <span className={sc.category}>{it.category}</span>}
              <h3 className={styles.crewCardName}>{it.crew.name} 크루</h3>
            </div>
            {it.intro && <p>{it.intro}</p>}
            {it.keywords.length > 0 && (
              <ul className={styles.keywords} aria-label="활동 키워드">
                {it.keywords.map((k) => (
                  <li key={k}>#{k}</li>
                ))}
              </ul>
            )}
            <dl className={styles.crewFacts}>
              <div>
                <dt>크루원</dt>
                <dd>
                  <span className="num">{it.members}</span>명
                </dd>
              </div>
              <div>
                <dt>이번 달 미션</dt>
                <dd>
                  <span className="num">{it.monthMissions}</span>개
                </dd>
              </div>
              <div>
                <dt>우수 사례</dt>
                <dd>
                  <span className="num">{it.showcases}</span>건
                </dd>
              </div>
            </dl>
          </li>
        ))}
        <li className={`${styles.crewCard} ${styles.crewCardSoon}`} aria-label="새 카테고리 크루 준비 중">
          <h3 className={styles.crewCardName}>새 카테고리 크루 준비 중</h3>
          <p className={styles.small}>다른 카테고리 크루도 준비하고 있어요. 소식은 운영팀이 안내해요.</p>
        </li>
      </ul>
    </section>
  );
}

/** 로그인 홈 공지사항 (D, 사용자 확정): 로고 주황 테두리 상자. 크루장 공지·운영 공지 최신 2건 */
function NoticeBox({ user }: { user: User }) {
  const { data, navigate } = useStore();
  const crew = getCrew(data, user.crewId);
  if (!crew || (user.role !== 'member' && user.role !== 'leader')) return null;
  const notices = roomNotices(data, crew.id, 2);
  return (
    <section className={styles.noticeBox} aria-labelledby="home-notice-title">
      <div className={styles.sideHead}>
        <h2 className={styles.sideTitle} id="home-notice-title">
          공지사항
        </h2>
        <Button size="sm" variant="quiet" onClick={() => void navigate({ screen: 'notice', crewId: crew.id })}>
          공지 전체 보기
        </Button>
      </div>
      {notices.length === 0 ? (
        <p className={styles.small}>아직 공지가 없어요.</p>
      ) : (
        <ul className={styles.noticeRows} aria-label="최근 공지">
          {notices.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={styles.noticeRowBtn}
                onClick={() => void navigate(n.postId ? { screen: 'notice', crewId: crew.id, postId: n.postId } : { screen: 'notice', crewId: crew.id, adminNoticeId: n.id })}
              >
                <NoticeTag source={n.source} />
                <span className={styles.noticeTitle}>{n.title}</span>
                <time className={styles.small} dateTime={n.at}>
                  {formatList(n.at)}
                </time>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 로그인 홈 전체 크루 게시판 최신 글 3개 (D): [질문] 표시, 본문 앞부분 + …, 크루·작성자·시간·댓글 */
function BoardLatest() {
  const { data, user, navigate } = useStore();
  const posts = boardPosts(data, user).filter((p) => !p.hidden).slice(0, 3);
  return (
    <section className={styles.sideCard} aria-labelledby="home-board-title">
      <div className={styles.sideHead}>
        <h2 className={styles.sideTitle} id="home-board-title">
          전체 크루 게시판
        </h2>
        <Button size="sm" variant="quiet" onClick={() => void navigate({ screen: 'board' })}>
          전체보기
        </Button>
      </div>
      {posts.length === 0 ? (
        <p className={styles.small}>아직 올라온 글이 없어요.</p>
      ) : (
        <ul className={styles.boardRows} aria-label="전체 크루 게시판 최신 글">
          {posts.map((p) => (
            <li key={p.id}>
              <button type="button" className={styles.boardRowBtn} onClick={() => void navigate({ screen: 'board', postId: p.id })}>
                <span className={styles.boardTitle}>
                  {p.question && <span className={styles.qTag}>질문</span>}
                  <b>{p.title}</b>
                </span>
                <span className={styles.boardEx}>{excerpt(p.body)}</span>
                <span className={styles.small}>
                  {authorLabel(data, p.authorId)} · {formatList(p.createdAt)} · 댓글 {data.globalComments.filter((c) => c.postId === p.id && !c.deletedAt && !c.hidden).length}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
