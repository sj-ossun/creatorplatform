import { useEffect, useRef } from 'react';
import { Button } from '../Button/Button';
import styles from './ConfirmDialog.module.css';

interface Props {
  title: string;
  body: string;
  stayLabel: string;
  goLabel: string;
  onResolve: (go: boolean) => void;
}

/**
 * 확인 대화상자 (디자인 6.16).
 * 열리면 머무는 쪽 버튼에 초점, Esc 로 닫힘, 초점이 상자 밖으로 나가지 않고 닫으면 호출한 곳으로 돌아간다.
 */
export function ConfirmDialog({ title, body, stayLabel, goLabel, onResolve }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<Element | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement;
    stayRef.current?.focus();
    return () => {
      const el = returnTo.current;
      if (el instanceof HTMLElement && document.contains(el)) el.focus();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onResolve(false);
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = boxRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && stayRef.current?.focus()}>
      <div
        ref={boxRef}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-body"
        onKeyDown={onKeyDown}
      >
        <h2 id="dialog-title" className={styles.title}>
          {title}
        </h2>
        <p id="dialog-body" className={styles.body}>
          {body}
        </p>
        <div className={styles.actions}>
          <Button ref={stayRef} onClick={() => onResolve(false)}>
            {stayLabel}
          </Button>
          <Button variant="strong" onClick={() => onResolve(true)}>
            {goLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
