import { useState } from 'react';
import { Breadcrumbs } from '../../components/Breadcrumbs/Breadcrumbs';
import { Distribution, StatusCountList } from '../../components/Distribution/Distribution';
import { FilterTabs } from '../../components/FilterTabs/FilterTabs';
import { getMission, getUser } from '../../domain/queries';
import { formatDetail } from '../../domain/time';
import { missionCounts } from '../../domain/views';
import { useStore } from '../../state/AppStore';
import type { MissionTab, Route } from '../../state/routes';
import { DueLine, pageStyles as ps } from '../common/Page';
import { ReviewWorkspace } from '../review/ReviewWorkspace';

type MissionRoute = Extract<Route, { screen: 'mission' }>;

/**
 * 크루장 미션 상세 (구조안 v0.2): 머리 + [개요 | 제출물 검토] 탭.
 * 제출물 검토 탭이 퀵 리뷰 작업 영역이다. 생성 후 수정·삭제는 지원하지 않는다 (A-04).
 */
export function LeaderMissionPage({ route }: { route: MissionRoute }) {
  const { data, navigate } = useStore();
  const mission = getMission(data, route.missionId);
  const counts = mission ? missionCounts(data, mission.id) : null;
  /**
   * 탭을 지정하지 않고 열면: 검토 대기가 있으면 제출물 검토, 없으면 개요.
   * 화면에 들어온 순간 한 번 정한다. 처리해서 검토 대기가 0이 되어도
   * 읽기 전용 결과가 사라지지 않게 탭을 바꾸지 않는다 (F-04, T-11).
   */
  const [initialTab] = useState<MissionTab>(() => ((counts?.counts.pending_review ?? 0) > 0 ? 'review' : 'overview'));
  if (!mission || !counts) return null;
  const tab = route.tab ?? initialTab;
  const targets = mission.targetIds.map((id) => getUser(data, id)?.name).filter(Boolean);

  return (
    <div className={ps.screen}>
      <Breadcrumbs items={[{ label: '미션 목록', onClick: () => void navigate({ screen: 'missions' }) }, { label: mission.title }]} />
      <div className={ps.detailHeader}>
        <h1 className={ps.title}>{mission.title}</h1>
        <p className={ps.metaLine}>
          <DueLine mission={mission} />
          <span>제출 형식 {mission.format === 'link' ? '영상 공유 링크' : '텍스트'}</span>
          <span>
            대상 <span className="num">{counts.total}</span>명
          </span>
        </p>
        <StatusCountList result={counts} />
      </div>
      <FilterTabs
        label="미션 상세"
        idPrefix="mission"
        panelId="mission-panel"
        selected={tab}
        onSelect={(k) => void navigate({ screen: 'mission', missionId: mission.id, tab: k })}
        items={[
          { key: 'overview', label: '개요' },
          { key: 'review', label: '제출물 검토', count: counts.counts.pending_review },
        ]}
      />
      <div role="tabpanel" id="mission-panel" aria-labelledby={`mission-tab-${tab}`}>
        {tab === 'review' ? (
          <ReviewWorkspace key={mission.id} mission={mission} route={route} />
        ) : (
          <div className={`${ps.detail} ${ps.reading}`}>
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
          </div>
        )}
      </div>
    </div>
  );
}
