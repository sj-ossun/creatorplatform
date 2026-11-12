import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { MissionCard, MissionCardGrid } from '../../components/MissionCard/MissionCard';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { Tag } from '../../components/Tag/Tag';
import { postsOfCrew } from '../../domain/community';
import { crewProfile } from '../../domain/crewProfile';
import { crewMembers, getCrew, getUser } from '../../domain/queries';
import { formatList } from '../../domain/time';
import { FORMAT_LABEL, memberStatus, missionCounts, missionGoal, visibleMissions } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import { pageStyles as ps } from '../common/Page';
import styles from './CrewHome.module.css';

const RECENT = 3;

/**
 * P-02 크루 홈 — 함께 활동하는 공간 (v0.6 02 7장).
 * 어떤 크루인지(이름·카테고리·소개), 누가 운영하는지, 무엇을 하러 갈지(최근 미션 → P-04, 전체 → P-03).
 * 크루원은 배정된 미션, 크루장은 자기 크루 미션을 최근 생성순 최대 3개. 공지 요약은 실제 공지가 있을 때만.
 * 소개 편집·모집·가입·초대 기능은 없다.
 */
export function CrewHomePage({ crewId }: { crewId: string }) {
  const { data, user, navigate } = useStore();
  const crew = getCrew(data, crewId);
  if (!crew) return null;
  const { category, intro } = crewProfile(crew);
  const all = visibleMissions(data, user);
  const missions = all.slice(0, RECENT);
  const notices = postsOfCrew(data, crew.id).filter((p) => p.kind === 'notice' && !p.deletedAt).slice(0, RECENT);
  const isLeader = user.role === 'leader';

  return (
    <div className={`${ps.screen} ${ps.explore}`}>
      <div className={ps.group}>
        <div className={ps.headRow}>
          <h1 className={ps.title}>{crew.name} 크루</h1>
          {category && (
            <span className={styles.category}>
              <span className="sr-only">카테고리 </span>
              {category}
            </span>
          )}
        </div>
        <p className={ps.muted}>
          크루장 {getUser(data, crew.leaderId)?.name} · 크루원 {crewMembers(data, crew.id).length}명
        </p>
      </div>

      {notices.length > 0 && (
        // 6-A: 크루장 공지는 크루 홈 맨 위에 강조 (테스터 피드백)
        <section className={styles.notices} aria-labelledby="crew-notices-title">
          <div className={ps.sectionLead}>
            <h2 className={ps.sectionTitle} id="crew-notices-title">
              <span className={styles.noticeBadge}>공지</span> 크루장 공지
            </h2>
            <Button variant="quiet" onClick={() => void navigate({ screen: 'community', crewId: crew.id })}>
              커뮤니티 보기
            </Button>
          </div>
          <ul className={styles.noticeList} aria-label="최근 공지">
            {notices.map((p) => (
              <li key={p.id}>
                <button type="button" className={styles.noticeLink} onClick={() => void navigate({ screen: 'community', crewId: crew.id, postId: p.id })}>
                  {p.title}
                </button>
                <span className={styles.meta}>
                  {getUser(data, p.authorId)?.name} | <time dateTime={p.createdAt}>{formatList(p.createdAt)}</time>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {intro && (
        <section className={`${ps.panelPad} ${styles.intro}`} aria-labelledby="crew-intro-title">
          <h2 className={ps.sectionTitle} id="crew-intro-title">
            크루 소개
          </h2>
          <p>{intro}</p>
        </section>
      )}

      <section className={ps.group} aria-labelledby="crew-missions-title">
        <div className={ps.sectionLead}>
          <h2 className={ps.sectionTitle} id="crew-missions-title">
            {isLeader ? '최근 미션' : '나에게 배정된 최근 미션'}
          </h2>
          {all.length > 0 && (
            <Button variant="quiet" onClick={() => void navigate({ screen: 'missions', crewId: crew.id })}>
              미션 전체 보기 ({all.length})
            </Button>
          )}
        </div>
        {missions.length === 0 ? (
          <div className={ps.panel}>
            <EmptyState
              title={isLeader ? '아직 등록한 미션이 없어요' : '아직 배정된 미션이 없어요'}
              action={
                isLeader ? (
                  <Button variant="action" onClick={() => void navigate({ screen: 'mission-create', crewId: crew.id })}>
                    미션 등록
                  </Button>
                ) : undefined
              }
            >
              {isLeader ? '미션을 등록하면 대상 크루원에게 바로 보여요.' : '크루장이 미션을 배정하면 여기에 보여요.'}
            </EmptyState>
          </div>
        ) : (
          <MissionCardGrid label="최근 미션">
            {missions.map((m) => {
              const c = missionCounts(data, m.id);
              return (
                <MissionCard
                  key={m.id}
                  title={m.title}
                  summary={missionGoal(m)}
                  status={
                    isLeader ? (
                      <span className={ps.metaLine}>
                        <span>
                          대상 <span className="num">{c.total}</span>명
                        </span>
                        <span>
                          <span className="status-glyph" data-status="pending_review" aria-hidden="true" /> 검토 대기{' '}
                          <span className="num">{c.counts.pending_review}</span>명
                        </span>
                      </span>
                    ) : (
                      <StatusChip status={memberStatus(data, m, user)} />
                    )
                  }
                  meta={
                    <>
                      <span>
                        마감 <time dateTime={m.dueAt}>{formatList(m.dueAt)}</time>
                      </span>
                      {m.demoDue && <Tag variant="sim">시연용 기한</Tag>}
                      <span>{FORMAT_LABEL[m.format]} 제출</span>
                    </>
                  }
                  actionLabel="미션 보기"
                  onOpen={() => void navigate({ screen: 'mission', missionId: m.id })}
                />
              );
            })}
          </MissionCardGrid>
        )}
      </section>

    </div>
  );
}
