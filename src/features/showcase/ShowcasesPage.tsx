import { EmptyState } from '../../components/EmptyState/EmptyState';
import { showcaseViews } from '../../domain/showcase';
import { useStore } from '../../state/AppStore';
import { PageHeader, pageStyles as ps } from '../common/Page';
import { ShowcaseCard } from './ShowcaseCard';
import styles from './Showcase.module.css';

/**
 * 우수 사례 소개 [공개] (4.5단계, 사용자 결정). 크루장·관리자가 지정한 실제 기록만 보여준다.
 * 꾸며낸 후기·실적 수치는 넣지 않는다. 시연 데이터는 '시연용 가상 사례'로 표시한다.
 */
export function ShowcasesPage() {
  const { data } = useStore();
  const views = showcaseViews(data);
  return (
    <div className={ps.screen}>
      <PageHeader title="우수 사례">
        <span>크루장·관리자가 검토를 마친 결과물 중에서 골라 소개해요. 조회수는 크리에이터가 직접 확인해 입력한 값이에요.</span>
      </PageHeader>
      {views.length === 0 ? (
        <div className={ps.panel}>
          <EmptyState title="아직 소개한 사례가 없어요" />
        </div>
      ) : (
        <div className={styles.grid}>
          {views.map((v) => (
            <ShowcaseCard key={v.showcase.id} view={v} />
          ))}
        </div>
      )}
    </div>
  );
}
