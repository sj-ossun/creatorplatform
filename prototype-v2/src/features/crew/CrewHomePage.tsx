import { useState } from 'react';
import { Button } from '../../components/Button/Button';
import { Character } from '../../components/Character/Character';
import { DueBadge } from '../../components/DueBadge/DueBadge';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { SubmissionCover } from '../../components/SubmissionCover/SubmissionCover';
import { parseYouTube } from '../../domain/linkCover';
import { NoticeTag } from '../../components/NoticeTag/NoticeTag';
import { commentsOf } from '../../domain/community';
import { crewProfile } from '../../domain/crewProfile';
import { DUE_GROUP_LABEL, leaderTodo, memberProgress, recentPosts, recentSubmissions, roomNotices, roomQuestions, roomSummary, thisWeekTodo, type DueGroup } from '../../domain/crewRoom';
import { dueState } from '../../domain/due';
import { getCrew, getUser, missionsOfCrew, statusOf } from '../../domain/queries';
import type { SubmissionStatus } from '../../domain/status';
import { formatDateOnly, formatDueColumn, formatList, kstMonthGrid, kstYmd } from '../../domain/time';
import type { Mission } from '../../domain/types';
import { memberTodo, visibleMissions } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import styles from './CrewHome.module.css';

/**
 * 크루방 (v0.7 6.3, 사용자 확정 견본 v3).
 * 왼쪽 크루 메뉴 카드는 앱 틀(CrewNav)이 그린다. 이 화면은 가운데 + 오른쪽 두 열:
 *   가운데: 환영 배너(캐릭터) → 공지 띠 → 이번 주 할 일(크루원) / 미션 현황·처리할 일(크루장) → 최근 게시물 카드
 *   오른쪽: 내 프로필(크루원) → 진행 상황(달성률 원형 + 상태 칩 + 이번 달 마감 달력) → 내 질문(크루원) / 크루 성과(크루장)
 * 주황 버튼·주황 막대는 가장 급한 할 일 하나에만. 숫자는 모두 업무 기록에서 계산한다.
 */
export function CrewHomePage({ crewId }: { crewId: string }) {
  const { data, user, navigate, setListFilter } = useStore();
  const [now] = useState(() => new Date().toISOString());
  const crew = getCrew(data, crewId);
  if (!crew) return null;
  const summary = roomSummary(data, crew.id, now);
  const isLeader = user.role === 'leader';
  const toMissions = (filter: 'all' | 'todo') => {
    setListFilter(filter);
    void navigate({ screen: 'missions', crewId: crew.id });
  };

  return (
    <div className={styles.room}>
      <div className={styles.main}>
        <Banner crewId={crew.id} now={now} />
        <NoticeStrip crewId={crew.id} />
        {isLeader ? (
          <LeaderTodoSection crewId={crew.id} now={now} activeMissions={summary.activeMissions} assigned={summary.counts.total} onAll={() => toMissions('all')} />
        ) : (
          <MemberTasks now={now} onAll={() => toMissions('all')} />
        )}
        <SubmissionCards crewId={crew.id} category={crewProfile(crew).category} />
        <PostCards crewId={crew.id} />
      </div>
      <aside className={styles.side} aria-label={isLeader ? '크루 진행 상황' : '내 진행 상황'}>
        {!isLeader && <ProfileCard />}
        <ProgressCard crewId={crew.id} now={now} />
        {isLeader ? <CrewPerformanceLink crewId={crew.id} /> : <MyQuestions crewId={crew.id} />}
      </aside>
    </div>
  );
}

