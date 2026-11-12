import { Button } from '../../components/Button/Button';
import { StatusNumbers } from '../../components/Distribution/Distribution';
import { NudgeBox } from './NudgeBox';
import { StatusChip } from '../../components/StatusChip/StatusChip';
import { deliverableOf, getMission, getUser, statusOf } from '../../domain/queries';
import { postOf } from '../../domain/performance';
import { ShowcaseControl } from '../showcase/ShowcaseControl';
import { FORMAT_LABEL } from '../../domain/views';
import { formatDetail } from '../../domain/time';
import { missionCounts } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import { MissionCrumbs } from '../common/MissionCrumbs';
import { DueLine, pageStyles as ps } from '../common/Page';

/**
 * P-04 미션 상세 (크루장) — 제목·기한·형식 → 상태별 현황 + [퀵 리뷰 열기] → 대상자·상태 요약 → 목표·기준 (v0.6 02 9장).
 * 퀵 리뷰는 이 미션에 속한 별도 작업 페이지(P-05)다. 이 페이지에 피드백 폼·대기열을 중첩하지 않는다.
 * 생성 후 수정·삭제는 지원하지 않는다 (A-04).
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
          <span>제출 형식 {FORMAT_LABEL[mission.format]}</span>
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
        </div>
        <Button variant={pending > 0 ? 'action' : 'secondary'} onClick={() => void navigate({ screen: 'review', missionId: mission.id })}>
          퀵 리뷰 열기
        </Button>
      </section>

      <section className={ps.panelPad} aria-labelledby="targets-title">
        <h2 className={ps.sectionTitle} id="targets-title">
          대상자·상태 요약
        </h2>
        <p className={ps.muted}>숫자를 누르면 그 상태의 크루원을 퀵 리뷰에서 바로 볼 수 있어요.</p>
        <StatusNumbers result={counts} onPick={(s) => void navigate({ screen: 'review', missionId: mission.id, filter: s })} />
        <ul className={ps.targetList} aria-label="대상자별 상태">
          {mission.targetIds.map((id) => (
            <li key={id}>
              <span className={ps.targetName}>{getUser(data, id)?.name}</span>
              <StatusChip status={statusOf(data, mission.id, id)} />
            </li>
          ))}
        </ul>
      </section>

      <NudgeBox mission={mission} />

      {(() => {
        // 우수 사례 지정 (4.5단계): 검토 완료된 결과물만. 게시 기록이 있어야 소개할 수 있다
        const done = mission.targetIds
          .map((id) => ({ member: getUser(data, id)!, deliverable: deliverableOf(data, mission.id, id) }))
          .filter((x) => x.member && x.deliverable?.status === 'completed');
        if (done.length === 0) return null;
        return (
          <section className={ps.panelPad} aria-labelledby="showcase-pick-title">
            <h2 className={ps.sectionTitle} id="showcase-pick-title">
              우수 사례 소개
            </h2>
            <p className={ps.muted}>검토를 마치고 게시 기록이 있는 결과물을 홈의 우수 사례로 소개할 수 있어요.</p>
            <ul className={ps.targetList} aria-label="소개할 수 있는 결과물">
              {done.map(({ member, deliverable }) => (
                <li key={member.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <span className={ps.targetName}>{member.name}</span>
                  {postOf(data, deliverable!.id) ? (
                    <ShowcaseControl deliverable={deliverable!} name={member.name} />
                  ) : (
                    <span className={ps.muted}>아직 게시 기록이 없어요.</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })()}

      <section className={ps.section} aria-labelledby="overview-criteria">
        <h2 className={ps.sectionTitle} id="overview-criteria">
          미션 목표·기준
        </h2>
        <dl className={ps.criteria}>
          <div>
            <dt>목표·제출 기준</dt>
            <dd className={ps.prose}>{mission.criteria}</dd>
          </div>
          <div>
            <dt>제출 형식</dt>
            <dd>{FORMAT_LABEL[mission.format]}</dd>
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
