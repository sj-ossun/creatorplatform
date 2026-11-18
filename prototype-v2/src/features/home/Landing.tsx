import { crewProfile } from '../../domain/crewProfile';
import { crewBrowse } from '../../domain/crewRoom';
import { showcaseViews } from '../../domain/showcase';
import { formatCount, formatDay } from '../../domain/time';
import { FORMAT_LABEL } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import { LP_ART } from './landingArt';
import styles from './Landing.module.css';

/**
 * 공개 홈 (사용자 확정 견본 v3 + 순서 변경):
 *   첫 화면 → 수치(예시) → 카테고리 → 크루원 후기(예시, 별점) → 이용 방법 → 이번 주 크루 미션 → 우수 사례 → 마무리
 * 그림은 모두 장식(aria-hidden). 주황 버튼은 '로그인하고 시작하기' 하나.
 */
const CATEGORIES = ['푸드', '여행', '카페', '뷰티', '리빙'] as const;
const TILE_CLASS: Record<string, string> = { 푸드: 't-food', 여행: 't-travel', 카페: 't-cafe', 뷰티: 't-beauty', 리빙: 't-living' };

const VOICES = [
  { stars: 5, text: '처음엔 30초 영상도 막막했는데, 크루장 피드백을 두 번 받고 나니 무엇을 고쳐야 할지 보였어요.', name: '서연', meta: '푸드 · 완료 11개', color: '#58606E' },
  { stars: 4, text: '미션마다 제출 기준이 정해져 있어서 다시 찍는 일이 거의 없어요.', name: '도윤', meta: '뷰티 · 완료 7개', color: '#1E63B8' },
  { stars: 5, text: '같은 크루원들과 촬영 장소를 나누니까 혼자 할 때보다 훨씬 빨라요.', name: '하은', meta: '푸드 · 완료 15개', color: '#11795A' },
];

const STEPS = [
  { chip: '목표 · 기준 · 마감', tone: 't-food', title: '미션 확인', text: '미션 화면 하나에서 기준을 보고 바로 제출해요.' },
  { chip: '완료 또는 보완 요청', tone: 't-travel', title: '제출하고 피드백 받기', text: '크루장이 제출물을 보고 고칠 점을 알려줘요.' },
  { chip: '지워지지 않아요', tone: 't-living', title: '활동 기록 이어가기', text: '제출과 피드백이 차례로 쌓이고 내 성과에 남아요.' },
];

const Spark = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={`${styles.spark} ${className ?? ''}`} style={style} aria-hidden="true">
    <use href="#lp-i-spark" />
  </svg>
);
const Arrow = () => (
  <svg aria-hidden="true">
    <use href="#lp-i-arrow" />
  </svg>
);
const Art = ({ svg, className }: { svg: string; className?: string }) => <div className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;

function dday(iso: string, now: string) {
  if (iso <= now) return '마감 지남';
  const d = Math.ceil((Date.parse(iso) - Date.parse(now)) / 86_400_000);
  return d <= 1 ? '오늘 마감' : `D-${d}`;
}

