import { Button } from '../../components/Button/Button';
import { Distribution, StatusCountList } from '../../components/Distribution/Distribution';
import { getMission, getUser } from '../../domain/queries';
import { formatDetail } from '../../domain/time';
import { missionCounts } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import { MissionCrumbs } from '../common/MissionCrumbs';
import { DueLine, pageStyles as ps } from '../common/Page';

/**
 * P-04 미션 상세 (크루장) — 기준·대상·상태별 현황 → [퀵 리뷰 열기] (v0.4 01장 4절).
 * 퀵 리뷰는 이 미션에 속한 별도 작업 페이지(P-05)다. 생성 후 수정·삭제는 지원하지 않는다 (A-04).
 */
export function LeaderMissionPage({ missionId }: { missionId: string }) {
  const { data, navigate } = useStore();
  const mission = getMission(data, missionId);
  if (!mission) return null;
  const counts = missionCounts(data, mission.id);
  const pending = counts.counts.pending_review;
  const targets = mission.targetIds.map((id) => getUser(data, id)?.name).filter(Boolean);

  return (
    <div className={`${ps.screen} ${ps.reading}`}>
      <MissionCrumbs mission={mission} />
      <div className={ps.detailHeader}>
        <h1 className={ps.title}>{mission.title}</h1>
        <p className={ps.metaLine}>
          <DueLine mission={mission} />
          <span>제출 형식 {mission.format === 'link' ? '영상 공유 링크' : '텍스트'}</span>
          <span>
            대상 <span className="num">{counts.total}</span>명
          </span>
        </p>
      </div>

      <section className={`${ps.panelPad} ${ps.reviewEntry}`} aria-labelledby="review-entry-title">
        <div>
          <h2 className={ps.sectionTitle} id="review-entry-title">
            제출물 검토
          </h2>
          <p className={ps.muted}>
            {pending > 0 ? `검토 대기 ${pending}명이 기다리고 있어요.` : '지금 검토 대기인 제출물은 없어요. 다른 상태의 제출물도 볼 수 있어요.'}
          </p>
          <StatusCountList result={counts} />
        </div>
        <Button variant={pending > 0 ? 'action' : 'secondary'} onClick={() => void navigate({ screen: 'review', missionId: mission.id })}>
          퀵 리뷰 열기
        </Button>
      </section>

      <section className={ps.panelPad} aria-label="대상자 상태">
        <Distribution result={counts} scope="이 미션의 고정 대상자 기준" />
      </section>

      <section className={ps.section} aria-labelledby="overview-criteria">
        <h2 className={ps.sectionTitle} id="overview-criteria">
          미션 기준
        </h2>
        <dl className={ps.criteria}>
          <div>
            <dt>목표·제출 기준</dt>
            <dd className={ps.prose}>{mission.criteria}</dd>
          </div>
          <div>
            <dt>대상자 (등록 시 고정)</dt>
            <dd>{targets.join(', ')}</dd>
          </div>
          <div>
            <dt>등록</dt>
            <dd>
              <time dateTime={mission.createdAt}>{formatDetail(mission.createdAt)}</time>
            </dd>
          </div>
        </dl>
      </section>

      <div className={ps.actions}>
        {/* F-11B: 담당 미션에서 시연 도구의 미제출 안내 미리보기로 (실제 발송 없음) */}
        <Button
          variant="quiet"
          onClick={() => void navigate({ screen: 'notifications', tab: 'unsubmitted', missionId: mission.id })}
        >
          미제출 안내 미리보기 (시연)
        </Button>
      </div>
    </div>
  );
}
