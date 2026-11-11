import { Breadcrumbs, type Crumb } from '../../components/Breadcrumbs/Breadcrumbs';
import { getCrew } from '../../domain/queries';
import type { Mission } from '../../domain/types';
import { useStore } from '../../state/AppStore';

/**
 * 미션 맥락 위치 (v0.4 01장 3절): 크루명 / 미션 목록 / 미션 제목 [/ 퀵 리뷰].
 * inReview 이면 미션 제목도 돌아갈 수 있는 링크가 된다.
 */
export function MissionCrumbs({ mission, inReview = false, inRecord = false }: { mission: Mission; inReview?: boolean; inRecord?: boolean }) {
  const { data, navigate } = useStore();
  const items: Crumb[] = [
    { label: `${getCrew(data, mission.crewId)?.name} 크루`, onClick: () => void navigate({ screen: 'crew', crewId: mission.crewId }) },
    { label: '미션 목록', onClick: () => void navigate({ screen: 'missions', crewId: mission.crewId }) },
    inReview || inRecord
      ? { label: mission.title, onClick: () => void navigate({ screen: 'mission', missionId: mission.id }) }
      : { label: mission.title },
  ];
  if (inReview) items.push({ label: '퀵 리뷰' });
  if (inRecord) items.push({ label: '게시·성과' });
  return <Breadcrumbs items={items} />;
}
