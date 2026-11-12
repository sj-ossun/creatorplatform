import styles from './NoticeTag.module.css';

/**
 * 공지 머리표 (사용자 결정): 관리자가 올린 공지는 [운영 공지](로고 주황 바탕), 크루장이 올린 공지는 [크루장 공지](진한 먹색 바탕).
 * 색만으로 구분하지 않도록 글자로도 적는다. 카테고리 태그(테두리만)와 달리 바탕을 채운다.
 */
export function NoticeTag({ source }: { source: 'admin' | 'crew' }) {
  return (
    <span className={source === 'admin' ? styles.ops : styles.lead} data-notice={source}>
      {source === 'admin' ? '운영 공지' : '크루장 공지'}
    </span>
  );
}
