import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { Tag } from '../../components/Tag/Tag';
import { postsOfCrew } from '../../domain/community';
import { crewMembers, getCrew, getUser } from '../../domain/queries';
import { formatList } from '../../domain/time';
import { memberStatus, missionCounts, visibleMissions } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import { pageStyles as ps } from '../common/Page';
import styles from './CrewHome.module.css';

const RECENT = 3;

/**
 * P-02 크루 홈 — 현재 크루의 맥락과 활동 진입점 (v0.4 01장 4절).
 * 사전 등록된 크루 데이터(이름·크루장·구성원)만 보여준다. 크루 소개·카테고리는 데이터에 없어 꾸며 넣지 않는다.
 * 미션 요약은 사용자에게 보이는 미션만 최근 생성순. 남의 제출·성과는 보여주지 않는다.
 */
export function CrewHomePage({ crewId }: { crewId: string }) {
  const { data, user, navigate } = useStore();
  const crew = getCrew(data, crewId);
  if (!crew) return null;
  const missions = visibleMissions(data, user).slice(0, RECENT);
  const total = visibleMissions(data, user).length;
  const notices = postsOfCrew(data, crew.id).filter((p) => p.kind === 'notice').slice(0, RECENT);

  return (
    <div className={`${ps.screen} ${ps.explore}`}>
      <div className={ps.group}>
        <h1 className={ps.title}>{crew.name} 크루</h1>
        <p className={ps.muted}>
          크루장 {getUser(data, crew.leaderId)?.name} · 크루원 {crewMembers(data, crew.id).length}명
        </p>
      </div>

      <section className={ps.group} aria-labelledby="crew-missions-title">
        <div className={ps.sectionLead}>
          <h2 className={ps.sectionTitle} id="crew-missions-title">
            {user.role === 'leader' ? '최근 미션' : '나에게 배정된 최근 미션'}
          </h2>
          <Button variant="quiet" onClick={() => void navigate({ screen: 'missions', crewId: crew.id })}>
            미션 전체 보기 ({total})
          </Button>
        </div>
        {missions.length === 0 ? (
          <div className={ps.panel}>
            <EmptyState title={user.role === 'leader' ? '아직 등록한 미션이 없어요' : '배정된 미션이 없어요'} />
          </div>
        ) : (
          <ul className={styles.list} aria-label="최근 미션">
            {missions.map((m) => {
              const c = missionCounts(data, m.id);
              return (
                <li key={m.id} className={styles.item}>
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => void navigate({ screen: 'mission', missionId: m.id })}
                  >
                    {m.title}
                  </button>
                  <span className={styles.meta}>
                    {user.role === 'leader' ? (
                      <span>
                        대상 <span className="num">{c.total}</span>명 · 검토 대기 <span className="num">{c.counts.pending_review}</span>명
                      </span>
                    ) : (
                      <StatusChip status={memberStatus(data, m, user)} />
                    )}
                    <span>
                      마감 <time dateTime={m.dueAt}>{formatList(m.dueAt)}</time>
                    </span>
                    {m.demoDue && <Tag variant="sim">시연용 기한</Tag>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={ps.group} aria-labelledby="crew-notices-title">
        <div className={ps.sectionLead}>
          <h2 className={ps.sectionTitle} id="crew-notices-title">
            공지
          </h2>
          <Button variant="quiet" onClick={() => void navigate({ screen: 'community', crewId: crew.id })}>
            소통 보기
          </Button>
        </div>
        {notices.length === 0 ? (
          <div className={ps.panel}>
            <EmptyState title="아직 올라온 공지가 없어요" />
          </div>
        ) : (
          <ul className={styles.list} aria-label="최근 공지">
            {notices.map((p) => (
              <li key={p.id} className={styles.item}>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => void navigate({ screen: 'community', crewId: crew.id, postId: p.id })}
                >
                  {p.title}
                </button>
                <span className={styles.meta}>
                  {getUser(data, p.authorId)?.name}, <time dateTime={p.createdAt}>{formatList(p.createdAt)}</time>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
