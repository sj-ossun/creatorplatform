import type { ReactNode } from 'react';
import { BrandPoster } from '../../components/BrandPoster/BrandPoster';
import { Button } from '../../components/Button/Button';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { Tag } from '../../components/Tag/Tag';
import { getCrew } from '../../domain/queries';
import { formatList } from '../../domain/time';
import type { Mission, User } from '../../domain/types';
import { leaderReviewTodo, memberTodo } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import type { Route } from '../../state/routes';
import styles from '../public/Public.module.css';

/** 홈 소개 문구 (v0.6 04 7장 제안 문구, 사용자 유지 결정). 정적 콘텐츠이며 허위 실적·후기를 넣지 않는다 */
const HERO = {
  eyebrow: '크리에이터 크루 플랫폼',
  title: ['혼자 만드는 콘텐츠에서,', '함께 성장하는 크루로.'],
  lead: '미션을 확인하고, 피드백을 나누고, 활동 기록을 이어가세요.',
};

const FEATURES = [
  { title: '크루에서 시작', body: '카테고리별 크루에서 크루장·크루원이 함께 활동해요. 내 크루 홈에서 크루 소개와 최근 미션을 확인해요.' },
  { title: '미션과 피드백', body: '크루장이 정한 기준과 기한에 맞춰 링크나 글로 제출하고, 보완 요청을 받으면 수정 내용을 적어 다시 제출해요.' },
  { title: '활동 기록', body: '제출 버전과 피드백이 덮어쓰이지 않고 쌓여요. 검토가 끝난 결과물은 게시 정보와 성과를 선택해서 남길 수 있어요.' },
];

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
 * P-01 공통 홈 (v0.6 N-01). 로그인 전후 같은 페이지이고, 로그인하면 맨 위에 개인 바로가기 구역만 더한다.
 * 순서: (로그인 사용자 바로가기) → 소개 문구·포스터 → 핵심 활동 3개 → 이용 과정 → 가이드 연결.
 */
export function HomePage() {
  const { session, navigate } = useStore();
  return (
    <div className={styles.home}>
      {session && <Personal user={session} />}

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>{HERO.eyebrow}</p>
          <h1 className={styles.heroTitle} id="hero-title">
            {HERO.title[0]}
            <br />
            {HERO.title[1]}
          </h1>
          <p className={styles.lead}>{HERO.lead}</p>
          {/* 이용 가이드는 헤더 메뉴와 아래 안내 구역에서 연다 (사용자 결정: 소개 문구 아래 버튼 삭제) */}
          {!session && (
            <div className={styles.ctas}>
              <Button variant="action" onClick={() => void navigate({ screen: 'login', from: { screen: 'home' } })}>
                로그인하고 시작하기
              </Button>
            </div>
          )}
          {!session && <p className={styles.small}>시연용 가상 계정으로 로그인해요. 실제 비밀번호는 입력하지 않아요.</p>}
        </div>
        <BrandPoster />
      </section>

      <section className={styles.block} aria-labelledby="features-title">
        <h2 className={styles.blockTitle} id="features-title">
          함께 이어가는 활동
        </h2>
        <ul className={styles.features}>
          {FEATURES.map((f, i) => (
            <li key={f.title} className={styles.feature}>
              <span className={styles.featureNo} aria-hidden="true">
                0{i + 1}
              </span>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p>{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

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
        운영 관리
      </Button>
    );
  } else if (!crew) {
    shortcuts = null;
  } else {
    shortcuts = (
      <>
        <Button onClick={() => void navigate({ screen: 'crew', crewId: crew.id })}>내 크루</Button>
        <Button onClick={() => toMissions(user.role === 'leader' ? 'todo' : 'all')}>
          {user.role === 'leader' ? '검토할 미션' : '미션'}
        </Button>
      </>
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
      const todo = memberTodo(data, user);
      next = (
        <NextList
          title="다음에 할 일"
          empty="지금 할 일이 없어요. 제출할 미션이나 보완 요청이 생기면 여기에 보여요."
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
          <h2 className={styles.personalTitle} id="personal-title">
            {user.name}님, 활동을 이어가세요.
          </h2>
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
      {pending && (
        <div className={styles.pending}>
          <p>로그인 전에 선택했던 화면이 있어요.</p>
          <div className={styles.ctas}>
            <Button
              variant="action"
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
