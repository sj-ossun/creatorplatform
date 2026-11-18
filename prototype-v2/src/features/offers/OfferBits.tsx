import { isStale } from '../../domain/offers';
import { formatDay } from '../../domain/time';
import { PROPOSAL_KIND_LABEL, type Offer, type OfferRecipient } from '../../domain/types';
import styles from './Offers.module.css';

export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export function OfferTags({ offer }: { offer: Offer }) {
  return (
    <>
      <span className={styles.cat}>{offer.category}</span>
      <span className={styles.fmt}>{PROPOSAL_KIND_LABEL[offer.format]}</span>
    </>
  );
}

/** 응답 표시. '응답 없음'(2일 지남)은 관리자 화면에서만 보인다 */
export function ResponsePill({ offer, rec, now, admin = false }: { offer: Offer; rec: OfferRecipient; now: string; admin?: boolean }) {
  if (offer.cancelledAt && rec.response === 'pending') return <span className={styles.pill} data-r="cancelled">취소됨</span>;
  if (rec.response === 'accepted') return <span className={styles.pill} data-r="accepted">수락</span>;
  if (rec.response === 'declined') return <span className={styles.pill} data-r="declined">거절</span>;
  if (admin && isStale(rec, offer, now)) return <span className={styles.pill} data-r="stale">응답 없음</span>;
  return <span className={styles.pill} data-r="pending">응답 대기</span>;
}

export function OfferFacts({ offer }: { offer: Offer }) {
  return (
    <dl className={styles.kv}>
      <dt>단가</dt>
      <dd>
        <span className={styles.price}>{won(offer.price)}</span>
      </dd>
      <dt>희망 업로드</dt>
      <dd>{formatDay(offer.uploadOn)}</dd>
      <dt>제품 설명</dt>
      <dd>{offer.description}</dd>
      {offer.note && (
        <>
          <dt>비고</dt>
          <dd>{offer.note}</dd>
        </>
      )}
    </dl>
  );
}