/** 환영 배너: 날짜 · 카테고리 → 크루방 이름 → 소개 → 현황 알약 4개 + 캐릭터 */
function Banner({ crewId, now }: { crewId: string; now: string }) {
  const { data } = useStore();
  const crew = getCrew(data, crewId)!;
  const { category, intro } = crewProfile(crew);
  const summary = roomSummary(data, crewId, now);
  return (
    <header className={styles.banner}>
      <div className={styles.bannerText}>
        <p className={styles.bannerDate}>
          {formatDateOnly(now, now)}
          {category && (
            <>
              {' · '}
              <span className={styles.category}>
                <span className="sr-only">카테고리 </span>
                {category}
              </span>
            </>
          )}
        </p>
        <h1 className={styles.bannerTitle}>{crew.name} 크루방</h1>
        {intro && <p className={styles.bannerIntro}>{intro}</p>}
        <ul className={styles.facts} aria-label="크루 현재 상황">
          <li>
            크루장 <b>{getUser(data, crew.leaderId)?.name}</b>
          </li>
          <li>
            크루원 <b className="num">{summary.members}</b>명
          </li>
          <li>
            진행 중 미션 <b className="num">{summary.activeMissions}</b>개
          </li>
          <li>
            이번 주 마감 <b className="num">{summary.dueThisWeek}</b>개
          </li>
        </ul>
      </div>
      <Character size="banner" />
    </header>
  );
}