export function Landing() {
  const { data, navigate } = useStore();
  const now = new Date().toISOString();
  const login = (from: Parameters<typeof navigate>[0] = { screen: 'home' }) => void navigate({ screen: 'login', from } as Parameters<typeof navigate>[0]);
  const toMissions = () => document.getElementById('landing-missions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const browse = crewBrowse(data, now);
  const crewCount = (cat: string) => browse.filter((b) => b.category === cat).length;
  const crewName = (crewId: string) => data.crews.find((c) => c.id === crewId)?.name ?? '';
  const upcoming = data.missions.filter((m) => m.dueAt > now).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id));
  // 진행 중 미션이 없으면(예시 데이터는 마감이 지난 미션뿐) 최근 미션을 '마감 지남'으로 보여준다
  const showingPast = upcoming.length === 0;
  const missions = (showingPast ? [...data.missions].sort((a, b) => b.dueAt.localeCompare(a.dueAt) || a.id.localeCompare(b.id)) : upcoming).slice(0, 3);
  const cases = showcaseViews(data).slice(0, 3);

  return (
    <div className={styles.page}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <defs dangerouslySetInnerHTML={{ __html: LP_ART.defs }} />
      </svg>

      <section className={styles.hero} aria-labelledby="hero-title">
        <Spark className={styles.s1} />
        <Spark className={styles.s2} />
        <Spark className={styles.s3} />
        <div className={styles.orbit} aria-hidden="true" />
        <span className={styles.eyebrow}>크리에이터 크루 플랫폼 CREW (가칭)</span>
        <h1 id="hero-title">
          혼자 만드는 콘텐츠에서,
          <br />
          함께{' '}
          <span className={styles.pill} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path fill="#fff" d="M7 4.5v15a1 1 0 0 0 1.5.86l12.6-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
            </svg>
          </span>{' '}
          <span className={styles.hl}>성장하는 크루로.</span>
        </h1>
        <p className={styles.sub}>미션을 확인하고, 피드백을 나누고, 활동 기록을 이어가세요. 크루장이 제출물을 보고 다음에 고칠 점을 알려줘요.</p>
        <div className={styles.cta}>
          <button type="button" className={styles.btnPrimary} onClick={() => login()}>
            로그인하고 시작하기
          </button>
          <button type="button" className={styles.btnOutline} onClick={toMissions}>
            이번 주 미션 보기
          </button>
        </div>
        <p className={styles.note}>시연용 가상 계정으로 로그인해요 · 크루 합류는 운영팀이 따로 안내해요</p>
      </section>

      <div className={styles.proof}>
        <ul className={styles.stats} aria-label="예시 수치">
          <li>
            <b>45명</b>
            <span>활동 중인 크루원</span>
          </li>
          <li>
            <b>500만</b>
            <span>누적 조회수</span>
          </li>
          <li>
            <b>94%</b>
            <span>기한 내 제출률</span>
          </li>
        </ul>
        <span className={styles.flag}>예시 수치</span>
      </div>

      <ul className={styles.tiles} aria-label="크루 카테고리">
        {CATEGORIES.map((c) => {
          const n = crewCount(c);
          return (
            <li key={c} className={`${styles.tile} ${TILE_CLASS[c]}`} data-soon={n === 0 || undefined}>
              <Art svg={LP_ART.tiles[c]} className={styles.obj} />
              <b>{c}</b>
              <small>{n > 0 ? `크루 ${n}개 활동 중` : '크루 준비 중'}</small>
            </li>
          );
        })}
      </ul>

      <section className={styles.section} aria-labelledby="lpv-title">
        <div className={styles.head}>
          <div>
            <p className={styles.kicker}>
              <svg aria-hidden="true">
                <use href="#lp-i-spark" />
              </svg>
              크루원 후기 (예시)
            </p>
            <h2 id="lpv-title">먼저 해본 크루원들 이야기</h2>
          </div>
        </div>
        <div className={styles.voices}>
          {VOICES.map((v) => (
            <figure key={v.name} className={styles.voice}>
              <p className={styles.stars} role="img" aria-label={`만족도 5점 만점에 ${v.stars}점`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} data-on={i <= v.stars || undefined} aria-hidden="true">
                    ★
                  </span>
                ))}
                <b aria-hidden="true">{v.stars.toFixed(1)}</b>
              </p>
              <blockquote>{v.text}</blockquote>
              <figcaption>
                <span className={styles.ava} style={{ background: v.color }} aria-hidden="true">
                  {v.name[0]}
                </span>
                <span>
                  {v.name} <em>{v.meta}</em>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.plain}`} id="landing-steps" aria-labelledby="lps-title">
        <div className={styles.head}>
          <div>
            <p className={styles.kicker}>
              <svg aria-hidden="true">
                <use href="#lp-i-spark" />
              </svg>
              이용 방법
            </p>
            <h2 id="lps-title">미션 하나가 기록으로 남기까지</h2>
          </div>
        </div>
        <ol className={styles.steps}>
          {STEPS.map((s, i) => (
            <li key={s.title} className={styles.step}>
              <span className={`${styles.chip} ${s.tone}`}>{s.chip}</span>
              <div className={styles.n} aria-hidden="true">
                {i + 1}
              </div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section} id="landing-missions" aria-labelledby="lpm-title">
        <div className={styles.head}>
          <div>
            <p className={styles.kicker}>
              <svg aria-hidden="true">
                <use href="#lp-i-spark" />
              </svg>
              이번 주 크루 미션
            </p>
            <h2 id="lpm-title">이번 주에 만들어볼 미션</h2>
          </div>
          <p>{showingPast ? '지금 진행 중인 미션이 없어 최근 미션을 보여드려요.' : '마감이 가까운 순서예요. 목표와 제출 형식을 먼저 확인할 수 있어요.'}</p>
        </div>
        {missions.length === 0 ? (
          <p className={styles.mnote}>지금 진행 중인 미션이 없어요.</p>
        ) : (
          <div className={styles.missions} data-n={missions.length}>
            {missions.map((m, i) => {
              const crew = data.crews.find((c) => c.id === m.crewId);
              const cat = crew ? crewProfile(crew).category : null;
              const tone = cat ? TILE_CLASS[cat] : 't-food';
              return (
                <article key={m.id} className={styles.mcard} data-feature={i === 0 || undefined}>
                  <div className={styles.row}>
                    <span className={`${styles.chip} ${i === 0 ? '' : tone}`}>
                      {crewName(m.crewId)} · {i === 0 && m.dueAt > now ? '마감 ' : ''}
                      {dday(m.dueAt, now)}
                    </span>
                    {i === 0 && <span className={styles.chip}>크루원 {m.targetIds.length}명 배정</span>}
                  </div>
                  <h3>{m.title}</h3>
                  <p className={styles.meta}>{m.criteria}</p>
                  <Art svg={LP_ART.shots[i % LP_ART.shots.length]} className={`${styles.shot} ${i === 0 ? '' : tone}`} />
                  <div className={styles.foot}>
                    <span>제출 형식 · {FORMAT_LABEL[m.format]}</span>
                    <button type="button" className={styles.arrow} aria-label={`로그인하고 ${m.title} 미션 보기`} onClick={() => login({ screen: 'mission', missionId: m.id })}>
                      <Arrow />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className={styles.mnote}>미션은 크루에 등록된 크루원에게 배정돼요. 크루 합류는 운영팀이 따로 안내해요.</p>
      </section>

      <section className={styles.cases} id="landing-cases" aria-labelledby="pcases-title">
        <div className={styles.casesHead}>
          <div>
            <p className={styles.kicker}>우수 사례</p>
            <h2 id="pcases-title">크루가 만든 콘텐츠</h2>
          </div>
          <button type="button" className={styles.more} onClick={() => login({ screen: 'showcases' })}>
            크루로 로그인하고 자세히 보기
          </button>
        </div>
        {cases.length === 0 ? (
          <p className={styles.mnote}>아직 공개된 우수 사례가 없어요.</p>
        ) : (
          <div className={styles.cases3} data-n={cases.length}>
            {cases.map((v, i) => {
              const cat = crewProfile(v.crew).category;
              const m = v.metric;
              return (
                <article key={v.showcase.id} className={styles.case3}>
                  <Art svg={LP_ART.cases[i % LP_ART.cases.length]} className={styles.caseArt} />
                  <div className={styles.caseBody}>
                    <span className={styles.demoFlag}>시연용 가상 사례</span>
                    <p>
                      {cat && <span className={styles.tag}>{cat}</span>} <span className={styles.rowMeta}>{v.crew.name} 크루</span>
                    </p>
                    <h3>{v.showcase.headline ?? v.mission.title}</h3>
                    <p className={styles.rowMeta}>
                      {m.kind === 'views' ? (
                        <>
                          조회수 <span className="num">{formatCount(m.latest.views!)}</span> · 크리에이터 직접 입력, {formatDay(m.latest.checkedOn)} 확인
                        </>
                      ) : (
                        '조회수 확인 전'
                      )}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.finale} aria-labelledby="lpf-title">
        <Spark style={{ left: '8%', top: 30 }} />
        <Spark style={{ right: '10%', bottom: 36, width: 16, height: 16 }} />
        <h2 id="lpf-title">
          혼자보다 크루와 함께
          <br />
          <span className={styles.hl2}>더 꾸준히</span> 만들어요
        </h2>
        <p>
          이미 크루에 등록되어 있다면 로그인하고 이번 주 미션을 확인하세요.
          <br />
          크루 합류는 운영팀이 따로 안내해요.
        </p>
        <button type="button" className={styles.finaleBtn} onClick={() => login()}>
          로그인하고 시작하기
        </button>
      </section>
    </div>
  );
}
