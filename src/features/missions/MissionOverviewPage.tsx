import { Breadcrumbs } from '../../components/Breadcrumbs/Breadcrumbs';
import { Button } from '../../components/Button/Button';
import { Distribution } from '../../components/Distribution/Distribution';
import { getMission, getUser } from '../../domain/queries';
import { formatDetail } from '../../domain/time';
import { missionCounts } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import { DueLine, pageStyles as ps } from '../common/Page';

/**
 * UI-04 크루장 미션 개요 — 검토 이전 맥락. 목록에 붙은 오른쪽 패널이 아니라 독립된 화면.
 * 생성 후 수정·삭제는 지원하지 않는다 (A-04).
 */
export function MissionOverviewPage({ missionId }: { missionId: string }) {
  const { data, navigate } = useStore();
  const mission = getMission(data, missionId);
  if (!mission) return null;
  const counts = missionCounts(data, mission.id);
  const targets = mission.targetIds.map((id) => getUser(data, id)?.name).filter(Boolean);
  return (
    <div className={`${ps.screen} ${ps.reading}`}>
      <Breadcrumbs items={[{ label: '미션 목록', onClick: () => void navigate({ screen: 'missions' }) }, { label: mission.title }]} />
      <div className={ps.pageHead}>
        <h1 className={ps.title}>{mission.title}</h1>
        <Button variant="action" onClick={() => void navigate({ screen: 'review', missionId: mission.id })}>
          퀵 리뷰 열기
        </Button>
      </div>
      <p className={ps.metaLine}>
        <DueLine mission={mission} />
        <span>제출 형식 {mission.format === 'link' ? '영상 공유 링크' : '텍스트'}</span>
        <span>
          등록 <time dateTime={mission.createdAt}>{formatDetail(mission.createdAt)}</time>
        </span>
      </p>
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
        </dl>
      </section>
    </div>
  );
}
