import { Breadcrumbs } from '../../components/Breadcrumbs/Breadcrumbs';
import { useStore } from '../../state/AppStore';
import { pageStyles as ps } from '../common/Page';
import { MissionForm } from './MissionForm';

/** 미션 등록 (F-02). 기존 폼과 등록 후 연결(해당 미션 퀵 리뷰)을 보존한다 */
export function MissionCreatePage() {
  const { navigate } = useStore();
  return (
    <div className={`${ps.screen} ${ps.reading}`}>
      <Breadcrumbs items={[{ label: '미션 목록', onClick: () => void navigate({ screen: 'missions' }) }, { label: '미션 등록' }]} />
      <div className={ps.panelPad}>
        <MissionForm onCancel={() => void navigate({ screen: 'missions' })} />
      </div>
    </div>
  );
}
