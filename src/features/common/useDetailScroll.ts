import { useCallback, useRef } from 'react';

/**
 * 좁은 화면(목록 위·상세 아래)에서 행을 누르면 상세로 스크롤한다.
 * 병렬 배치에서는 아무것도 하지 않는다.
 */
export function useDetailScroll() {
  const detailRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isStacked = () => {
    const d = detailRef.current;
    const l = listRef.current;
    if (!d || !l) return false;
    return d.getBoundingClientRect().top >= l.getBoundingClientRect().bottom - 1;
  };

  const toDetail = useCallback(() => {
    requestAnimationFrame(() => {
      if (!isStacked()) return;
      detailRef.current?.scrollIntoView({ block: 'start' });
      detailRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const toList = useCallback(() => {
    listRef.current?.scrollIntoView({ block: 'start' });
    const current = listRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    (current ?? listRef.current?.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
  }, []);

  return { detailRef, listRef, toDetail, toList };
}
