import { EmptyState } from '../../components/EmptyState/EmptyState';
import { PageHeader, pageStyles as ps } from '../common/Page';

/**
 * SC-06 관리자 전체 크루는 2차 묶음 범위다.
 * 동작하는 성공 화면처럼 꾸미지 않고 미구현임을 그대로 알린다 (디자인 14장).
 */
export function OverviewScreen() {
  return (
    <div className={ps.screen}>
      <PageHeader title="전체 크루" />
      <div className={ps.panel}>
        <EmptyState title="전체 크루 화면은 2차 묶음에서 만들어요">
          1차 묶음에는 공통 상태 집계 계산만 들어 있어요. 관리자 조회 화면(전체 크루, 크리에이터 상세)은 다음 묶음에서
          같은 집계 계산을 이어 써서 만들어요. 지금은 ‘알림 미리보기’에서 담당 크루의 피드백 알림 예시를 볼 수 있어요.
        </EmptyState>
      </div>
    </div>
  );
}
