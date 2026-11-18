import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './SideTabs.module.css';

export interface SideTabItem<K extends string> {
  key: K;
  label: ReactNode;
}

interface Props<K extends string> {
  label: string;
  items: SideTabItem<K>[];
  selected: K;
  onSelect: (key: K) => void;
  idPrefix: string;
  panelId: string;
  /** 목록 위에 둘 도구 (예: 관리자 크루 고르기) */
  top?: ReactNode;
  children: ReactNode;
}

/**
 * 왼쪽 세로 메뉴 + 바로 옆 내용 (E2, 사용자 확정 견본).
 * 컴퓨터: 왼쪽 세로 목록, 오른쪽 내용. 휴대폰(720px 미만): 위에 옆으로 미는 탭, 아래 내용.
 * 탭 목록 의미(tablist·tab·tabpanel)는 그대로 두고 배치만 바꾼다. 위·아래·좌·우 화살표, Home·End 지원.
 */
export function SideTabs<K extends string>({ label, items, selected, onSelect, idPrefix, panelId, top, children }: Props<K>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onSelect(items[next].key);
  }

  return (
    <div className={styles.layout}>
      <div className={styles.side}>
        {top && <div className={styles.top}>{top}</div>}
        <div role="tablist" aria-label={label} aria-orientation="vertical" className={styles.list}>
          {items.map((item, i) => {
            const on = item.key === selected;
            return (
              <button
                key={item.key}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${idPrefix}-tab-${item.key}`}
                aria-selected={on}
                aria-controls={panelId}
                tabIndex={on ? 0 : -1}
                className={styles.item}
                onClick={() => onSelect(item.key)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={`${idPrefix}-tab-${selected}`} className={styles.panel}>
        {children}
      </div>
    </div>
  );
}
