import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './FilterTabs.module.css';

export interface TabItem<K extends string> {
  key: K;
  label: ReactNode;
  count?: number;
  glyph?: ReactNode;
}

interface Props<K extends string> {
  label: string;
  items: TabItem<K>[];
  selected: K;
  onSelect: (key: K) => void;
  /** 연결된 tabpanel id */
  panelId: string;
  idPrefix: string;
}

/** 상태 필터·탭 (디자인 6.6, 6.19). 좌우 화살표·Home·End 지원 */
export function FilterTabs<K extends string>({ label, items, selected, onSelect, panelId, idPrefix }: Props<K>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onSelect(items[next].key);
  }

  return (
    <div className={styles.scroller}>
      <div role="tablist" aria-label={label} className={styles.tabs}>
        {items.map((item, i) => {
          const isSelected = item.key === selected;
          return (
            <button
              key={item.key}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${item.key}`}
              aria-selected={isSelected}
              aria-controls={panelId}
              tabIndex={isSelected ? 0 : -1}
              className={styles.tab}
              onClick={() => onSelect(item.key)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {item.glyph}
              <span>{item.label}</span>
              {item.count !== undefined && <span className={`${styles.count} num`}>{item.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