/** 공지 띠 (v0.7 5.8): 흰 바탕·따뜻한 선, 확성기 아이콘 · 공지 2줄 · 공지 전체. 주황 테두리 상자는 쓰지 않는다 */
function NoticeStrip({ crewId }: { crewId: string }) {
  const { data, user, navigate } = useStore();
  const notices = roomNotices(data, crewId, 2);
  return (
    <section className={styles.noticeStrip} aria-labelledby="room-notices-title">
      <h2 id="room-notices-title" className="sr-only">
        공지
      </h2>
      <svg className={styles.nsIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 10v4h3l6 4V6L7 10z" />
        <path d="M17 9a4 4 0 0 1 0 6" />
      </svg>
      {notices.length === 0 ? (
        <p className={styles.nsEmpty}>아직 공지가 없어요. 크루장 공지와 운영 공지가 여기에 보여요.</p>
      ) : (
        <ul className={styles.nsList} aria-label="최근 공지">
          {notices.map((n) => (
            <li key={n.id}>
              <NoticeTag source={n.source} />
              <button
                type="button"
                className={styles.nsLink}
                onClick={() => void navigate(n.postId ? { screen: 'notice', crewId, postId: n.postId } : { screen: 'notice', crewId, adminNoticeId: n.id })}
              >
                {n.title}
              </button>
              <time className={styles.meta} dateTime={n.at}>
                {formatList(n.at)}
              </time>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className={styles.nsAll} onClick={() => void navigate({ screen: 'notice', crewId })}>
        {user.role === 'leader' ? '공지 쓰기·전체' : '공지 전체'}
      </button>
    </section>
  );
}

/** 할 일 한 줄의 보조 설명 */
function taskNote(m: Mission, status: SubmissionStatus) {
  if (status === 'revision_requested') return '크루장 피드백을 보고 고쳐서 다시 내요';
  return m.format === 'link' ? '영상 공유 링크 제출' : '텍스트 제출';
}

/** 크루원 '이번 주 할 일' (v0.7 5.6): 날짜 열 · 제목 + 상태 · 버튼. 첫 줄(가장 급한 할 일)만 주황 막대와 주 버튼 */
function MemberTasks({ now, onAll }: { now: string; onAll: () => void }) {
  const { data, user, navigate } = useStore();
  const week = thisWeekTodo(data, user, now);
  const done = memberProgress(data, user).completed;
  return (
    <section aria-labelledby="room-tasks-title" className={styles.section}>
      <div className={styles.secHead}>
        <h2 className={styles.secTitle} id="room-tasks-title">
          이번 주 할 일
        </h2>
        <span className={styles.meta}>마감이 가까운 순서</span>
      </div>
      {week.length === 0 ? (
        <p className={styles.emptyBox}>이번 주에 할 일이 없어요. 새 미션이나 보완 요청이 생기면 여기에 보여요.</p>
      ) : (
        <ol className={styles.tasks} aria-label="이번 주 할 일">
          {week.map(({ mission, status }, i) => {
            const d = formatDueColumn(mission.dueAt);
            const first = i === 0;
            return (
              <li key={mission.id} className={styles.task} data-next={first || undefined}>
                <p className={styles.taskDate}>
                  <b className="num">{d.date}</b>
                  <span>{d.rest}</span>
                </p>
                <div className={styles.taskBody}>
                  <h3>{mission.title}</h3>
                  <p className={styles.taskMeta}>
                    <StatusChip status={status} />
                    <DueBadge state={dueState(mission, status, now)} />
                    <span>
                      {taskNote(mission, status)}
                      {first ? ' · 가장 먼저 할 일' : ''}
                    </span>
                  </p>
                </div>
                <Button
                  variant={first ? 'action' : 'secondary'}
                  onClick={() => void navigate({ screen: 'mission', missionId: mission.id })}
                  aria-label={`${mission.title} ${status === 'revision_requested' ? '수정본 제출하기' : '미션 열기'}`}
                >
                  {status === 'revision_requested' ? '수정본 제출하기' : '미션 열기'}
                </Button>
              </li>
            );
          })}
        </ol>
      )}
      <p className={styles.nextLine}>
        <button type="button" className={styles.linkBtn} onClick={onAll}>
          미션 전체 보기 (완료 {done}개 포함)
        </button>
      </p>
    </section>
  );
}

const POST_ART = [
  <svg key="a" viewBox="0 0 160 96" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="160" height="96" fill="#FFF1E6" /><path d="M30 40h100l-8-16H38z" fill="#fff" stroke="#20232B" strokeWidth="2.5" strokeLinejoin="round" /><path d="M38 40v36M122 40v36M30 76h100" stroke="#20232B" strokeWidth="2.5" strokeLinecap="round" /><rect x="52" y="52" width="18" height="14" rx="3" fill="#FFC9A0" /><rect x="76" y="52" width="18" height="14" rx="3" fill="#FFDDBF" /><rect x="100" y="52" width="14" height="14" rx="3" fill="#FFC9A0" /></svg>,
  <svg key="b" viewBox="0 0 160 96" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="160" height="96" fill="#FFF6EE" /><path d="M46 58h68c0 18-15 28-34 28s-34-10-34-28z" fill="#fff" stroke="#20232B" strokeWidth="2.5" /><ellipse cx="80" cy="58" rx="34" ry="7" fill="#FFC9A0" stroke="#20232B" strokeWidth="2.5" /><path d="M68 44c-3-7 3-10 0-17M80 42c-3-7 3-10 0-17M92 44c-3-7 3-10 0-17" stroke="#C9CED8" strokeWidth="3" strokeLinecap="round" fill="none" /></svg>,
  <svg key="c" viewBox="0 0 160 96" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="160" height="96" fill="#F6F7F9" /><rect x="58" y="12" width="44" height="74" rx="7" fill="#fff" stroke="#20232B" strokeWidth="2.5" /><path d="M66 30h28" stroke="#20232B" strokeWidth="5" strokeLinecap="round" /><path d="M66 44h28M66 54h20" stroke="#C9CED8" strokeWidth="3" strokeLinecap="round" /><circle cx="118" cy="30" r="8" fill="#FFDDBF" /></svg>,
];

/** 최근 게시물: 그림 카드 3장 (그림은 장식) */
/**
 * 제출물 커버 카드 (1단계, 사용자 확정 견본 2026-11-18): 크루원 '내 제출물'(본인 것만) · 크루장 '최근 제출물'(크루 전체).
 * 커버는 원래 링크를 새 창으로, 제목은 크루원은 미션 상세, 크루장은 그 사람 퀵 리뷰로. 휴대폰은 옆으로 미는 카드.
 */
function SubmissionCards({ crewId, category }: { crewId: string; category: string | null }) {
  const { data, user, navigate } = useStore();
  const leader = user.role === 'leader';
  const items = recentSubmissions(data, crewId, leader ? null : user.id);
  if (items.length === 0 && leader) return null;
  return (
    <section aria-labelledby="room-subs-title" className={`${styles.section} ${styles.subsSec}`}>
      <div className={styles.secHead}>
        <h2 className={styles.secTitle} id="room-subs-title">
          {leader ? '최근 제출물' : '내 제출물'}
        </h2>
        <span className={styles.meta}>{leader ? '최근 제출 순' : '최근 제출 순 · 나만 볼 수 있어요'}</span>
      </div>
      {items.length === 0 ? (
        <p className={styles.emptyBox}>아직 제출한 미션이 없어요. 제출하면 여기에 커버와 함께 모여요.</p>
      ) : (
        <ul className={styles.subCards} aria-label={leader ? '최근 제출물' : '내 제출물'}>
          {items.map(({ deliverable, mission, version, member }) => {
            const who = leader ? `${member.name} ` : '';
            return (
              <li key={deliverable.id} className={styles.subCard}>
                <SubmissionCover
                  content={version.content}
                  format={mission.format}
                  category={category}
                  version={version.number}
                  label={`${who}${mission.title} ${version.number}차 제출 ${parseYouTube(version.content) ? '영상 유튜브에서' : '링크'} 열기`}
                />
                <div className={styles.subBody}>
                  <p className={styles.subRow}>
                    <StatusChip status={deliverable.status} />
                    {leader && deliverable.status === 'pending_review' && <span className={styles.newTag}>새 제출</span>}
                  </p>
                  <h3 className={styles.subTitle}>
                    <button
                      type="button"
                      className={styles.subLink}
                      onClick={() =>
                        void navigate(leader ? { screen: 'review', missionId: mission.id, memberId: member.id, filter: deliverable.status } : { screen: 'mission', missionId: mission.id })
                      }
                    >
                      {leader ? `${member.name} · ${mission.title}` : mission.title}
                    </button>
                  </h3>
                  <p className={styles.meta}>
                    <time dateTime={version.submittedAt}>{formatList(version.submittedAt)}</time> 제출{leader ? ' · 누르면 퀵 리뷰로' : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PostCards({ crewId }: { crewId: string }) {
  const { data, user, navigate } = useStore();
  const posts = recentPosts(data, user, crewId);
  return (
    <section aria-labelledby="room-posts-title" className={styles.section}>
      <div className={styles.secHead}>
        <h2 className={styles.secTitle} id="room-posts-title">
          최근 게시물
        </h2>
        <button type="button" className={styles.linkBtn} onClick={() => void navigate({ screen: 'community', crewId })}>
          자유게시판
        </button>
      </div>
      {posts.length === 0 ? (
        <p className={styles.emptyBox}>아직 올라온 글이 없어요. 자유게시판에 작업이나 소식을 나눠 보세요.</p>
      ) : (
        <ul className={styles.postCards} aria-label="최근 게시물">
          {posts.map((p, i) => (
            <li key={p.id} className={styles.postCard}>
              <div className={styles.pcArt}>{POST_ART[i % POST_ART.length]}</div>
              <button type="button" className={styles.pcLink} onClick={() => void navigate({ screen: 'community', crewId, postId: p.id })}>
                {p.title}
              </button>
              <p className={styles.meta}>
                {getUser(data, p.authorId)?.name} · <time dateTime={p.createdAt}>{formatList(p.createdAt)}</time> · 댓글{' '}
                <span className="num">{commentsOf(data, p.id).filter((c) => !c.deletedAt).length}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProfileCard() {
  const { data, user, navigate } = useStore();
  return (
    <section className={`${styles.panel} ${styles.meCard}`} aria-labelledby="me-title">
      <svg className={styles.meAvatar} viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r="36" fill="#FFE1C7" />
        <path d="M20 34c0-12 7-20 16-20s16 8 16 20v8H20z" fill="#20232B" />
        <circle cx="36" cy="33" r="11" fill="#F6C9A6" />
        <circle cx="32" cy="32" r="1.6" fill="#20232B" />
        <circle cx="40" cy="32" r="1.6" fill="#20232B" />
        <path d="M33 37q3 2.5 6 0" stroke="#20232B" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M14 66c3-12 11-17 22-17s19 5 22 17" fill="#FFC9A0" />
      </svg>
      <h2 id="me-title" className={styles.meName}>
        {user.name}
      </h2>
      <p className={styles.meta}>크루원 · {getCrew(data, user.crewId)?.name} 크루</p>
      <button type="button" className={styles.linkBtn} onClick={() => void navigate({ screen: 'my-performance' })}>
        내 성과 보기
      </button>
    </section>
  );
}

/** 진행 상황: 달성률 원형 + 상태 칩 + 이번 달 마감 달력. 크루원은 내 미션, 크루장은 크루 전체 미션 배정 */
function ProgressCard({ crewId, now }: { crewId: string; now: string }) {
  const { data, user } = useStore();
  const isLeader = user.role === 'leader';
  let done = 0;
  let total = 0;
  const counts: Partial<Record<SubmissionStatus, number>> = {};
  const open: Mission[] = [];
  if (isLeader) {
    const s = roomSummary(data, crewId, now).counts;
    done = s.counts.completed;
    total = s.total;
    Object.assign(counts, s.counts);
    for (const m of missionsOfCrew(data, crewId)) if (m.targetIds.some((id) => statusOf(data, m.id, id) !== 'completed')) open.push(m);
  } else {
    const p = memberProgress(data, user);
    done = p.completed;
    total = p.assigned;
    for (const m of visibleMissions(data, user)) {
      const st = statusOf(data, m.id, user.id);
      counts[st] = (counts[st] ?? 0) + 1;
    }
    open.push(...memberTodo(data, user).map((x) => x.mission));
  }
  const rate = total ? Math.round((done / total) * 100) : 0;
  const order: SubmissionStatus[] = isLeader ? ['pending_review', 'revision_requested', 'not_submitted'] : ['completed', 'revision_requested', 'pending_review', 'not_submitted'];
  return (
    <section className={styles.panel} aria-labelledby="progress-title">
      <h2 className={styles.panelTitle} id="progress-title">
        {isLeader ? '크루 진행 상황' : '내 진행 상황'}
      </h2>
      <div className={styles.ringCard}>
        <Ring done={done} total={total} rate={rate} label={isLeader ? `미션 배정 ${total}건 중 ${done}건 완료, ${rate}%` : `미션 ${total}개 중 ${done}개 완료, ${rate}%`} />
        <ul className={styles.ringFacts}>
          {order
            .filter((k) => counts[k])
            .map((k) => (
              <li key={k}>
                <StatusChip status={k} /> <b className="num">{counts[k]}</b>
              </li>
            ))}
        </ul>
      </div>
      <DueCalendar missions={open} now={now} title={isLeader ? '이번 달 크루 마감 일정' : '이번 달 마감 일정'} />
    </section>
  );
}

function Ring({ done, total, rate, label }: { done: number; total: number; rate: number; label: string }) {
  const c = 2 * Math.PI * 42;
  return (
    <div className={styles.ring} role="img" aria-label={label}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#EEF1F5" strokeWidth="10" />
        {rate > 0 && <circle cx="50" cy="50" r="42" fill="none" stroke="#20232B" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(rate / 100) * c} ${c}`} transform="rotate(-90 50 50)" />}
      </svg>
      <div className={styles.ringIn}>
        <b className="num">{rate}%</b>
        <span className="num">
          {done} / {total}
        </span>
      </div>
    </div>
  );
}

/** 이번 달 마감 달력 (v0.7 6.3): 마감일 아래 먹색 점, 가장 먼저 할 일은 연한 주황 원 + 주황 점, 오늘은 먹색 원 테두리 */
function DueCalendar({ missions, now, title }: { missions: Mission[]; now: string; title: string }) {
  const g = kstMonthGrid(now);
  const dues = new Map<number, Mission[]>();
  for (const m of missions) {
    const d = kstYmd(m.dueAt);
    if (d.y === g.year && d.m === g.month) dues.set(d.d, [...(dues.get(d.d) ?? []), m]);
  }
  const first = [...missions].filter((m) => m.dueAt >= now).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0] ?? [...missions].sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  const firstDay = first && kstYmd(first.dueAt).m === g.month && kstYmd(first.dueAt).y === g.year ? kstYmd(first.dueAt).d : null;
  const cells: (number | null)[] = [...Array(g.firstDow).fill(null), ...Array.from({ length: g.days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const dueList = [...dues.keys()].sort((a, b) => a - b);
  return (
    <div className={styles.calBlock}>
      <h3 className={styles.calTitle}>{title}</h3>
      <table className={styles.cal}>
        <caption className="sr-only">
          {g.year}년 {g.month}월. {dueList.length ? `마감일 ${dueList.map((d) => `${d}일`).join(', ')}.` : '이번 달 마감 없음.'} 오늘 {g.today}일.
        </caption>
        <thead>
          <tr>
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
              <th key={d} scope="col">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, i) => (
            <tr key={i}>
              {w.map((d, j) => (
                <td key={j} data-today={d === g.today || undefined} data-due={(d && dues.has(d)) || undefined} data-next={(d && d === firstDay) || undefined}>
                  {d && <span>{d}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.calLegend}>
        <span>
          <i data-next="" />
          가장 먼저 할 일
        </span>
        <span>
          <i />
          마감
        </span>
        <span>○ 오늘</span>
      </p>
    </div>
  );
}

function MyQuestions({ crewId }: { crewId: string }) {
  const { data, user, navigate } = useStore();
  const items = roomQuestions(data, user, crewId, 2);
  return (
    <section className={styles.panel} aria-labelledby="room-qna-title">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle} id="room-qna-title">
          내 질문
        </h2>
        <button type="button" className={styles.linkBtn} onClick={() => void navigate({ screen: 'qna', crewId, writing: true })}>
          질문하기
        </button>
      </div>
      {items.length === 0 ? (
        <p className={styles.meta}>아직 올린 질문이 없어요. 궁금한 점을 크루장에게 물어보세요.</p>
      ) : (
        <ul className={styles.qaList} aria-label="내 질문">
          {items.map(({ post, answered }) => (
            <li key={post.id}>
              <button type="button" className={styles.qaLink} onClick={() => void navigate({ screen: 'qna', crewId, postId: post.id })}>
                {post.title}
              </button>
              <span className={styles.qaState} data-done={answered || undefined}>
                {answered ? '● 답변 완료' : '○ 답변 대기'}
                {post.private ? ' · 비공개' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CrewPerformanceLink({ crewId }: { crewId: string }) {
  const { navigate } = useStore();
  return (
    <section className={styles.panel} aria-labelledby="crew-perf-title">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle} id="crew-perf-title">
          크루 성과
        </h2>
        <button type="button" className={styles.linkBtn} onClick={() => void navigate({ screen: 'crew-performance', crewId })}>
          성과 보기
        </button>
      </div>
      <p className={styles.meta}>크루원별 게시·조회수 기록과 대시보드는 성과에서 볼 수 있어요.</p>
    </section>
  );
}

type TodoKind = 'review' | 'unsubmitted' | 'revision' | 'questions' | 'completed';

/**
 * 크루장 '미션 현황 · 처리할 일' (UI 개선 B → 사용자 확정 견본으로 '미션 현황'과 합침): 상태 숫자 5개
 * (검토 대기 · 미제출 · 보완 요청 · 답변 대기 · 완료). 숫자를 누르면 아래 목록이 그 상태로 좁혀진다.
 * 목록 한 줄 = 이름 · 미션(또는 질문) · 제출 차수나 마감. 줄의 버튼으로 바로 처리하러 간다.
 */
function LeaderTodoSection({ crewId, now, activeMissions, assigned, onAll }: { crewId: string; now: string; activeMissions: number; assigned: number; onAll: () => void }) {
  const { data, navigate } = useStore();
  const todo = leaderTodo(data, crewId, now);
  const counts: Record<TodoKind, number> = {
    review: todo.reviews.length,
    unsubmitted: todo.unsubmitted.length,
    revision: todo.revisions.length,
    questions: todo.questions.length,
    completed: todo.completed.length,
  };
  // 처음 고르는 칸: 크루장이 할 일이 있는 칸부터
  const [kind, setKind] = useState<TodoKind>(() => (['review', 'unsubmitted', 'questions', 'revision'] as TodoKind[]).find((k) => counts[k] > 0) ?? 'review');
  const urgent = todo.unsubmitted.filter((u) => u.group !== 'later');
  const name = (id: string) => getUser(data, id)?.name ?? '';
  const chips: { key: TodoKind; label: string; sub?: string }[] = [
    { key: 'review', label: '검토 대기' },
    {
      key: 'unsubmitted',
      label: '미제출',
      sub: urgent.length ? `마감 지남 ${todo.unsubmitted.filter((u) => u.group === 'overdue').length} · 24시간 안 ${todo.unsubmitted.filter((u) => u.group === 'soon').length}` : undefined,
    },
    { key: 'revision', label: '보완 요청' },
    { key: 'questions', label: '답변 대기' },
    { key: 'completed', label: '완료' },
  ];
  const groups = (['overdue', 'soon', 'later'] as DueGroup[]).map((g) => [g, todo.unsubmitted.filter((u) => u.group === g)] as const).filter(([, rows]) => rows.length);
  return (
    <section className={styles.todo} aria-labelledby="leader-todo-title">
      <div className={styles.todoHead}>
        <h2 className={styles.todoTitle} id="leader-todo-title">
          미션 현황 · 처리할 일
        </h2>
        <Button size="sm" variant="quiet" onClick={onAll}>
          미션 전체 보기
        </Button>
      </div>
      <p className={styles.todoMeta}>
        진행 중 미션 <span className="num">{activeMissions}</span>개 · 미션 배정 <span className="num">{assigned}</span>건 (크루원 1명 × 미션 1개 = 1건)
      </p>
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
      {(kind === 'revision' || kind === 'completed') &&
        ((kind === 'revision' ? todo.revisions : todo.completed).length === 0 ? (
          <p className={styles.empty}>{kind === 'revision' ? '보완 요청을 기다리는 사람이 없어요.' : '아직 완료한 사람이 없어요.'}</p>
        ) : (
          <ul className={styles.todoList} aria-label={kind === 'revision' ? '보완 요청 목록' : '완료 목록'}>
            {(kind === 'revision' ? todo.revisions : todo.completed).map((r) => (
              <li key={`${r.mission.id}-${r.memberId}`} className={styles.todoRow}>
                <div className={styles.todoMain}>
                  <b>
                    {name(r.memberId)} · {r.mission.title}
                  </b>
                  <span>{kind === 'revision' ? '크루원이 고쳐서 다시 낼 차례예요' : '검토 완료 · 미션 상세에서 우수 사례로 소개할 수 있어요'}</span>
                </div>
                <Button size="sm" onClick={() => void navigate({ screen: 'mission', missionId: r.mission.id })} aria-label={`${name(r.memberId)} ${r.mission.title} 미션 보기`}>
                  미션 보기
                </Button>
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
