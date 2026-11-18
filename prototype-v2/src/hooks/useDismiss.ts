import { useEffect, type RefObject } from 'react';

/**
 * 펼침 메뉴 공통 닫기 (04 5장): Escape 는 닫고 여는 버튼으로 초점을 돌린다. 바깥을 누르면 닫는다.
 * 확인 대화상자가 떠 있을 때는 건드리지 않는다.
 */
export function useDismiss(
  open: boolean,
  rootRef: RefObject<HTMLElement>,
  close: () => void,
  focusBack?: RefObject<HTMLElement>,
) {
  useEffect(() => {
    if (!open) return;
    const blocked = () => !!document.querySelector('[role="alertdialog"]');
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || blocked()) return;
      close();
      focusBack?.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (blocked()) return;
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open, rootRef, close, focusBack]);
}
