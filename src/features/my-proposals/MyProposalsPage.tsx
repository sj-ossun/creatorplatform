import { EmptyState } from '../../components/EmptyState/EmptyState';
import { MetaParts } from '../../components/MetaParts/MetaParts';
import { Tag } from '../../components/Tag/Tag';
import { proposalsForMember } from '../../domain/proposals';
import { formatDay } from '../../domain/time';
import { PROPOSAL_KIND_LABEL, PROPOSAL_STATUS_LABEL } from '../../domain/types';
import { useStore } from '../../state/AppStore';
import { PageHeader, pageStyles as ps } from '../common/Page';
import styles from './MyProposals.module.css';

/**
 * 내 제안 (4.5단계, 사용자 결정): 크루원 본인이 받은 광고·커머스 제안을 읽기 전용으로 본다.
 * '제안 전달' 이후 상태만 보이고, 내부 메모는 보이지 않는다. 크루장은 이 화면이 없다.
 * 수락·거절·계약·정산은 하지 않는다.
 */
export function MyProposalsPage() {
  const { data, user } = useStore();
  const items = proposalsForMember(data, user);
  return (
    <div className={`${ps.screen} ${ps.reading}`}>
      <PageHeader title="내 제안">
        <span>회사가 전달한 광고·커머스 제안 기록이에요. 진행 상황은 담당자와 확인해 주세요. 이 화면에서 수락·거절하지 않아요.</span>
      </PageHeader>
      {items.length === 0 ? (
        <div className={ps.panel}>
          <EmptyState title="아직 받은 제안이 없어요">회사가 제안을 전달하면 여기에 보여요.</EmptyState>
        </div>
      ) : (
        <ul className={styles.list} aria-label="받은 제안 목록">
          {items.map((p) => (
            <li key={p.id} className={styles.card}>
              <div className={styles.head}>
                <Tag>{PROPOSAL_KIND_LABEL[p.kind]}</Tag>
                <h2 className={styles.brand}>{p.brand}</h2>
                <span className={styles.status}>{PROPOSAL_STATUS_LABEL[p.status]}</span>
              </div>
              <p className={styles.content}>{p.content}</p>
              <p className={styles.meta}>
                <MetaParts items={[`제안일 ${formatDay(p.proposedOn)}`, `담당 ${p.owner}`]} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
