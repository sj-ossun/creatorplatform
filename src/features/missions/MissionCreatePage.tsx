import { Breadcrumbs } from '../../components/Breadcrumbs/Breadcrumbs';
import { getCrew } from '../../domain/queries';
import { useStore } from '../../state/AppStore';
import { pageStyles as ps } from '../common/Page';
import { MissionForm } from './MissionForm';

/** P-06 미션 등록 (F-02, v0.6 02 11장). 저장 후 해당 미션 퀵 리뷰 P-05, 취소는 P-03(입력이 있으면 확인) */
export function MissionCreatePage({ crewId }: { crewId: string }) {
  const { data, navigate } = useStore();
  const toList = () => void navigate({ screen: 'missions', crewId });
  return (
    <div className={`${ps.screen} ${ps.reading}`}>
      <Breadcrumbs
        items={[
          { label: `${getCrew(data, crewId)?.name} 크루`, onClick: () => void navigate({ screen: 'crew', crewId }) },
          { label: '미션 목록', onClick: toList },
          { label: '새 미션' },
        ]}
      />
      <div className={ps.panelPad}>
        <MissionForm onCancel={toList} crewName={getCrew(data, crewId)?.name ?? ''} />
      </div>
    </div>
  );
}
