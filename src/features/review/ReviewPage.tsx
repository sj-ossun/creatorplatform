import { Button } from '../../components/Button/Button';
import { getMission } from '../../domain/queries';
import { missionCounts } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import type { Route } from '../../state/routes';
import { MissionCrumbs } from '../common/MissionCrumbs';
import { DueLine, PageHeader, pageStyles as ps } from '../common/Page';
import { ReviewWorkspace } from './ReviewWorkspace';

/**
 * P-05 퀵 리뷰 — 특정 미션의 여러 제출물을 검토하는 작업 페이지 (v0.6 02 10장).
 * 이 페이지에서만 목록·상세 병렬 구조를 쓴다. 전역·크루·미션 맥락과 돌아갈 경로를 유지한다.
 */
export function ReviewPage({ route }: { route: Extract<Route, { screen: 'review' }> }) {
  const { data, navigate } = useStore();
  const mission = getMission(data, route.missionId);
  if (!mission) return null;
  const pending = missionCounts(data, mission.id).counts.pending_review;
  return (
    <div className={ps.screen}>
      <MissionCrumbs mission={mission} inReview />
      <PageHeader title={`${mission.title} · 퀵 리뷰`}>
        <DueLine mission={mission} />
        <span>
          검토 대기 <span className="num">{pending}</span>건
        </span>
        <Button size="sm" onClick={() => void navigate({ screen: 'mission', missionId: mission.id })}>
          미션 상세로 돌아가기
        </Button>
      </PageHeader>
      {/* 미션이 바뀌면 이전 미션의 선택·처리 결과를 남기지 않는다 */}
      <ReviewWorkspace key={mission.id} mission={mission} route={route} />
    </div>
  );
}
